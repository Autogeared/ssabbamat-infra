/**
 * ObjectFactory — 객체 생성, Konva 노드 매핑
 */
const ObjectFactory = (() => {
  // 타입별 기본 크기 (50px = 1m 기준), 색상
  const DEFAULTS = {
    wall:       { w: 200, h: 0, color: '#222222', label: '벽' },
    door:       { w: 50, h: 5, color: '#7DB87D', label: '문' },
    window:     { w: 50, h: 5, color: '#89AFC4', label: '창문' },
    counter:    { w: 150, h: 50, color: '#A67C52', label: '카운터' },
    'gas-range':{ w: 50, h: 50, color: '#D97756', label: '가스레인지' },
    sink:       { w: 50, h: 50, color: '#6A9AB5', label: '싱크대' },
    'prep-table':{ w: 100, h: 50, color: '#C4976A', label: '조리대' },
    fridge:     { w: 50, h: 50, color: '#5B8FA8', label: '냉장고' },
    storage:    { w: 50, h: 50, color: '#7A6E62', label: '보관함' },
  };

  const STATION_META = {
    'order-receive':  { label: '주문접수', color: '#6A9AB5', defaultTime: 30 },
    'prep':           { label: '준비',     color: '#9B7DB8', defaultTime: 60 },
    'cook':           { label: '조리',     color: '#D97756', defaultTime: 120 },
    'plate':          { label: '플레이팅', color: '#E5A84B', defaultTime: 45 },
    'pack':           { label: '포장',     color: '#7DB87D', defaultTime: 30 },
    'pickup':         { label: '픽업',     color: '#5B8FA8', defaultTime: 15 },
    'delivery-out':   { label: '배달출고', color: '#8B7EC8', defaultTime: 20 },
  };

  let transformer = null;
  let _dimLabel = null; // 임시 치수 라벨

  const PPM = 50; // 50px = 1m

  /** 호버 프리하이라이트 공통 적용 */
  function applyHover(group) {
    let origStroke, origStrokeWidth;

    group.on('mouseenter', () => {
      // 이미 선택된(Transformer) 객체이면 스킵
      if (transformer.nodes().indexOf(group) !== -1) return;
      const shape = group.children && group.children[0];
      if (!shape) return;
      origStroke = shape.stroke();
      origStrokeWidth = shape.strokeWidth();
      shape.stroke('#0d99ff');
      shape.strokeWidth(2);
      group.getLayer().batchDraw();
    });

    group.on('mouseleave', () => {
      const shape = group.children && group.children[0];
      if (!shape) return;
      if (origStroke !== undefined) shape.stroke(origStroke);
      if (origStrokeWidth !== undefined) shape.strokeWidth(origStrokeWidth);
      origStroke = undefined;
      origStrokeWidth = undefined;
      group.getLayer().batchDraw();
    });
  }

  /** 드래그/리사이즈 치수 라벨 생성 */
  function showDimLabel(text, group) {
    removeDimLabel();
    const uiLayer = CanvasEditor.getUILayer();
    _dimLabel = new Konva.Label({ listening: false });
    _dimLabel.add(new Konva.Tag({
      fill: 'rgba(44,36,24,0.85)',
      cornerRadius: 4,
      pointerDirection: 'up',
      pointerWidth: 6,
      pointerHeight: 4,
    }));
    _dimLabel.add(new Konva.Text({
      text: text,
      fontSize: 11,
      fill: '#fff',
      padding: 4,
    }));
    // 객체 아래 중앙
    const box = group.getClientRect({ relativeTo: group.getLayer() });
    _dimLabel.position({
      x: box.x + box.width / 2,
      y: box.y + box.height + 8,
    });
    uiLayer.add(_dimLabel);
    uiLayer.batchDraw();
  }

  function removeDimLabel() {
    if (_dimLabel) {
      _dimLabel.destroy();
      _dimLabel = null;
      CanvasEditor.getUILayer().batchDraw();
    }
  }

  // ── Smart Guides ──
  const GUIDE_SNAP_THRESHOLD = 5; // px
  let _guideLines = [];
  let _cachedBoxes = null;

  function cacheOtherBoxes(excludeId) {
    const layer = CanvasEditor.getObjectLayer();
    _cachedBoxes = [];
    layer.children.forEach(node => {
      if (node.getClassName() === 'Transformer') return;
      if (node.id() === excludeId) return;
      if (!node.visible()) return;
      const box = node.getClientRect({ relativeTo: layer });
      _cachedBoxes.push({
        left: box.x,
        right: box.x + box.width,
        top: box.y,
        bottom: box.y + box.height,
        cx: box.x + box.width / 2,
        cy: box.y + box.height / 2,
      });
    });
  }

  function clearGuides() {
    _guideLines.forEach(l => l.destroy());
    _guideLines = [];
    _cachedBoxes = null;
  }

  function showSmartGuides(group) {
    // 기존 가이드 제거
    _guideLines.forEach(l => l.destroy());
    _guideLines = [];

    if (!_cachedBoxes) return;

    const layer = CanvasEditor.getObjectLayer();
    const uiLayer = CanvasEditor.getUILayer();
    const box = group.getClientRect({ relativeTo: layer });
    const me = {
      left: box.x,
      right: box.x + box.width,
      top: box.y,
      bottom: box.y + box.height,
      cx: box.x + box.width / 2,
      cy: box.y + box.height / 2,
    };

    const CANVAS = 500; // CANVAS_PX
    let snapDx = null, snapDy = null;

    for (const other of _cachedBoxes) {
      // 수직 정렬 (X축)
      const xPairs = [
        [me.left, other.left], [me.right, other.right],
        [me.cx, other.cx],
        [me.left, other.right], [me.right, other.left],
      ];
      for (const [mv, ov] of xPairs) {
        if (Math.abs(mv - ov) < GUIDE_SNAP_THRESHOLD) {
          if (snapDx === null) snapDx = ov - mv;
          _guideLines.push(new Konva.Line({
            points: [ov, 0, ov, CANVAS],
            stroke: '#0d99ff',
            strokeWidth: 1,
            dash: [4, 4],
            listening: false,
          }));
        }
      }
      // 수평 정렬 (Y축)
      const yPairs = [
        [me.top, other.top], [me.bottom, other.bottom],
        [me.cy, other.cy],
        [me.top, other.bottom], [me.bottom, other.top],
      ];
      for (const [mv, ov] of yPairs) {
        if (Math.abs(mv - ov) < GUIDE_SNAP_THRESHOLD) {
          if (snapDy === null) snapDy = ov - mv;
          _guideLines.push(new Konva.Line({
            points: [0, ov, CANVAS, ov],
            stroke: '#0d99ff',
            strokeWidth: 1,
            dash: [4, 4],
            listening: false,
          }));
        }
      }
    }

    // 스냅 적용
    if (snapDx !== null || snapDy !== null) {
      group.position({
        x: group.x() + (snapDx || 0),
        y: group.y() + (snapDy || 0),
      });
    }

    // 가이드 라인 그리기
    _guideLines.forEach(l => uiLayer.add(l));
    if (_guideLines.length > 0) uiLayer.batchDraw();
  }

  function init() {
    // Transformer for selection
    transformer = new Konva.Transformer({
      rotateEnabled: true,
      borderStroke: '#D97756',
      anchorStroke: '#D97756',
      anchorFill: '#ece5de',
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
    if (obj.type === 'wall') {
      return createWallNode(obj, layer);
    }

    const def = DEFAULTS[obj.type] || DEFAULTS.counter;
    const w = obj.width || def.w;
    const h = obj.height || def.h;
    const group = new Konva.Group({
      id: obj.id,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation || 0,
      draggable: true,
    });

    const rect = new Konva.Rect({
      width: w,
      height: h,
      fill: obj.color || def.color,
      cornerRadius: 0,
      opacity: 0.85,
      stroke: '#00000022',
      strokeWidth: 1,
    });

    const text = new Konva.Text({
      text: obj.label || def.label,
      width: w,
      height: h,
      align: 'center',
      verticalAlign: 'middle',
      fontSize: 11,
      fill: '#fff',
      listening: false,
    });

    group.add(rect);
    group.add(text);
    layer.add(group);
    applyHover(group);

    // 드래그 중 스냅 + 스마트 가이드 + 치수 라벨
    group.on('dragstart', () => { cacheOtherBoxes(obj.id); });
    group.on('dragmove', () => {
      group.position({
        x: CanvasEditor.snapToGrid(group.x()),
        y: CanvasEditor.snapToGrid(group.y()),
      });
      showSmartGuides(group);
      showDimLabel(
        `(${(group.x() / PPM).toFixed(1)}m, ${(group.y() / PPM).toFixed(1)}m)`,
        group
      );
    });
    group.on('dragend', () => {
      clearGuides();
      CanvasEditor.getUILayer().batchDraw();
      removeDimLabel();
      App.updateObject(obj.id, { x: group.x(), y: group.y() });
      History.push();
    });

    // 클릭으로 선택 (Shift+Click 다중 선택)
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
      handleClickSelect(group, obj.id, e);
    });

    // 리사이즈 중 치수 라벨
    group.on('transform', () => {
      const curW = Math.max(10, rect.width() * group.scaleX());
      const curH = Math.max(10, rect.height() * group.scaleY());
      showDimLabel(
        `${(curW / PPM).toFixed(1)}m × ${(curH / PPM).toFixed(1)}m`,
        group
      );
    });

    // Transformer 리사이즈 반영
    group.on('transformend', () => {
      removeDimLabel();
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

  function createWallNode(obj, layer) {
    const group = new Konva.Group({
      id: obj.id,
      x: obj.x,
      y: obj.y,
      rotation: obj.rotation || 0,
      draggable: true,
    });

    // 벽 = 격자 위 검정 실선
    const w = (obj.width != null) ? obj.width : 200;
    const h = (obj.height != null) ? obj.height : 0;
    const isHorizontal = w >= h;

    const line = new Konva.Line({
      points: isHorizontal ? [0, 0, w, 0] : [0, 0, 0, h],
      stroke: '#222222',
      strokeWidth: 1,
      lineCap: 'square',
      hitStrokeWidth: 12,
    });

    group.add(line);
    layer.add(group);
    applyHover(group);

    group.on('dragstart', () => { cacheOtherBoxes(obj.id); });
    group.on('dragmove', () => {
      group.position({
        x: CanvasEditor.snapToGrid(group.x()),
        y: CanvasEditor.snapToGrid(group.y()),
      });
      showSmartGuides(group);
      showDimLabel(
        `(${(group.x() / PPM).toFixed(1)}m, ${(group.y() / PPM).toFixed(1)}m)`,
        group
      );
    });
    group.on('dragend', () => {
      clearGuides();
      CanvasEditor.getUILayer().batchDraw();
      removeDimLabel();
      App.updateObject(obj.id, { x: group.x(), y: group.y() });
      History.push();
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
      handleClickSelect(group, obj.id, e);
    });

    group.on('transform', () => {
      const pts = line.points();
      const curW = Math.abs(pts[2] - pts[0]) * group.scaleX();
      const curH = Math.abs(pts[3] - pts[1]) * group.scaleY();
      const len = Math.max(curW, curH);
      showDimLabel(`${(len / PPM).toFixed(1)}m`, group);
    });

    group.on('transformend', () => {
      removeDimLabel();
      const scaleX = group.scaleX();
      const scaleY = group.scaleY();
      const pts = line.points();
      const newPts = pts.map((v, i) => v * (i % 2 === 0 ? scaleX : scaleY));
      group.scaleX(1);
      group.scaleY(1);
      line.points(newPts);
      const newW = Math.abs(newPts[2] - newPts[0]) || 0;
      const newH = Math.abs(newPts[3] - newPts[1]) || 0;
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
    applyHover(group);

    // 드래그 중 스냅 + 스마트 가이드 + 치수 라벨
    group.on('dragstart', () => { cacheOtherBoxes(obj.id); });
    group.on('dragmove', () => {
      group.position({
        x: CanvasEditor.snapToGrid(group.x()),
        y: CanvasEditor.snapToGrid(group.y()),
      });
      showSmartGuides(group);
      showDimLabel(
        `(${(group.x() / PPM).toFixed(1)}m, ${(group.y() / PPM).toFixed(1)}m)`,
        group
      );
    });
    group.on('dragend', () => {
      clearGuides();
      CanvasEditor.getUILayer().batchDraw();
      removeDimLabel();
      App.updateObject(obj.id, { x: group.x(), y: group.y() });
      History.push();
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
      handleClickSelect(group, obj.id, e);
    });

    group.on('transform', () => {
      const curR = Math.min(obj.width || 80, obj.height || 80) / 2 * Math.max(group.scaleX(), group.scaleY());
      const d = curR * 2;
      showDimLabel(`${(d / PPM).toFixed(1)}m × ${(d / PPM).toFixed(1)}m`, group);
    });

    group.on('transformend', () => {
      removeDimLabel();
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

  /** Shift+Click 다중 선택 처리 */
  function handleClickSelect(group, id, e) {
    const shiftKey = e.evt && e.evt.shiftKey;
    const layer = CanvasEditor.getObjectLayer();

    if (shiftKey) {
      // 토글 방식 추가/제거
      const currentNodes = transformer.nodes().slice();
      const idx = currentNodes.indexOf(group);
      if (idx !== -1) {
        currentNodes.splice(idx, 1);
      } else {
        currentNodes.push(group);
      }
      transformer.nodes(currentNodes);
      transformer.moveToTop();
      layer.batchDraw();
      // App 상태는 마지막 추가된 것으로
      if (currentNodes.length > 0) {
        App.selectObject(currentNodes[currentNodes.length - 1].id());
      } else {
        App.selectObject(null);
      }
    } else {
      App.selectObject(id);
    }
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

    if (obj.type === 'wall') {
      const line = node.findOne('Line');
      if (line) {
        const w = obj.width || 0;
        const h = obj.height || 0;
        const isH = w >= h;
        line.points(isH ? [0, 0, w, 0] : [0, 0, 0, h]);
      }
    } else if (obj.type === 'station') {
      const circle = node.findOne('Circle');
      if (circle) {
        const r = Math.min(obj.width || 80, obj.height || 80) / 2;
        circle.radius(r);
        circle.x(r);
        circle.y(r);
      }
      const texts = node.find('Text');
      if (texts[0]) { texts[0].width(obj.width || 80); texts[0].y((obj.height || 80) / 2 - 8); }
      if (texts[1]) { texts[1].width(obj.width || 80); texts[1].y((obj.height || 80) / 2 + 6); }
    } else {
      const rect = node.findOne('Rect');
      if (rect) {
        rect.width(obj.width);
        rect.height(obj.height);
      }
      const text = node.findOne('Text');
      if (text) {
        text.width(obj.width);
        text.height(obj.height);
        if (obj.label !== undefined) text.text(obj.label);
      }
    }

    // transformer 갱신
    if (transformer.nodes().length > 0 && transformer.nodes()[0] === node) {
      transformer.forceUpdate();
    }
    CanvasEditor.getObjectLayer().batchDraw();
  }

  return { init, createNode, findNode, updateNodeVisual, DEFAULTS, STATION_META };
})();
