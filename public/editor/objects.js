/**
 * ObjectFactory — 객체 생성, Konva 노드 매핑
 */
const ObjectFactory = (() => {
  // 타입별 기본 크기, 색상
  const DEFAULTS = {
    wall:       { w: 200, h: 10, color: '#6B7280', label: '벽' },
    door:       { w: 60, h: 10, color: '#10B981', label: '문' },
    window:     { w: 80, h: 10, color: '#93C5FD', label: '창문' },
    counter:    { w: 150, h: 60, color: '#8B5CF6', label: '카운터' },
    'gas-range':{ w: 90, h: 60, color: '#EF4444', label: '가스레인지' },
    sink:       { w: 60, h: 50, color: '#3B82F6', label: '싱크대' },
    'prep-table':{ w: 120, h: 60, color: '#F59E0B', label: '조리대' },
    fridge:     { w: 80, h: 70, color: '#06B6D4', label: '냉장고' },
    storage:    { w: 80, h: 60, color: '#6B7280', label: '보관함' },
  };

  const STATION_META = {
    'order-receive':  { label: '주문접수', color: '#3B82F6', defaultTime: 30 },
    'prep':           { label: '준비',     color: '#8B5CF6', defaultTime: 60 },
    'cook':           { label: '조리',     color: '#EF4444', defaultTime: 120 },
    'plate':          { label: '플레이팅', color: '#F59E0B', defaultTime: 45 },
    'pack':           { label: '포장',     color: '#10B981', defaultTime: 30 },
    'pickup':         { label: '픽업',     color: '#06B6D4', defaultTime: 15 },
    'delivery-out':   { label: '배달출고', color: '#6366F1', defaultTime: 20 },
  };

  let transformer = null;

  function init() {
    // Transformer for selection
    transformer = new Konva.Transformer({
      rotateEnabled: true,
      borderStroke: '#3B82F6',
      anchorStroke: '#3B82F6',
      anchorFill: '#fff',
      anchorSize: 8,
      padding: 2,
    });
    CanvasEditor.getObjectLayer().add(transformer);

    App.on('selection-changed', onSelectionChanged);
    App.on('layout-loaded', rebuildAll);
  }

  function createNode(obj) {
    const layer = CanvasEditor.getObjectLayer();

    if (obj.type === 'station') {
      return createStationNode(obj, layer);
    }

    const def = DEFAULTS[obj.type] || DEFAULTS.counter;
    const group = new Konva.Group({
      id: obj.id,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation || 0,
      draggable: true,
    });

    const rect = new Konva.Rect({
      width: obj.width || def.w,
      height: obj.height || def.h,
      fill: obj.color || def.color,
      cornerRadius: 4,
      opacity: 0.85,
    });

    const text = new Konva.Text({
      text: obj.label || def.label,
      width: obj.width || def.w,
      height: obj.height || def.h,
      align: 'center',
      verticalAlign: 'middle',
      fontSize: 11,
      fill: '#fff',
      listening: false,
    });

    group.add(rect);
    group.add(text);
    layer.add(group);

    // 그리드 스냅
    group.on('dragend', () => {
      const gs = CanvasEditor.getGridSize();
      const snappedX = CanvasEditor.snapToGrid(group.x());
      const snappedY = CanvasEditor.snapToGrid(group.y());
      group.position({ x: snappedX, y: snappedY });
      App.updateObject(obj.id, { x: snappedX, y: snappedY });
      History.push();
      layer.batchDraw();
    });

    // 클릭으로 선택
    group.on('click tap', (e) => {
      e.cancelBubble = true;
      const tool = App.getState().activeTool;
      if (tool === 'delete') {
        App.removeObject(obj.id);
        group.destroy();
        transformer.nodes([]);
        layer.batchDraw();
        History.push();
        return;
      }
      if (tool === 'flow' && obj.type === 'station') {
        // 동선 연결은 stations.js에서 처리
        App.emit('station-clicked', obj.id);
        return;
      }
      App.selectObject(obj.id);
    });

    // Transformer 리사이즈 반영
    group.on('transformend', () => {
      const scaleX = group.scaleX();
      const scaleY = group.scaleY();
      const newW = Math.max(10, rect.width() * scaleX);
      const newH = Math.max(10, rect.height() * scaleY);
      group.scaleX(1);
      group.scaleY(1);
      rect.width(newW);
      rect.height(newH);
      text.width(newW);
      text.height(newH);
      App.updateObject(obj.id, {
        x: group.x(), y: group.y(),
        width: newW, height: newH,
        rotation: group.rotation(),
      });
      History.push();
      layer.batchDraw();
    });

    return group;
  }

  function createStationNode(obj, layer) {
    const meta = STATION_META[obj.stationRole] || { label: '스테이션', color: '#6B7280', defaultTime: 30 };

    const group = new Konva.Group({
      id: obj.id,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation || 0,
      draggable: true,
    });

    const w = obj.width || 80;
    const h = obj.height || 80;

    // 원형 배경
    const circle = new Konva.Circle({
      x: w / 2,
      y: h / 2,
      radius: Math.min(w, h) / 2,
      fill: meta.color,
      opacity: 0.3,
      stroke: meta.color,
      strokeWidth: 2,
    });

    // 라벨
    const text = new Konva.Text({
      text: obj.label || meta.label,
      width: w,
      y: h / 2 - 8,
      align: 'center',
      fontSize: 12,
      fontStyle: 'bold',
      fill: '#fff',
      listening: false,
    });

    // 시간 표시
    const timeText = new Konva.Text({
      text: (obj.processingTime || meta.defaultTime) + '초',
      width: w,
      y: h / 2 + 6,
      align: 'center',
      fontSize: 10,
      fill: meta.color,
      listening: false,
    });

    group.add(circle);
    group.add(text);
    group.add(timeText);
    layer.add(group);

    group.on('dragend', () => {
      const snappedX = CanvasEditor.snapToGrid(group.x());
      const snappedY = CanvasEditor.snapToGrid(group.y());
      group.position({ x: snappedX, y: snappedY });
      App.updateObject(obj.id, { x: snappedX, y: snappedY });
      History.push();
      layer.batchDraw();
    });

    group.on('click tap', (e) => {
      e.cancelBubble = true;
      const tool = App.getState().activeTool;
      if (tool === 'delete') {
        App.removeObject(obj.id);
        group.destroy();
        transformer.nodes([]);
        layer.batchDraw();
        History.push();
        return;
      }
      if (tool === 'flow') {
        App.emit('station-clicked', obj.id);
        return;
      }
      App.selectObject(obj.id);
    });

    group.on('transformend', () => {
      const scaleX = group.scaleX();
      const scaleY = group.scaleY();
      group.scaleX(1);
      group.scaleY(1);
      const newR = Math.min(obj.width || 80, obj.height || 80) / 2 * Math.max(scaleX, scaleY);
      circle.radius(newR);
      App.updateObject(obj.id, {
        x: group.x(), y: group.y(),
        width: newR * 2, height: newR * 2,
        rotation: group.rotation(),
      });
      History.push();
      layer.batchDraw();
    });

    return group;
  }

  function onSelectionChanged(id) {
    const layer = CanvasEditor.getObjectLayer();
    if (!id) {
      transformer.nodes([]);
      layer.batchDraw();
      return;
    }
    const node = layer.findOne('#' + id);
    if (node) {
      transformer.nodes([node]);
      node.moveToTop();
      transformer.moveToTop();
      layer.batchDraw();
    }
  }

  function rebuildAll(layout) {
    const layer = CanvasEditor.getObjectLayer();
    // 기존 객체 제거 (transformer 유지)
    layer.children.forEach(c => {
      if (c !== transformer) c.destroy();
    });
    transformer.nodes([]);

    for (const obj of layout.objects) {
      createNode(obj);
    }
    transformer.moveToTop();
    layer.batchDraw();
  }

  function findNode(id) {
    return CanvasEditor.getObjectLayer().findOne('#' + id);
  }

  function updateNodeVisual(obj) {
    const node = findNode(obj.id);
    if (!node) return;
    node.position({ x: obj.x, y: obj.y });
    node.rotation(obj.rotation || 0);
    CanvasEditor.getObjectLayer().batchDraw();
  }

  return { init, createNode, findNode, updateNodeVisual, DEFAULTS, STATION_META };
})();
