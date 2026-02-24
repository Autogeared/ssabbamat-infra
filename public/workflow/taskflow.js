/**
 * TaskFlow — 공정 목록 기반 자동 동선 + 메트릭
 * tasks 배열 순서대로 장비 간 화살표 자동 생성
 * 동선은 장비 중심이 아닌 "작업 위치"(통로 쪽 가장자리) 기준
 */
const TaskFlow = (() => {
  const STAND_OFFSET = 25; // 장비 가장자리에서 사람이 서는 거리 (0.5m)

  function init() {
    App.on('tasks-changed', redraw);
    App.on('layout-changed', debounce(redraw, 300));
    App.on('layout-loaded', redraw);
  }

  function redraw() {
    drawArrows();
    calcMetrics();
  }

  /**
   * 장비의 "작업 위치" 계산 (회전 고려)
   * Konva Group은 (obj.x, obj.y)를 기준으로 회전하므로
   * 실제 중심과 변 방향을 회전각 반영하여 계산
   */
  function getAccessPoint(obj, centroid) {
    const w = obj.width || 50;
    const h = obj.height || 50;
    const rot = (obj.rotation || 0) * Math.PI / 180;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);

    // 회전 적용된 실제 중심 (Group은 좌상단 기준 회전)
    const cx = obj.x + (w / 2) * cosR - (h / 2) * sinR;
    const cy = obj.y + (w / 2) * sinR + (h / 2) * cosR;

    const dx = centroid.x - cx;
    const dy = centroid.y - cy;

    // 통로 방향을 로컬 좌표계로 변환 (역회전)
    const ldx = dx * cosR + dy * sinR;
    const ldy = -dx * sinR + dy * cosR;

    const hw = w / 2;
    const hh = h / 2;

    // 로컬 좌표에서 가장 가까운 변 판별
    let lax, lay;
    if (Math.abs(ldx) * hh > Math.abs(ldy) * hw) {
      const side = ldx > 0 ? 1 : -1;
      lax = side * (hw + STAND_OFFSET);
      lay = 0;
    } else {
      const side = ldy > 0 ? 1 : -1;
      lax = 0;
      lay = side * (hh + STAND_OFFSET);
    }

    // 로컬 → 월드 좌표 변환
    return {
      x: cx + lax * cosR - lay * sinR,
      y: cy + lax * sinR + lay * cosR,
    };
  }

  /** 태스크에 연결된 장비들의 무게중심 계산 (회전 고려) */
  function calcCentroid(tasks, objMap) {
    let sx = 0, sy = 0, cnt = 0;
    for (const t of tasks) {
      const o = objMap.get(t.objectId);
      if (!o) continue;
      const w = o.width || 50, h = o.height || 50;
      const rot = (o.rotation || 0) * Math.PI / 180;
      sx += o.x + (w / 2) * Math.cos(rot) - (h / 2) * Math.sin(rot);
      sy += o.y + (w / 2) * Math.sin(rot) + (h / 2) * Math.cos(rot);
      cnt++;
    }
    if (cnt === 0) return { x: 250, y: 250 };
    return { x: sx / cnt, y: sy / cnt };
  }

  // ── 화살표 자동 그리기 ──
  function drawArrows() {
    const layer = CanvasEditor.getFlowLayer();
    layer.destroyChildren();

    const tasks = App.getState().layout.tasks;
    const objects = App.getState().layout.objects;
    const objMap = new Map(objects.map(o => [o.id, o]));
    const ppm = App.getState().layout.pixelsPerMeter || 50;
    const centroid = calcCentroid(tasks, objMap);

    for (let i = 0; i < tasks.length - 1; i++) {
      const fromObj = objMap.get(tasks[i].objectId);
      const toObj = objMap.get(tasks[i + 1].objectId);
      if (!fromObj || !toObj) continue;
      if (fromObj.id === toObj.id) continue;

      const fp = getAccessPoint(fromObj, centroid);
      const tp = getAccessPoint(toObj, centroid);

      const segDist = Math.sqrt((tp.x - fp.x) ** 2 + (tp.y - fp.y) ** 2) / ppm;

      layer.add(new Konva.Arrow({
        points: [fp.x, fp.y, tp.x, tp.y],
        stroke: '#D97756',
        strokeWidth: 2,
        fill: '#D97756',
        pointerLength: 8,
        pointerWidth: 6,
        opacity: 0.7,
        dash: [6, 3],
      }));

      // 구간 순번 + 거리 라벨
      const mx = (fp.x + tp.x) / 2;
      const my = (fp.y + tp.y) / 2;
      const labelText = (i + 1) + '  ' + segDist.toFixed(1) + 'm';
      const lbl = new Konva.Label({ x: mx, y: my - 10 });
      lbl.add(new Konva.Tag({
        fill: 'rgba(0,0,0,0.6)',
        cornerRadius: 3,
        pointerDirection: 'down',
        pointerWidth: 6,
        pointerHeight: 4,
      }));
      lbl.add(new Konva.Text({
        text: labelText,
        fontSize: 11,
        fill: '#fff',
        padding: 3,
        fontStyle: 'bold',
      }));
      layer.add(lbl);
    }

    // 작업 위치 표시 (작은 원)
    const drawnIds = new Set();
    for (const t of tasks) {
      const obj = objMap.get(t.objectId);
      if (!obj || drawnIds.has(obj.id)) continue;
      drawnIds.add(obj.id);
      const ap = getAccessPoint(obj, centroid);
      layer.add(new Konva.Circle({
        x: ap.x, y: ap.y,
        radius: 4,
        fill: '#D97756',
        opacity: 0.8,
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
    const centroid = calcCentroid(tasks, objMap);

    if (tasks.length === 0) {
      App.setMetrics(null);
      updateStatusFlow(null);
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

      const fp = getAccessPoint(fromObj, centroid);
      const tp = getAccessPoint(toObj, centroid);

      const dx = tp.x - fp.x;
      const dy = tp.y - fp.y;
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

    let bottleneck = null;
    let maxDur = 0;
    for (const t of tasks) {
      if ((t.duration || 0) > maxDur) {
        maxDur = t.duration;
        bottleneck = { stationId: t.objectId, stationLabel: t.name, time: maxDur };
      }
    }

    const metrics = {
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
    };
    App.setMetrics(metrics);
    updateStatusFlow(metrics);
  }

  function updateStatusFlow(m) {
    const el = document.getElementById('status-flow');
    const sep = document.getElementById('status-flow-sep');
    if (!el || !sep) return;
    if (!m || m.totalDistance === 0) {
      el.style.display = 'none';
      sep.style.display = 'none';
    } else {
      el.style.display = '';
      sep.style.display = '';
      el.textContent = '동선 ' + m.totalDistance + 'm (' + m.totalWalkTime + '초)';
    }
  }

  function debounce(fn, d) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), d); };
  }

  return { init, redraw };
})();
