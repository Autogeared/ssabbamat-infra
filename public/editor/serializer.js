/**
 * Serializer — localStorage 저장/불러오기, JSON 내보내기/가져오기
 */
const Serializer = (() => {
  const STORAGE_KEY = 'ssabbamat-layouts';
  const AUTO_KEY = 'ssabbamat-autosave';

  function init() {
    // 자동 저장 (30초마다)
    setInterval(autoSave, 30000);

    // 레이아웃 변경 시 자동 저장
    App.on('layout-changed', debounce(autoSave, 3000));
  }

  function autoSave() {
    const layout = App.getState().layout;
    localStorage.setItem(AUTO_KEY, JSON.stringify(layout));
  }

  function autoLoad() {
    const data = localStorage.getItem(AUTO_KEY);
    if (data) {
      try {
        const layout = JSON.parse(data);
        if (layout.objects && layout.objects.length > 0) {
          App.setLayout(layout);
        }
      } catch (e) {
        console.warn('자동 저장 데이터 로드 실패:', e);
      }
    }
  }

  function save(name) {
    const layouts = getAll();
    const layout = App.getState().layout;
    layouts[name] = {
      layout,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  }

  function load(name) {
    const layouts = getAll();
    const entry = layouts[name];
    if (!entry) return false;
    App.setLayout(entry.layout);
    History.clear();
    return true;
  }

  function remove(name) {
    const layouts = getAll();
    delete layouts[name];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts));
  }

  function getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  function exportJSON() {
    const layout = App.getState().layout;
    const blob = new Blob([JSON.stringify(layout, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ssabbamat-layout-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const layout = JSON.parse(e.target.result);
          App.setLayout(layout);
          History.clear();
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function debounce(fn, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  return { init, autoSave, autoLoad, save, load, remove, getAll, exportJSON, importJSON };
})();
