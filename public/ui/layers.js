/**
 * LayerPanel — 좌측 레이어 패널 (객체 리스트, 가시성/잠금 토글)
 */
const LayerPanel = (() => {
  let listEl;
  const hiddenIds = new Set();
  const lockedIds = new Set();

  function init() {
    listEl = document.getElementById('layer-list');
    const collapseBtn = document.getElementById('btn-collapse-layers');
    const panel = document.getElementById('layer-panel');

    collapseBtn.addEventListener('click', () => {
      const collapsed = panel.classList.toggle('collapsed');
      collapseBtn.textContent = collapsed ? '▶' : '◀';
      // 캔버스 리사이즈
      setTimeout(() => {
        const container = document.getElementById('konva-container');
        const rect = container.getBoundingClientRect();
        CanvasEditor.getStage().width(rect.width);
        CanvasEditor.getStage().height(rect.height);
        CanvasEditor.getStage().batchDraw();
      }, 250);
    });

    App.on('layout-changed', rebuild);
    App.on('selection-changed', highlightSelected);
    App.on('object-added', rebuild);
    App.on('object-removed', rebuild);
  }

  function rebuild() {
    if (!listEl) return;
    const objects = App.getState().layout.objects;
    const selectedId = App.getState().selectedObjectId;
    listEl.innerHTML = '';

    // 역순: 위쪽이 앞(top)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const row = document.createElement('div');
      row.className = 'layer-row' + (obj.id === selectedId ? ' active' : '');
      row.dataset.id = obj.id;

      const colorDot = document.createElement('span');
      colorDot.className = 'layer-color';
      colorDot.style.background = obj.color || '#888';

      const name = document.createElement('span');
      name.className = 'layer-name';
      name.textContent = obj.label || obj.type;

      const eyeBtn = document.createElement('button');
      eyeBtn.className = 'layer-icon-btn' + (hiddenIds.has(obj.id) ? ' off' : '');
      eyeBtn.textContent = hiddenIds.has(obj.id) ? '◻' : '◼';
      eyeBtn.title = '가시성 토글';
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVisibility(obj.id);
      });

      const lockBtn = document.createElement('button');
      lockBtn.className = 'layer-icon-btn' + (lockedIds.has(obj.id) ? '' : ' off');
      lockBtn.textContent = lockedIds.has(obj.id) ? '🔒' : '🔓';
      lockBtn.title = '잠금 토글';
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleLock(obj.id);
      });

      row.appendChild(colorDot);
      row.appendChild(name);
      row.appendChild(eyeBtn);
      row.appendChild(lockBtn);

      // 행 클릭으로 선택
      row.addEventListener('click', () => {
        App.selectObject(obj.id);
      });

      listEl.appendChild(row);
    }
  }

  function highlightSelected(id) {
    if (!listEl) return;
    listEl.querySelectorAll('.layer-row').forEach(row => {
      row.classList.toggle('active', row.dataset.id === id);
    });
  }

  function toggleVisibility(id) {
    const node = ObjectFactory.findNode(id);
    if (!node) return;
    if (hiddenIds.has(id)) {
      hiddenIds.delete(id);
      node.visible(true);
    } else {
      hiddenIds.add(id);
      node.visible(false);
    }
    CanvasEditor.getObjectLayer().batchDraw();
    rebuild();
  }

  function toggleLock(id) {
    const node = ObjectFactory.findNode(id);
    if (!node) return;
    if (lockedIds.has(id)) {
      lockedIds.delete(id);
      node.draggable(true);
    } else {
      lockedIds.add(id);
      node.draggable(false);
      // 잠긴 객체 선택 해제
      if (App.getState().selectedObjectId === id) {
        App.selectObject(null);
      }
    }
    CanvasEditor.getObjectLayer().batchDraw();
    rebuild();
  }

  function isLocked(id) {
    return lockedIds.has(id);
  }

  return { init, isLocked };
})();
