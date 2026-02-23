/**
 * App — 전역 상태관리 (EventEmitter 패턴)
 * 공정(tasks) = 순서대로 정의된 태스크 목록, 각 태스크는 캔버스 장비에 연결
 */
const App = (() => {
  const listeners = {};
  let state = {
    activeTool: 'select',
    selectedObjectId: null,
    layout: {
      objects: [],       // 캔버스 장비들
      tasks: [],         // 공정 목록 [{id, name, objectId, duration}]
      canvasWidth: 500,
      canvasHeight: 500,
      pixelsPerMeter: 50,
    },
    metrics: null,
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
    // 관련 태스크의 objectId 해제
    state.layout.tasks.forEach(t => {
      if (t.objectId === id) t.objectId = null;
    });
    emit('object-removed', obj);
    emit('layout-changed', state.layout);
    emit('tasks-changed', state.layout.tasks);
  }

  function selectObject(id) {
    state.selectedObjectId = id;
    emit('selection-changed', id);
  }

  // ── 공정(태스크) 관리 ──
  function addTask(task) {
    state.layout.tasks.push(task);
    emit('tasks-changed', state.layout.tasks);
    emit('layout-changed', state.layout);
  }

  function updateTask(id, props) {
    const t = state.layout.tasks.find(t => t.id === id);
    if (!t) return;
    Object.assign(t, props);
    emit('tasks-changed', state.layout.tasks);
    emit('layout-changed', state.layout);
  }

  function removeTask(id) {
    state.layout.tasks = state.layout.tasks.filter(t => t.id !== id);
    emit('tasks-changed', state.layout.tasks);
    emit('layout-changed', state.layout);
  }

  function reorderTasks(tasks) {
    state.layout.tasks = tasks;
    emit('tasks-changed', state.layout.tasks);
    emit('layout-changed', state.layout);
  }

  function setLayout(layout) {
    // 이전 데이터 호환: flowPaths/tasks 없으면 빈 배열
    if (!layout.tasks) layout.tasks = [];
    state.layout = layout;
    emit('layout-loaded', layout);
    emit('layout-changed', layout);
    emit('tasks-changed', layout.tasks);
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
    TaskFlow.init();
    Toolbar.init();
    Sidebar.init();
    ModalManager.init();

    Serializer.autoLoad();
  }

  return { on, off, emit, getState, setTool, addObject, updateObject, removeObject,
           selectObject, addTask, updateTask, removeTask, reorderTasks,
           setLayout, setMetrics, genId, init };
})();
