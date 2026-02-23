/**
 * App — 전역 상태관리 (EventEmitter 패턴)
 */
const App = (() => {
  const listeners = {};
  let state = {
    activeTool: 'select',
    selectedObjectId: null,
    layout: {
      objects: [],
      flowPaths: [],
      canvasWidth: 2000,
      canvasHeight: 1500,
      pixelsPerMeter: 50,
    },
    metrics: null,
    flowConnectFrom: null, // 동선 연결 시작 스테이션
  };

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
  }

  function off(event, fn) {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter(f => f !== fn);
  }

  function emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
  }

  function getState() { return state; }

  function setTool(tool) {
    state.activeTool = tool;
    emit('tool-changed', tool);
  }

  function addObject(obj) {
    state.layout.objects.push(obj);
    emit('object-added', obj);
    emit('layout-changed', state.layout);
  }

  function updateObject(id, props) {
    const obj = state.layout.objects.find(o => o.id === id);
    if (!obj) return;
    Object.assign(obj, props);
    emit('object-updated', obj);
    emit('layout-changed', state.layout);
  }

  function removeObject(id) {
    const idx = state.layout.objects.findIndex(o => o.id === id);
    if (idx === -1) return;
    const obj = state.layout.objects.splice(idx, 1)[0];
    // 관련 동선 경로도 제거
    state.layout.flowPaths = state.layout.flowPaths.filter(
      fp => fp.fromStationId !== id && fp.toStationId !== id
    );
    emit('object-removed', obj);
    emit('layout-changed', state.layout);
  }

  function selectObject(id) {
    state.selectedObjectId = id;
    emit('selection-changed', id);
  }

  function addFlowPath(fp) {
    state.layout.flowPaths.push(fp);
    emit('flow-added', fp);
    emit('layout-changed', state.layout);
  }

  function removeFlowPath(id) {
    state.layout.flowPaths = state.layout.flowPaths.filter(fp => fp.id !== id);
    emit('flow-removed', id);
    emit('layout-changed', state.layout);
  }

  function setLayout(layout) {
    state.layout = layout;
    emit('layout-loaded', layout);
    emit('layout-changed', layout);
  }

  function setMetrics(metrics) {
    state.metrics = metrics;
    emit('metrics-updated', metrics);
  }

  function genId() {
    return 'obj-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  }

  function init() {
    CanvasEditor.init();
    ObjectFactory.init();
    Tools.init();
    History.init();
    Serializer.init();
    Stations.init();
    FlowPathManager.init();
    MetricsPanel.init();
    Toolbar.init();
    Sidebar.init();
    ModalManager.init();

    // 자동 저장된 레이아웃 복원
    Serializer.autoLoad();
  }

  return { on, off, emit, getState, setTool, addObject, updateObject, removeObject,
           selectObject, addFlowPath, removeFlowPath, setLayout, setMetrics, genId, init };
})();
