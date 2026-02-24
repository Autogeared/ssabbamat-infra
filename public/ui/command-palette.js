/**
 * CommandPalette — Ctrl+K 커맨드 팔레트
 */
const CommandPalette = (() => {
  let overlay, searchInput, resultsEl;
  let activeIdx = 0;
  let filtered = [];

  const commands = [
    // 도구
    { id: 'tool-select',  label: '선택 도구',     shortcut: 'V',       category: '도구', action: () => App.setTool('select') },
    { id: 'tool-wall',    label: '벽 그리기 도구', shortcut: 'W',       category: '도구', action: () => App.setTool('wall') },
    { id: 'tool-delete',  label: '삭제 도구',     shortcut: 'D',       category: '도구', action: () => App.setTool('delete') },
    // 편집
    { id: 'edit-undo',    label: '실행취소',      shortcut: 'Ctrl+Z',  category: '편집', action: () => History.undo() },
    { id: 'edit-redo',    label: '다시실행',      shortcut: 'Ctrl+Y',  category: '편집', action: () => History.redo() },
    { id: 'edit-copy',    label: '복사',          shortcut: 'Ctrl+C',  category: '편집', action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true })) },
    { id: 'edit-paste',   label: '붙여넣기',      shortcut: 'Ctrl+V',  category: '편집', action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'v', ctrlKey: true })) },
    { id: 'edit-rotate',  label: '90° 회전',      shortcut: 'R',       category: '편집', action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r' })) },
    { id: 'edit-delete',  label: '선택 삭제',     shortcut: 'Del',     category: '편집', action: () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' })) },
    // 파일
    { id: 'file-save',    label: '저장',          shortcut: '',        category: '파일', action: () => ModalManager.showSave() },
    { id: 'file-load',    label: '불러오기',      shortcut: '',        category: '파일', action: () => ModalManager.showLoad() },
    { id: 'file-export',  label: 'JSON 내보내기', shortcut: '',        category: '파일', action: () => Serializer.exportJSON() },
    { id: 'file-upload',  label: '도면 업로드',   shortcut: '',        category: '파일', action: () => ModalManager.showUpload() },
    // 분석
    { id: 'ai-insights',  label: 'AI 분석',       shortcut: '',        category: '분석', action: () => ModalManager.showInsights() },
    // 장비 배치
    { id: 'add-counter',   label: '카운터 추가',    shortcut: '', category: '장비', action: () => addEquipment('counter') },
    { id: 'add-gas-range', label: '가스레인지 추가', shortcut: '', category: '장비', action: () => addEquipment('gas-range') },
    { id: 'add-sink',      label: '싱크대 추가',    shortcut: '', category: '장비', action: () => addEquipment('sink') },
    { id: 'add-prep-table',label: '조리대 추가',    shortcut: '', category: '장비', action: () => addEquipment('prep-table') },
    { id: 'add-fridge',    label: '냉장고 추가',    shortcut: '', category: '장비', action: () => addEquipment('fridge') },
    { id: 'add-storage',   label: '보관함 추가',    shortcut: '', category: '장비', action: () => addEquipment('storage') },
    { id: 'add-door',      label: '문 추가',        shortcut: '', category: '장비', action: () => addEquipment('door') },
    { id: 'add-window',    label: '창문 추가',      shortcut: '', category: '장비', action: () => addEquipment('window') },
    // 보기
    { id: 'view-theme',   label: '테마 전환',     shortcut: '',        category: '보기', action: () => document.getElementById('btn-theme').click() },
  ];

  function addEquipment(type) {
    const def = ObjectFactory.DEFAULTS[type] || ObjectFactory.DEFAULTS.counter;
    const obj = {
      id: App.genId(),
      type,
      x: 100, y: 100,
      width: def.w, height: def.h,
      rotation: 0,
      label: def.label,
      color: def.color,
    };
    App.addObject(obj);
    ObjectFactory.createNode(obj);
    App.selectObject(obj.id);
    History.push();
    if (window.showToast) showToast(def.label + ' 추가됨');
  }

  function init() {
    overlay = document.getElementById('cmd-palette-overlay');
    searchInput = document.getElementById('cmd-search');
    resultsEl = document.getElementById('cmd-results');
    if (!overlay) return;

    searchInput.addEventListener('input', () => {
      filterAndRender(searchInput.value);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
        renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIdx = Math.max(activeIdx - 1, 0);
        renderResults();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[activeIdx]) {
          executeAndClose(filtered[activeIdx]);
        }
      } else if (e.key === 'Escape') {
        close();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });

    // Ctrl+K 글로벌 단축키
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    });
  }

  function toggle() {
    if (overlay.style.display === 'none') {
      open();
    } else {
      close();
    }
  }

  function open() {
    overlay.style.display = 'flex';
    searchInput.value = '';
    activeIdx = 0;
    filterAndRender('');
    setTimeout(() => searchInput.focus(), 50);
  }

  function close() {
    overlay.style.display = 'none';
  }

  function filterAndRender(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
      filtered = commands.slice();
    } else {
      filtered = commands.filter(c =>
        c.label.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.shortcut.toLowerCase().includes(q)
      );
    }
    activeIdx = 0;
    renderResults();
  }

  function renderResults() {
    resultsEl.innerHTML = '';
    filtered.forEach((cmd, i) => {
      const el = document.createElement('div');
      el.className = 'cmd-item' + (i === activeIdx ? ' active' : '');

      const cat = document.createElement('span');
      cat.className = 'cmd-item-cat';
      cat.textContent = cmd.category;

      const label = document.createElement('span');
      label.className = 'cmd-item-label';
      label.textContent = cmd.label;

      el.appendChild(cat);
      el.appendChild(label);

      if (cmd.shortcut) {
        const key = document.createElement('span');
        key.className = 'cmd-item-key';
        key.textContent = cmd.shortcut;
        el.appendChild(key);
      }

      el.addEventListener('click', () => executeAndClose(cmd));
      el.addEventListener('mouseenter', () => {
        activeIdx = i;
        renderResults();
      });

      resultsEl.appendChild(el);
    });

    // 활성 항목 스크롤
    const activeEl = resultsEl.querySelector('.cmd-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  }

  function executeAndClose(cmd) {
    close();
    cmd.action();
  }

  return { init };
})();
