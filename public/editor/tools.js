/**
 * Tools — 도구 시스템 (선택, 벽그리기, 배치, 삭제)
 */
const Tools = (() => {
  let wallStartPos = null;
  let wallPreview = null;
  let clipboard = null; // 복사된 객체

  function init() {
    App.on('tool-changed', onToolChanged);
    setupWallDrawing();
    setupCanvasClick();
    setupDrop();
    setupKeyboard();
  }

  function onToolChanged(tool) {
    const stage = CanvasEditor.getStage();
    const container = stage.container();

    // 벽 그리기 프리뷰 정리
    if (wallPreview) {
      wallPreview.destroy();
      wallPreview = null;
      wallStartPos = null;
      CanvasEditor.getUILayer().batchDraw();
    }

    // 커서 변경
    switch (tool) {
      case 'select': container.style.cursor = 'default'; break;
      case 'wall': container.style.cursor = 'crosshair'; break;
      case 'place': container.style.cursor = 'copy'; break;
      case 'delete': container.style.cursor = 'not-allowed'; break;
    }

    // 선택 도구가 아닌 경우 선택 해제
    if (tool !== 'select') {
      App.selectObject(null);
    }
  }

  function setupWallDrawing() {
    const stage = CanvasEditor.getStage();

    stage.on('mousedown touchstart', (e) => {
      if (App.getState().activeTool !== 'wall') return;
      if (e.target !== stage) return;

      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      wallStartPos = {
        x: CanvasEditor.snapToGrid(pos.x),
        y: CanvasEditor.snapToGrid(pos.y),
      };

      wallPreview = new Konva.Line({
        points: [wallStartPos.x, wallStartPos.y, wallStartPos.x, wallStartPos.y],
        stroke: '#222222',
        strokeWidth: 3,
        opacity: 0.5,
        lineCap: 'square',
      });
      CanvasEditor.getUILayer().add(wallPreview);
    });

    stage.on('mousemove touchmove', () => {
      if (!wallPreview || !wallStartPos) return;
      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      const endX = CanvasEditor.snapToGrid(pos.x);
      const endY = CanvasEditor.snapToGrid(pos.y);

      // 수평 또는 수직 강제 — 더 많이 움직인 축으로 고정
      const dx = Math.abs(endX - wallStartPos.x);
      const dy = Math.abs(endY - wallStartPos.y);
      let finalX, finalY;
      if (dx >= dy) {
        // 가로
        finalX = endX;
        finalY = wallStartPos.y;
      } else {
        // 세로
        finalX = wallStartPos.x;
        finalY = endY;
      }

      wallPreview.points([wallStartPos.x, wallStartPos.y, finalX, finalY]);
      CanvasEditor.getUILayer().batchDraw();
    });

    stage.on('mouseup touchend', () => {
      if (!wallPreview || !wallStartPos) return;
      const pts = wallPreview.points();
      const dx = Math.abs(pts[2] - pts[0]);
      const dy = Math.abs(pts[3] - pts[1]);
      const length = Math.max(dx, dy);

      wallPreview.destroy();
      wallPreview = null;
      CanvasEditor.getUILayer().batchDraw();

      if (length < 10) {
        wallStartPos = null;
        return;
      }

      // 가로벽: width=길이, height=0 / 세로벽: width=0, height=길이
      const obj = {
        id: App.genId(),
        type: 'wall',
        x: Math.min(pts[0], pts[2]),
        y: Math.min(pts[1], pts[3]),
        width: dx,
        height: dy,
        rotation: 0,
        label: '벽',
        color: '#222222',
      };

      App.addObject(obj);
      ObjectFactory.createNode(obj);
      History.push();
      wallStartPos = null;
    });
  }

  function setupCanvasClick() {
    // 캔버스 클릭은 stage click에서 처리 (선택 해제 등)
  }

  function setupDrop() {
    const container = document.getElementById('konva-container');

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();

      const type = e.dataTransfer.getData('object-type');
      if (!type) return;

      const stage = CanvasEditor.getStage();
      stage.setPointersPositions(e);
      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      const x = CanvasEditor.snapToGrid(pos.x);
      const y = CanvasEditor.snapToGrid(pos.y);

      const def = ObjectFactory.DEFAULTS[type] || ObjectFactory.DEFAULTS.counter;
      const obj = {
        id: App.genId(),
        type,
        x, y,
        width: def.w, height: def.h,
        rotation: 0,
        label: def.label,
        color: def.color,
      };
      App.addObject(obj);
      ObjectFactory.createNode(obj);

      History.push();
    });
  }

  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); History.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); History.redo(); return; }

      // 복사/붙여넣기
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { copySelected(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteClipboard(); return; }

      // 도구 단축키 (input 안에서는 무시)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case 'v': App.setTool('select'); break;
        case 'w': App.setTool('wall'); break;
        case 'd': App.setTool('delete'); break;
        case 'r': rotateSelected(); break;
        case 'delete':
        case 'backspace':
          deleteSelected();
          break;
        case 'escape':
          App.selectObject(null);
          App.setTool('select');
          break;
      }
    });
  }

  // ── Ctrl+C: 복사 ──
  function copySelected() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const obj = App.getState().layout.objects.find(o => o.id === id);
    if (!obj) return;
    clipboard = JSON.parse(JSON.stringify(obj));
    showToast('복사됨');
  }

  // ── Ctrl+V: 붙여넣기 (25px 오프셋) ──
  function pasteClipboard() {
    if (!clipboard) { showToast('복사된 객체가 없습니다'); return; }
    const newObj = JSON.parse(JSON.stringify(clipboard));
    newObj.id = App.genId();
    newObj.x = CanvasEditor.snapToGrid(newObj.x + 25);
    newObj.y = CanvasEditor.snapToGrid(newObj.y + 25);
    App.addObject(newObj);
    ObjectFactory.createNode(newObj);
    App.selectObject(newObj.id);
    History.push();
    // 다음 붙여넣기도 오프셋되도록 clipboard 위치 업데이트
    clipboard.x = newObj.x;
    clipboard.y = newObj.y;
  }

  // ── R키: 중심점 기준 90도 시계방향 회전 ──
  function rotateSelected() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const obj = App.getState().layout.objects.find(o => o.id === id);
    if (!obj) return;

    const w = obj.width || 0;
    const h = obj.height || 0;
    const oldRad = (obj.rotation || 0) * Math.PI / 180;
    const newDeg = ((obj.rotation || 0) + 90) % 360;
    const newRad = newDeg * Math.PI / 180;

    // 현재 중심점 (월드 좌표)
    const cx = obj.x + Math.cos(oldRad) * w / 2 - Math.sin(oldRad) * h / 2;
    const cy = obj.y + Math.sin(oldRad) * w / 2 + Math.cos(oldRad) * h / 2;

    // 새 위치: 중심점이 같도록 역산
    const newX = cx - Math.cos(newRad) * w / 2 + Math.sin(newRad) * h / 2;
    const newY = cy - Math.sin(newRad) * w / 2 - Math.cos(newRad) * h / 2;

    App.updateObject(id, {
      rotation: newDeg,
      x: CanvasEditor.snapToGrid(newX),
      y: CanvasEditor.snapToGrid(newY),
    });
    ObjectFactory.updateNodeVisual(obj);
    History.push();
  }

  function deleteSelected() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const node = ObjectFactory.findNode(id);
    if (node) node.destroy();
    App.removeObject(id);
    App.selectObject(null);
    CanvasEditor.getObjectLayer().batchDraw();
    History.push();
  }

  // ── 간단한 토스트 메시지 ──
  function showToast(msg) {
    let toast = document.getElementById('tool-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tool-toast';
      toast.style.cssText = 'position:fixed;bottom:60px;left:50%;transform:translateX(-50%);' +
        'background:#2c2418;border:1px solid #d9d1c7;color:#fff;padding:8px 18px;' +
        'border-radius:8px;font-size:13px;z-index:2000;pointer-events:none;' +
        'transition:opacity 0.3s;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  return { init };
})();
