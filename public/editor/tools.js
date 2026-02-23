/**
 * Tools — 도구 시스템 (선택, 벽그리기, 배치, 삭제, 동선)
 */
const Tools = (() => {
  let wallStartPos = null;
  let wallPreview = null;

  function init() {
    App.on('tool-changed', onToolChanged);
    setupWallDrawing();
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
      case 'station': container.style.cursor = 'copy'; break;
      case 'flow': container.style.cursor = 'pointer'; break;
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
        stroke: '#6B7280',
        strokeWidth: 10,
        opacity: 0.5,
        lineCap: 'round',
      });
      CanvasEditor.getUILayer().add(wallPreview);
    });

    stage.on('mousemove touchmove', () => {
      if (!wallPreview || !wallStartPos) return;
      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      const endX = CanvasEditor.snapToGrid(pos.x);
      const endY = CanvasEditor.snapToGrid(pos.y);

      // 수직/수평 스냅 (Shift 처럼 자동)
      const dx = Math.abs(endX - wallStartPos.x);
      const dy = Math.abs(endY - wallStartPos.y);
      let finalX = endX, finalY = endY;
      if (dx > dy * 2) finalY = wallStartPos.y;      // 수평
      else if (dy > dx * 2) finalX = wallStartPos.x;  // 수직

      wallPreview.points([wallStartPos.x, wallStartPos.y, finalX, finalY]);
      CanvasEditor.getUILayer().batchDraw();
    });

    stage.on('mouseup touchend', () => {
      if (!wallPreview || !wallStartPos) return;
      const pts = wallPreview.points();
      const length = Math.sqrt(
        Math.pow(pts[2] - pts[0], 2) + Math.pow(pts[3] - pts[1], 2)
      );

      wallPreview.destroy();
      wallPreview = null;
      CanvasEditor.getUILayer().batchDraw();

      if (length < 20) {
        wallStartPos = null;
        return;
      }

      // 벽 객체 생성
      const obj = {
        id: App.genId(),
        type: 'wall',
        x: Math.min(pts[0], pts[2]),
        y: Math.min(pts[1], pts[3]),
        width: Math.abs(pts[2] - pts[0]) || 10,
        height: Math.abs(pts[3] - pts[1]) || 10,
        rotation: 0,
        label: '벽',
        color: '#6B7280',
        points: [pts[0], pts[1], pts[2], pts[3]],
      };

      App.addObject(obj);
      ObjectFactory.createNode(obj);
      History.push();
      wallStartPos = null;
    });
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
      const role = e.dataTransfer.getData('station-role');
      if (!type) return;

      const stage = CanvasEditor.getStage();
      stage.setPointersPositions(e);
      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      const x = CanvasEditor.snapToGrid(pos.x);
      const y = CanvasEditor.snapToGrid(pos.y);

      if (type === 'station' && role) {
        const meta = ObjectFactory.STATION_META[role];
        const obj = {
          id: App.genId(),
          type: 'station',
          x, y,
          width: 80, height: 80,
          rotation: 0,
          label: meta?.label || role,
          stationRole: role,
          processingTime: meta?.defaultTime || 30,
        };
        App.addObject(obj);
        ObjectFactory.createNode(obj);
      } else {
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
      }

      History.push();
    });
  }

  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); History.undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); History.redo(); }

      // 도구 단축키
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case 'v': App.setTool('select'); break;
        case 'w': App.setTool('wall'); break;
        case 'p': App.setTool('place'); break;
        case 's': if (!e.ctrlKey) App.setTool('station'); break;
        case 'f': App.setTool('flow'); break;
        case 'd': App.setTool('delete'); break;
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

  return { init };
})();
