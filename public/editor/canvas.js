/**
 * CanvasEditor — Konva Stage, 레이어, 그리드, 줌/팬
 */
const CanvasEditor = (() => {
  let stage, gridLayer, objectLayer, flowLayer, uiLayer;
  let scale = 1;
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;
  const GRID_SIZE = 25; // px

  function init() {
    const container = document.getElementById('konva-container');
    const rect = container.getBoundingClientRect();

    stage = new Konva.Stage({
      container: 'konva-container',
      width: rect.width,
      height: rect.height,
      draggable: false,
    });

    gridLayer = new Konva.Layer({ listening: false });
    objectLayer = new Konva.Layer();
    flowLayer = new Konva.Layer();
    uiLayer = new Konva.Layer();

    stage.add(gridLayer);
    stage.add(objectLayer);
    stage.add(flowLayer);
    stage.add(uiLayer);

    drawGrid();
    setupZoomPan();
    setupResize();

    // Stage 클릭으로 선택 해제
    stage.on('click tap', (e) => {
      if (e.target === stage) {
        App.selectObject(null);
      }
    });
  }

  function drawGrid() {
    gridLayer.destroyChildren();

    const layout = App.getState().layout;
    const w = layout.canvasWidth;
    const h = layout.canvasHeight;

    // 배경
    gridLayer.add(new Konva.Rect({
      x: 0, y: 0, width: w, height: h,
      fill: '#1a1d27',
    }));

    // 그리드 선
    for (let x = 0; x <= w; x += GRID_SIZE) {
      const isMajor = x % (GRID_SIZE * 4) === 0;
      gridLayer.add(new Konva.Line({
        points: [x, 0, x, h],
        stroke: isMajor ? '#2e3348' : '#1f2233',
        strokeWidth: isMajor ? 1 : 0.5,
      }));
    }
    for (let y = 0; y <= h; y += GRID_SIZE) {
      const isMajor = y % (GRID_SIZE * 4) === 0;
      gridLayer.add(new Konva.Line({
        points: [0, y, w, y],
        stroke: isMajor ? '#2e3348' : '#1f2233',
        strokeWidth: isMajor ? 1 : 0.5,
      }));
    }

    gridLayer.batchDraw();
  }

  function setupZoomPan() {
    const container = stage.container();

    // 마우스휠 줌
    container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.deltaY > 0 ? -1 : 1;
      const factor = 1.08;
      let newScale = direction > 0 ? oldScale * factor : oldScale / factor;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));

      stage.scale({ x: newScale, y: newScale });
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
      scale = newScale;
      stage.batchDraw();
      updateZoomInfo();
    });

    // 스페이스바 + 드래그 = 팬
    let isPanning = false;
    let spaceDown = false;
    let lastPos = null;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceDown = true;
        container.style.cursor = 'grab';
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        spaceDown = false;
        isPanning = false;
        container.style.cursor = '';
      }
    });

    // 미들 클릭 팬
    container.addEventListener('mousedown', (e) => {
      if (spaceDown || e.button === 1) {
        isPanning = true;
        lastPos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });
    window.addEventListener('mousemove', (e) => {
      if (!isPanning || !lastPos) return;
      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      stage.position({
        x: stage.x() + dx,
        y: stage.y() + dy,
      });
      lastPos = { x: e.clientX, y: e.clientY };
      stage.batchDraw();
    });
    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        lastPos = null;
        container.style.cursor = spaceDown ? 'grab' : '';
      }
    });
  }

  function setupResize() {
    window.addEventListener('resize', () => {
      const container = document.getElementById('konva-container');
      const rect = container.getBoundingClientRect();
      stage.width(rect.width);
      stage.height(rect.height);
      stage.batchDraw();
    });
  }

  function updateZoomInfo() {
    document.getElementById('zoom-info').textContent = Math.round(scale * 100) + '%';
  }

  function snapToGrid(val) {
    return Math.round(val / GRID_SIZE) * GRID_SIZE;
  }

  function getStage() { return stage; }
  function getObjectLayer() { return objectLayer; }
  function getFlowLayer() { return flowLayer; }
  function getUILayer() { return uiLayer; }
  function getScale() { return scale; }
  function getGridSize() { return GRID_SIZE; }

  function getCanvasPointer() {
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    return {
      x: (pos.x - stage.x()) / stage.scaleX(),
      y: (pos.y - stage.y()) / stage.scaleY(),
    };
  }

  return { init, getStage, getObjectLayer, getFlowLayer, getUILayer,
           getScale, getGridSize, snapToGrid, drawGrid, getCanvasPointer };
})();
