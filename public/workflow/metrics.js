/**
 * MetricsPanel — 실시간 동선 분석 메트릭
 * 클라이언트에서 동일한 알고리즘으로 계산 (서버 왕복 없이)
 */
const MetricsPanel = (() => {
  function init() {
    App.on('layout-changed', debounce(recalculate, 500));
    App.on('metrics-updated', updateUI);
  }

  function recalculate() {
    const layout = App.getState().layout;
    const stations = layout.objects.filter(o => o.type === 'station');
    const flowPaths = layout.flowPaths;
    const ppm = layout.pixelsPerMeter || 50;

    if (stations.length === 0 || flowPaths.length === 0) {
      App.setMetrics(null);
      return;
    }

    const stationMap = new Map(stations.map(s => [s.id, s]));
    const segments = [];
    let totalDistance = 0;
    let totalDirectionChanges = 0;

    for (const path of flowPaths) {
      const from = stationMap.get(path.fromStationId);
      const to = stationMap.get(path.toStationId);
      if (!from || !to) continue;

      const points = [
        { x: from.x + (from.width || 80) / 2, y: from.y + (from.height || 80) / 2 },
        ...(path.waypoints || []),
        { x: to.x + (to.width || 80) / 2, y: to.y + (to.height || 80) / 2 },
      ];

      let dist = 0;
      let prevAngle = null;

      for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dy = points[i].y - points[i - 1].y;
        dist += Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        if (prevAngle !== null) {
          let diff = Math.abs(angle - prevAngle);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          if (diff > Math.PI / 6) totalDirectionChanges++;
        }
        prevAngle = angle;
      }

      const distMeters = dist / ppm;
      const walkTime = distMeters / 1.2;
      totalDistance += distMeters;

      const meta = ObjectFactory.STATION_META;
      segments.push({
        from: from.label || (meta[from.stationRole]?.label) || from.id,
        to: to.label || (meta[to.stationRole]?.label) || to.id,
        distance: Math.round(distMeters * 100) / 100,
        walkTime: Math.round(walkTime * 10) / 10,
      });
    }

    // 교차 수 계산
    const crossings = countCrossings(flowPaths, stationMap);
    const totalWalkTime = totalDistance / 1.2;
    const totalProcessingTime = stations.reduce((s, st) => s + (st.processingTime || 0), 0);
    const totalCycleTime = totalWalkTime + totalProcessingTime;
    const complexityScore = Math.min(100, Math.round(
      (totalDirectionChanges * 5) + (crossings * 15) + (totalDistance * 2)
    ));

    let bottleneck = null;
    let maxTime = 0;
    for (const s of stations) {
      if ((s.processingTime || 0) > maxTime) {
        maxTime = s.processingTime || 0;
        const meta = ObjectFactory.STATION_META[s.stationRole];
        bottleneck = {
          stationId: s.id,
          stationLabel: s.label || meta?.label || s.id,
          time: maxTime,
        };
      }
    }

    const metrics = {
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalWalkTime: Math.round(totalWalkTime * 10) / 10,
      totalCycleTime: Math.round(totalCycleTime * 10) / 10,
      complexityScore,
      directionChanges: totalDirectionChanges,
      crossings,
      bottleneck,
      segments,
    };

    App.setMetrics(metrics);
  }

  function countCrossings(paths, stationMap) {
    const segs = [];
    for (const path of paths) {
      const from = stationMap.get(path.fromStationId);
      const to = stationMap.get(path.toStationId);
      if (!from || !to) continue;
      const pts = [
        { x: from.x + (from.width || 80) / 2, y: from.y + (from.height || 80) / 2 },
        ...(path.waypoints || []),
        { x: to.x + (to.width || 80) / 2, y: to.y + (to.height || 80) / 2 },
      ];
      for (let i = 1; i < pts.length; i++) {
        segs.push({ x1: pts[i-1].x, y1: pts[i-1].y, x2: pts[i].x, y2: pts[i].y });
      }
    }
    let crossings = 0;
    for (let i = 0; i < segs.length; i++) {
      for (let j = i + 2; j < segs.length; j++) {
        if (intersects(segs[i], segs[j])) crossings++;
      }
    }
    return crossings;
  }

  function intersects(a, b) {
    const d1 = dir(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
    const d2 = dir(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
    const d3 = dir(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
    const d4 = dir(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
           ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }

  function dir(ax, ay, bx, by, cx, cy) {
    return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  }

  function updateUI(metrics) {
    document.getElementById('metric-distance').textContent = metrics ? metrics.totalDistance + 'm' : '-';
    document.getElementById('metric-walk-time').textContent = metrics ? metrics.totalWalkTime + '초' : '-';
    document.getElementById('metric-cycle-time').textContent = metrics ? metrics.totalCycleTime + '초' : '-';
    document.getElementById('metric-complexity').textContent = metrics ? metrics.complexityScore + '/100' : '-';
    document.getElementById('metric-direction').textContent = metrics ? metrics.directionChanges + '회' : '-';
    document.getElementById('metric-crossings').textContent = metrics ? metrics.crossings + '회' : '-';

    const bnEl = document.getElementById('metric-bottleneck');
    if (metrics?.bottleneck) {
      bnEl.textContent = `${metrics.bottleneck.stationLabel} (${metrics.bottleneck.time}초)`;
    } else {
      bnEl.textContent = '-';
    }

    const segEl = document.getElementById('metric-segments');
    if (metrics?.segments?.length > 0) {
      segEl.innerHTML = metrics.segments.map(s =>
        `<div class="segment-row">${s.from} → ${s.to}: ${s.distance}m / ${s.walkTime}초</div>`
      ).join('');
    } else {
      segEl.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">동선 경로가 없습니다.</p>';
    }
  }

  function debounce(fn, delay) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); };
  }

  return { init, recalculate };
})();
