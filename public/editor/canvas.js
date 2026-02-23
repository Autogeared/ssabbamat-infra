/**
 * CanvasEditor — Konva Stage, 레이어, 그리드, 줌/팬
 * 10m x 10m, 1m 단위 격자, 10cm 스냅
 */
const CanvasEditor = (() => {
  let stage, gridLayer, objectLayer, flowLayer, uiLayer;
  let scale = 1;
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;

  const PPM = 50;            // 50px = 1m
  const SNAP = PPM / 10;     // 5px = 10cm (스냅 단위)
  const GRID_M = 10;         // 10m x 10m
  const CANVAS_PX = PPM * GRID_M; // 500px

  function init() {
    // 레이아웃 크기를 10m x 10m로 설정
    const state = App.getState();
    state.layout.canvasWidth = CANVAS_PX;
    state.layout.canvasHeight = CANVAS_PX;

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

    const w = CANVAS_PX;
    const h = CANVAS_PX;

    // 배경
    gridLayer.add(new Konva.Rect({
      x: 0, y: 0, width: w, height: h,
      fill: '#ffffff',
    }));

    // 1m 단위 세로 점선 + 숫자
    for (let m = 0; m <= GRID_M; m++) {
      const x = m * PPM;
      gridLayer.add(new Konva.Line({
        points: [x, 0, x, h],
        stroke: '#c8bfb5',
        strokeWidth: 1,
        dash: [4, 4],
      }));
      gridLayer.add(new Konva.Text({
        x: x + 3,
        y: 3,
        text: m + 'm',
        fontSize: 10,
        fill: '#8a7e72',
      }));
    }

    // 1m 단위 가로 점선 + 숫자
    for (let m = 0; m <= GRID_M; m++) {
      const y = m * PPM;
      gridLayer.add(new Konva.Line({
        points: [0, y, w, y],
        stroke: '#c8bfb5',
        strokeWidth: 1,
        dash: [4, 4],
      }));
      if (m > 0) {
        gridLayer.add(new Konva.Text({
          x: 3,
          y: y + 3,
          text: m + 'm',
          fontSize: 10,
          fill: '#8a7e72',
        }));
      }
    }

    gridLayer.batchDraw();
  }

  function setupZoomPan() {
    const container = stage.container();

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
      stage.position({
        x: stage.x() + (e.clientX - lastPos.x),
        y: stage.y() + (e.clientY - lastPos.y),
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

  // 10cm (5px) 단위 스냅
  function snapToGrid(val) {
    return Math.round(val / SNAP) * SNAP;
  }

  function getStage() { return stage; }
  function getObjectLayer() { return objectLayer; }
  function getFlowLayer() { return flowLayer; }
  function getUILayer() { return uiLayer; }
  function getScale() { return scale; }
  function getGridSize() { return SNAP; }

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
