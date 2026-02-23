/**
 * FlowPathManager — 동선 경로 화살표 그리기
 */
const FlowPathManager = (() => {
  let connectFromId = null;
  let previewLine = null;

  function init() {
    App.on('station-clicked', onStationClicked);
    App.on('flow-added', drawFlowPath);
    App.on('flow-removed', removeFlowPathVisual);
    App.on('layout-loaded', rebuildFlows);
    App.on('layout-changed', refreshFlows);
    App.on('tool-changed', (tool) => {
      if (tool !== 'flow') {
        connectFromId = null;
        clearPreview();
      }
    });

    // 마우스 이동 시 연결 프리뷰
    const stage = CanvasEditor.getStage();
    stage.on('mousemove', () => {
      if (!connectFromId || App.getState().activeTool !== 'flow') return;
      drawPreviewLine();
    });
  }

  function onStationClicked(stationId) {
    if (App.getState().activeTool !== 'flow') return;

    const station = Stations.getStation(stationId);
    if (!station) return;

    if (!connectFromId) {
      // 시작점 설정
      connectFromId = stationId;
      highlightStation(stationId, true);
    } else if (connectFromId !== stationId) {
      // 동선 연결 완성
      const fp = {
        id: App.genId(),
        fromStationId: connectFromId,
        toStationId: stationId,
        waypoints: [],
      };
      App.addFlowPath(fp);
      highlightStation(connectFromId, false);
      connectFromId = null;
      clearPreview();
      History.push();
      MetricsPanel.recalculate();
    }
  }

  function drawFlowPath(fp) {
    const layer = CanvasEditor.getFlowLayer();
    const from = Stations.getStation(fp.fromStationId);
    const to = Stations.getStation(fp.toStationId);
    if (!from || !to) return;

    const points = buildPoints(from, to, fp.waypoints);

    const arrow = new Konva.Arrow({
      id: 'flow-' + fp.id,
      points,
      stroke: '#F59E0B',
      strokeWidth: 3,
      fill: '#F59E0B',
      pointerLength: 10,
      pointerWidth: 8,
      opacity: 0.8,
      lineCap: 'round',
      lineJoin: 'round',
      dash: [8, 4],
      hitStrokeWidth: 15,
    });

    // 클릭으로 삭제 (delete 도구)
    arrow.on('click tap', (e) => {
      e.cancelBubble = true;
      if (App.getState().activeTool === 'delete') {
        App.removeFlowPath(fp.id);
        History.push();
        MetricsPanel.recalculate();
      }
    });

    layer.add(arrow);
    layer.batchDraw();
  }

  function removeFlowPathVisual(fpId) {
    const layer = CanvasEditor.getFlowLayer();
    const node = layer.findOne('#flow-' + fpId);
    if (node) {
      node.destroy();
      layer.batchDraw();
    }
  }

  function rebuildFlows(layout) {
    const layer = CanvasEditor.getFlowLayer();
    layer.destroyChildren();
    for (const fp of layout.flowPaths) {
      drawFlowPath(fp);
    }
    layer.batchDraw();
  }

  function refreshFlows() {
    const layout = App.getState().layout;
    const layer = CanvasEditor.getFlowLayer();
    // 위치 업데이트
    for (const fp of layout.flowPaths) {
      const from = Stations.getStation(fp.fromStationId);
      const to = Stations.getStation(fp.toStationId);
      if (!from || !to) continue;

      const node = layer.findOne('#flow-' + fp.id);
      if (node) {
        node.points(buildPoints(from, to, fp.waypoints));
      }
    }
    layer.batchDraw();
  }

  function buildPoints(from, to, waypoints) {
    const fx = from.x + (from.width || 80) / 2;
    const fy = from.y + (from.height || 80) / 2;
    const tx = to.x + (to.width || 80) / 2;
    const ty = to.y + (to.height || 80) / 2;

    const pts = [fx, fy];
    for (const wp of (waypoints || [])) {
      pts.push(wp.x, wp.y);
    }
    pts.push(tx, ty);
    return pts;
  }

  function drawPreviewLine() {
    clearPreview();
    const from = Stations.getStation(connectFromId);
    if (!from) return;
    const pos = CanvasEditor.getCanvasPointer();
    if (!pos) return;

    const fx = from.x + (from.width || 80) / 2;
    const fy = from.y + (from.height || 80) / 2;

    previewLine = new Konva.Arrow({
      points: [fx, fy, pos.x, pos.y],
      stroke: '#F59E0B',
      strokeWidth: 2,
      fill: '#F59E0B',
      pointerLength: 8,
      pointerWidth: 6,
      opacity: 0.4,
      dash: [6, 3],
    });
    CanvasEditor.getUILayer().add(previewLine);
    CanvasEditor.getUILayer().batchDraw();
  }

  function clearPreview() {
    if (previewLine) {
      previewLine.destroy();
      previewLine = null;
      CanvasEditor.getUILayer().batchDraw();
    }
  }

  function highlightStation(id, on) {
    const node = ObjectFactory.findNode(id);
    if (!node) return;
    const circle = node.findOne('Circle');
    if (circle) {
      circle.opacity(on ? 0.6 : 0.3);
      circle.strokeWidth(on ? 4 : 2);
      CanvasEditor.getObjectLayer().batchDraw();
    }
  }

  return { init };
})();
