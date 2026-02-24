/**
 * Tools — 도구 시스템 (선택, 벽그리기, 배치, 삭제)
 */
const Tools = (() => {
  let wallStartPos = null;
  let wallPreview = null;
  let clipboard = null; // 복사된 객체
  let selRect = null;   // 드래그 선택 사각형
  let selStartPos = null;

  function init() {
    App.on('tool-changed', onToolChanged);
    setupWallDrawing();
    setupMarqueeSelect();
    setupCanvasClick();
    setupDrop();
    setupKeyboard();
    setupContextMenu();
  }

  const TOOL_LABELS = { select: '선택', wall: '벽 그리기', place: '배치', delete: '삭제' };

  function onToolChanged(tool) {
    const stage = CanvasEditor.getStage();
    const container = stage.container();

    // 벽 그리기 프리뷰 정리
    if (wallPreview) {
      wallPreview.destroy();
      wallPreview = null;
      wallStartPos = null;
    }
    // 드래그 선택 정리
    if (selRect) {
      selRect.destroy();
      selRect = null;
      selStartPos = null;
    }
    CanvasEditor.getUILayer().batchDraw();

    // 커서 변경
    switch (tool) {
      case 'select': container.style.cursor = 'default'; break;
      case 'wall': container.style.cursor = 'crosshair'; break;
      case 'place': container.style.cursor = 'copy'; break;
      case 'delete': container.style.cursor = 'not-allowed'; break;
    }

    // 상태바 도구명 업데이트
    const toolEl = document.getElementById('status-tool');
    if (toolEl) toolEl.textContent = TOOL_LABELS[tool] || tool;

    // 선택 도구가 아닌 경우 선택 해제
    if (tool !== 'select') {
      App.selectObject(null);
    }
  }

  function setupWallDrawing() {
    const stage = CanvasEditor.getStage();

    stage.on('mousedown touchstart', (e) => {
      if (App.getState().activeTool !== 'wall') return;
      if (e.target !== stage) return;

      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      wallStartPos = {
        x: CanvasEditor.snapToGrid(pos.x),
        y: CanvasEditor.snapToGrid(pos.y),
      };

      wallPreview = new Konva.Line({
        points: [wallStartPos.x, wallStartPos.y, wallStartPos.x, wallStartPos.y],
        stroke: '#222222',
        strokeWidth: 1,
        opacity: 0.5,
        lineCap: 'square',
      });
      CanvasEditor.getUILayer().add(wallPreview);
    });

    stage.on('mousemove touchmove', () => {
      if (!wallPreview || !wallStartPos) return;
      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      const endX = CanvasEditor.snapToGrid(pos.x);
      const endY = CanvasEditor.snapToGrid(pos.y);

      // 수평 또는 수직 강제 — 더 많이 움직인 축으로 고정
      const dx = Math.abs(endX - wallStartPos.x);
      const dy = Math.abs(endY - wallStartPos.y);
      let finalX, finalY;
      if (dx >= dy) {
        // 가로
        finalX = endX;
        finalY = wallStartPos.y;
      } else {
        // 세로
        finalX = wallStartPos.x;
        finalY = endY;
      }

      wallPreview.points([wallStartPos.x, wallStartPos.y, finalX, finalY]);
      CanvasEditor.getUILayer().batchDraw();
    });

    stage.on('mouseup touchend', () => {
      if (!wallPreview || !wallStartPos) return;
      const pts = wallPreview.points();
      const dx = Math.abs(pts[2] - pts[0]);
      const dy = Math.abs(pts[3] - pts[1]);
      const length = Math.max(dx, dy);

      wallPreview.destroy();
      wallPreview = null;
      CanvasEditor.getUILayer().batchDraw();

      if (length < 10) {
        wallStartPos = null;
        return;
      }

      // 가로벽: width=길이, height=0 / 세로벽: width=0, height=길이
      const obj = {
        id: App.genId(),
        type: 'wall',
        x: Math.min(pts[0], pts[2]),
        y: Math.min(pts[1], pts[3]),
        width: dx,
        height: dy,
        rotation: 0,
        label: '벽',
        color: '#222222',
      };

      App.addObject(obj);
      ObjectFactory.createNode(obj);
      History.push();
      wallStartPos = null;
    });
  }

  function setupMarqueeSelect() {
    const stage = CanvasEditor.getStage();

    stage.on('mousedown touchstart', (e) => {
      if (App.getState().activeTool !== 'select') return;
      if (e.target !== stage) return;

      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      selStartPos = { x: pos.x, y: pos.y };
      selRect = new Konva.Rect({
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        stroke: '#D97756',
        strokeWidth: 1,
        dash: [4, 4],
        fill: 'rgba(217, 119, 86, 0.1)',
      });
      CanvasEditor.getUILayer().add(selRect);
    });

    stage.on('mousemove touchmove', () => {
      if (!selRect || !selStartPos) return;
      if (App.getState().activeTool !== 'select') return;

      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      const x = Math.min(selStartPos.x, pos.x);
      const y = Math.min(selStartPos.y, pos.y);
      const w = Math.abs(pos.x - selStartPos.x);
      const h = Math.abs(pos.y - selStartPos.y);

      selRect.setAttrs({ x, y, width: w, height: h });
      CanvasEditor.getUILayer().batchDraw();
    });

    stage.on('mouseup touchend', () => {
      if (!selRect || !selStartPos) return;
      if (App.getState().activeTool !== 'select') return;

      const rx = selRect.x();
      const ry = selRect.y();
      const rw = selRect.width();
      const rh = selRect.height();

      selRect.destroy();
      selRect = null;
      selStartPos = null;
      CanvasEditor.getUILayer().batchDraw();

      // 너무 작으면 무시 (클릭으로 간주)
      if (rw < 5 && rh < 5) return;

      // 선택 영역과 겹치는 모든 객체 찾기 (벽 등 얇은 객체는 패딩 추가)
      const objectLayer = CanvasEditor.getObjectLayer();
      const PAD = 6;
      const matched = [];
      objectLayer.children.forEach(node => {
        if (node.getClassName() === 'Transformer') return;
        const box = node.getClientRect({ relativeTo: objectLayer });
        const bx = box.x - PAD;
        const by = box.y - PAD;
        const bw = box.width + PAD * 2;
        const bh = box.height + PAD * 2;
        if (bx + bw > rx && bx < rx + rw &&
            by + bh > ry && by < ry + rh) {
          matched.push(node);
        }
      });

      if (matched.length > 0) {
        // 첫 번째 객체를 App 선택 상태로
        App.selectObject(matched[0].id());
        // Transformer에 모든 매칭 노드 설정
        const tf = objectLayer.findOne('Transformer');
        if (tf) {
          tf.nodes(matched);
          tf.moveToTop();
          objectLayer.batchDraw();
        }
      }
    });
  }

  function setupCanvasClick() {
    // 캔버스 클릭은 stage click에서 처리 (선택 해제 등)
  }

  function setupDrop() {
    const container = document.getElementById('konva-container');

    container.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    container.addEventListener('drop', (e) => {
      e.preventDefault();

      const type = e.dataTransfer.getData('object-type');
      if (!type) return;

      const stage = CanvasEditor.getStage();
      stage.setPointersPositions(e);
      const pos = CanvasEditor.getCanvasPointer();
      if (!pos) return;

      const x = CanvasEditor.snapToGrid(pos.x);
      const y = CanvasEditor.snapToGrid(pos.y);

      const def = ObjectFactory.DEFAULTS[type] || ObjectFactory.DEFAULTS.counter;
      const obj = {
        id: App.genId(),
        type,
        x, y,
        width: def.w, height: def.h,
        rotation: 0,
        label: def.label,
        color: def.color,
      };
      App.addObject(obj);
      ObjectFactory.createNode(obj);

      History.push();
    });
  }

  function setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); History.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); History.redo(); return; }

      // 복사/붙여넣기
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') { copySelected(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); pasteClipboard(); return; }

      // 도구 단축키 (input 안에서는 무시)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case 'v': App.setTool('select'); break;
        case 'w': App.setTool('wall'); break;
        case 'd': App.setTool('delete'); break;
        case 'r': rotateSelected(); break;
        case 'delete':
        case 'backspace':
          deleteSelected();
          break;
        case 'escape':
          App.selectObject(null);
          App.setTool('select');
          break;
      }
    });
  }

  // ── Ctrl+C: 복사 ──
  function copySelected() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const obj = App.getState().layout.objects.find(o => o.id === id);
    if (!obj) return;
    clipboard = JSON.parse(JSON.stringify(obj));
    showToast('복사됨');
  }

  // ── Ctrl+V: 붙여넣기 (25px 오프셋) ──
  function pasteClipboard() {
    if (!clipboard) { showToast('복사된 객체가 없습니다'); return; }
    const newObj = JSON.parse(JSON.stringify(clipboard));
    newObj.id = App.genId();
    newObj.x = CanvasEditor.snapToGrid(newObj.x + 25);
    newObj.y = CanvasEditor.snapToGrid(newObj.y + 25);
    App.addObject(newObj);
    ObjectFactory.createNode(newObj);
    App.selectObject(newObj.id);
    History.push();
    // 다음 붙여넣기도 오프셋되도록 clipboard 위치 업데이트
    clipboard.x = newObj.x;
    clipboard.y = newObj.y;
  }

  // ── R키: 중심점 기준 90도 시계방향 회전 ──
  function rotateSelected() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const obj = App.getState().layout.objects.find(o => o.id === id);
    if (!obj) return;

    const w = obj.width || 0;
    const h = obj.height || 0;
    const oldRad = (obj.rotation || 0) * Math.PI / 180;
    const newDeg = ((obj.rotation || 0) + 90) % 360;
    const newRad = newDeg * Math.PI / 180;

    // 현재 중심점 (월드 좌표)
    const cx = obj.x + Math.cos(oldRad) * w / 2 - Math.sin(oldRad) * h / 2;
    const cy = obj.y + Math.sin(oldRad) * w / 2 + Math.cos(oldRad) * h / 2;

    // 새 위치: 중심점이 같도록 역산
    const newX = cx - Math.cos(newRad) * w / 2 + Math.sin(newRad) * h / 2;
    const newY = cy - Math.sin(newRad) * w / 2 - Math.cos(newRad) * h / 2;

    App.updateObject(id, {
      rotation: newDeg,
      x: CanvasEditor.snapToGrid(newX),
      y: CanvasEditor.snapToGrid(newY),
    });
    ObjectFactory.updateNodeVisual(obj);
    History.push();
  }

  function deleteSelected() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const node = ObjectFactory.findNode(id);
    if (node) node.destroy();
    App.removeObject(id);
    App.selectObject(null);
    CanvasEditor.getObjectLayer().batchDraw();
    History.push();
  }

  // ── 간단한 토스트 메시지 (CSS 기반) ──
  function showToast(msg) {
    let toast = document.getElementById('tool-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'tool-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 2500);
  }

  // ── 컨텍스트 메뉴 ──
  function setupContextMenu() {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    const stage = CanvasEditor.getStage();

    // 우클릭 이벤트
    stage.on('contextmenu', (e) => {
      e.evt.preventDefault();
      const target = e.target;
      const isStage = target === stage;

      // 객체 위 우클릭 → 선택
      if (!isStage) {
        const group = target.findAncestor('Group') || target;
        if (group.id && group.id()) {
          App.selectObject(group.id());
        }
      }

      const hasSelection = !!App.getState().selectedObjectId;

      // 항목 활성화/비활성화
      menu.querySelectorAll('.ctx-item').forEach(item => {
        const action = item.dataset.action;
        if (action === 'paste') {
          item.classList.toggle('ctx-disabled', !clipboard);
        } else if (action !== 'paste') {
          if (!hasSelection && action !== 'paste') {
            item.classList.toggle('ctx-disabled', !hasSelection);
          } else {
            item.classList.remove('ctx-disabled');
          }
        }
      });

      // 위치 및 표시
      const x = e.evt.clientX;
      const y = e.evt.clientY;
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      menu.style.display = 'block';

      // 화면 밖 보정
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = (x - rect.width) + 'px';
      if (rect.bottom > window.innerHeight) menu.style.top = (y - rect.height) + 'px';
    });

    // 메뉴 항목 클릭
    menu.addEventListener('click', (e) => {
      const item = e.target.closest('.ctx-item');
      if (!item || item.classList.contains('ctx-disabled')) return;
      const action = item.dataset.action;
      hideContextMenu();

      switch (action) {
        case 'copy': copySelected(); break;
        case 'paste': pasteClipboard(); break;
        case 'duplicate': duplicateSelected(); break;
        case 'rotate': rotateSelected(); break;
        case 'bringToFront': bringToFront(); break;
        case 'sendToBack': sendToBack(); break;
        case 'delete': deleteSelected(); break;
      }
    });

    // 메뉴 닫기: 문서 클릭 / ESC
    document.addEventListener('click', (e) => {
      if (!menu.contains(e.target)) hideContextMenu();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideContextMenu();
    });
  }

  function hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.style.display = 'none';
  }

  // ── 복제 (copy + paste 즉시) ──
  function duplicateSelected() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const obj = App.getState().layout.objects.find(o => o.id === id);
    if (!obj) return;
    const newObj = JSON.parse(JSON.stringify(obj));
    newObj.id = App.genId();
    newObj.x = CanvasEditor.snapToGrid(newObj.x + 25);
    newObj.y = CanvasEditor.snapToGrid(newObj.y + 25);
    App.addObject(newObj);
    ObjectFactory.createNode(newObj);
    App.selectObject(newObj.id);
    History.push();
    showToast('복제됨');
  }

  // ── 맨 앞으로 ──
  function bringToFront() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const node = ObjectFactory.findNode(id);
    if (node) {
      node.moveToTop();
      // Transformer는 항상 최상위
      const layer = CanvasEditor.getObjectLayer();
      const tf = layer.findOne('Transformer');
      if (tf) tf.moveToTop();
      layer.batchDraw();
      showToast('맨 앞으로');
    }
  }

  // ── 맨 뒤로 ──
  function sendToBack() {
    const id = App.getState().selectedObjectId;
    if (!id) return;
    const node = ObjectFactory.findNode(id);
    if (node) {
      node.moveToBottom();
      CanvasEditor.getObjectLayer().batchDraw();
      showToast('맨 뒤로');
    }
  }

  // showToast를 전역으로 노출
  window.showToast = showToast;

  return { init };
})();
