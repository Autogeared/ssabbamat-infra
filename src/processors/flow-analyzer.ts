import type { Layout, FlowMetrics, FloorObject, FlowPath } from '../types';

export function analyzeFlow(layout: Layout): FlowMetrics {
  const { objects, flowPaths, pixelsPerMeter } = layout;
  const ppm = pixelsPerMeter || 50;

  const stations = objects.filter(o => o.type === 'station' && o.stationRole);
  const stationMap = new Map(stations.map(s => [s.id, s]));

  const segments: FlowMetrics['segments'] = [];
  let totalDistance = 0;
  let totalDirectionChanges = 0;

  for (const path of flowPaths) {
    const from = stationMap.get(path.fromStationId);
    const to = stationMap.get(path.toStationId);
    if (!from || !to) continue;

    const points = [
      { x: from.x + from.width / 2, y: from.y + from.height / 2 },
      ...path.waypoints,
      { x: to.x + to.width / 2, y: to.y + to.height / 2 },
    ];

    let dist = 0;
    let prevAngle: number | null = null;

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
    const walkTime = distMeters / 1.2; // 1.2 m/s 평균 보행 속도

    totalDistance += distMeters;
    segments.push({
      from: from.label || from.stationRole || from.id,
      to: to.label || to.stationRole || to.id,
      distance: Math.round(distMeters * 100) / 100,
      walkTime: Math.round(walkTime * 10) / 10,
    });
  }

  // 동선 교차 계산
  const crossings = countCrossings(flowPaths, stationMap);

  // 보행 시간
  const totalWalkTime = totalDistance / 1.2;

  // 처리 시간 합산
  const totalProcessingTime = stations.reduce((sum, s) => sum + (s.processingTime || 0), 0);
  const totalCycleTime = totalWalkTime + totalProcessingTime;

  // 복잡도 점수 (0~100, 낮을수록 좋음)
  const complexityScore = Math.min(100, Math.round(
    (totalDirectionChanges * 5) + (crossings * 15) + (totalDistance * 2)
  ));

  // 병목 식별
  let bottleneck: FlowMetrics['bottleneck'] = null;
  let maxTime = 0;
  for (const s of stations) {
    const time = s.processingTime || 0;
    if (time > maxTime) {
      maxTime = time;
      bottleneck = {
        stationId: s.id,
        stationLabel: s.label || s.stationRole || s.id,
        time,
      };
    }
  }

  return {
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalWalkTime: Math.round(totalWalkTime * 10) / 10,
    totalCycleTime: Math.round(totalCycleTime * 10) / 10,
    complexityScore,
    directionChanges: totalDirectionChanges,
    crossings,
    bottleneck,
    segments,
  };
}

function countCrossings(paths: FlowPath[], stationMap: Map<string, FloorObject>): number {
  const lineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (const path of paths) {
    const from = stationMap.get(path.fromStationId);
    const to = stationMap.get(path.toStationId);
    if (!from || !to) continue;

    const points = [
      { x: from.x + from.width / 2, y: from.y + from.height / 2 },
      ...path.waypoints,
      { x: to.x + to.width / 2, y: to.y + to.height / 2 },
    ];

    for (let i = 1; i < points.length; i++) {
      lineSegments.push({
        x1: points[i - 1].x, y1: points[i - 1].y,
        x2: points[i].x, y2: points[i].y,
      });
    }
  }

  let crossings = 0;
  for (let i = 0; i < lineSegments.length; i++) {
    for (let j = i + 2; j < lineSegments.length; j++) {
      if (segmentsIntersect(lineSegments[i], lineSegments[j])) {
        crossings++;
      }
    }
  }
  return crossings;
}

function segmentsIntersect(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const d1 = direction(b.x1, b.y1, b.x2, b.y2, a.x1, a.y1);
  const d2 = direction(b.x1, b.y1, b.x2, b.y2, a.x2, a.y2);
  const d3 = direction(a.x1, a.y1, a.x2, a.y2, b.x1, b.y1);
  const d4 = direction(a.x1, a.y1, a.x2, a.y2, b.x2, b.y2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
      ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true;
  }
  return false;
}

function direction(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}
