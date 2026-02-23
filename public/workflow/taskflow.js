/**
 * TaskFlow — 공정 목록 기반 자동 동선 + 메트릭
 * tasks 배열 순서대로 장비 간 화살표 자동 생성
 */
const TaskFlow = (() => {
  function init() {
    App.on('tasks-changed', redraw);
    App.on('layout-changed', debounce(redraw, 300));
    App.on('layout-loaded', redraw);
  }

  function redraw() {
    drawArrows();
    calcMetrics();
  }

  // ── 화살표 자동 그리기 ──
  function drawArrows() {
    const layer = CanvasEditor.getFlowLayer();
    layer.destroyChildren();

    const tasks = App.getState().layout.tasks;
    const objects = App.getState().layout.objects;
    const objMap = new Map(objects.map(o => [o.id, o]));

    for (let i = 0; i < tasks.length - 1; i++) {
      const fromObj = objMap.get(tasks[i].objectId);
      const toObj = objMap.get(tasks[i + 1].objectId);
      if (!fromObj || !toObj) continue;
      if (fromObj.id === toObj.id) continue; // 같은 장비면 화살표 스킵

      const fx = fromObj.x + (fromObj.width || 50) / 2;
      const fy = fromObj.y + (fromObj.height || 50) / 2;
      const tx = toObj.x + (toObj.width || 50) / 2;
      const ty = toObj.y + (toObj.height || 50) / 2;

      // 순번 라벨
      const mx = (fx + tx) / 2;
      const my = (fy + ty) / 2;

      layer.add(new Konva.Arrow({
        points: [fx, fy, tx, ty],
        stroke: '#D97756',
        strokeWidth: 2,
        fill: '#D97756',
        pointerLength: 8,
        pointerWidth: 6,
        opacity: 0.7,
        dash: [6, 3],
      }));

      layer.add(new Konva.Tag({
        x: mx, y: my,
      }));
      layer.add(new Konva.Text({
        x: mx - 6,
        y: my - 6,
        text: String(i + 1),
        fontSize: 10,
        fill: '#D97756',
        fontStyle: 'bold',
      }));
    }

    layer.batchDraw();
  }

  // ── 메트릭 자동 계산 ──
  function calcMetrics() {
    const tasks = App.getState().layout.tasks;
    const objects = App.getState().layout.objects;
    const objMap = new Map(objects.map(o => [o.id, o]));
    const ppm = App.getState().layout.pixelsPerMeter || 50;

    if (tasks.length === 0) {
      App.setMetrics(null);
      return;
    }

    let totalDistance = 0;
    let directionChanges = 0;
    let prevAngle = null;
    const segments = [];

    for (let i = 0; i < tasks.length - 1; i++) {
      const fromObj = objMap.get(tasks[i].objectId);
      const toObj = objMap.get(tasks[i + 1].objectId);
      if (!fromObj || !toObj) continue;
      if (fromObj.id === toObj.id) {
        segments.push({
          from: tasks[i].name,
          to: tasks[i + 1].name,
          distance: 0,
          walkTime: 0,
        });
        continue;
      }

      const fx = fromObj.x + (fromObj.width || 50) / 2;
      const fy = fromObj.y + (fromObj.height || 50) / 2;
      const tx = toObj.x + (toObj.width || 50) / 2;
      const ty = toObj.y + (toObj.height || 50) / 2;

      const dx = tx - fx;
      const dy = ty - fy;
      const dist = Math.sqrt(dx * dx + dy * dy) / ppm;
      totalDistance += dist;

      const angle = Math.atan2(dy, dx);
      if (prevAngle !== null) {
        let diff = Math.abs(angle - prevAngle);
        if (diff > Math.PI) diff = 2 * Math.PI - diff;
        if (diff > Math.PI / 6) directionChanges++;
      }
      prevAngle = angle;

      segments.push({
        from: tasks[i].name,
        to: tasks[i + 1].name,
        distance: Math.round(dist * 100) / 100,
        walkTime: Math.round(dist / 1.2 * 10) / 10,
      });
    }

    const totalWalkTime = totalDistance / 1.2;
    const totalProcessing = tasks.reduce((s, t) => s + (t.duration || 0), 0);
    const totalCycleTime = totalWalkTime + totalProcessing;
    const complexityScore = Math.min(100, Math.round(
      directionChanges * 5 + totalDistance * 2
    ));

    // 병목 = 가장 오래 걸리는 태스크
    let bottleneck = null;
    let maxDur = 0;
    for (const t of tasks) {
      if ((t.duration || 0) > maxDur) {
        maxDur = t.duration;
        bottleneck = { stationId: t.objectId, stationLabel: t.name, time: maxDur };
      }
    }

    App.setMetrics({
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalWalkTime: Math.round(totalWalkTime * 10) / 10,
      totalCycleTime: Math.round(totalCycleTime * 10) / 10,
      complexityScore,
      directionChanges,
      crossings: 0,
      bottleneck,
      segments,
      taskCount: tasks.length,
      totalProcessing,
    });
  }

  function debounce(fn, d) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); };
  }

  return { init, redraw };
})();
