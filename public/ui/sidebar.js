/**
 * Sidebar — 탭 전환, 속성 패널, 팔레트 드래그
 */
const Sidebar = (() => {
  function init() {
    setupTabs();
    setupPaletteDrag();
    setupProperties();
  }

  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
      });
    });
  }

  function setupPaletteDrag() {
    document.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('object-type', item.dataset.type);
        if (item.dataset.role) {
          e.dataTransfer.setData('station-role', item.dataset.role);
        }
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  function setupProperties() {
    App.on('selection-changed', (id) => {
      const noSel = document.getElementById('no-selection');
      const props = document.getElementById('selection-props');

      if (!id) {
        noSel.style.display = '';
        props.style.display = 'none';
        return;
      }

      noSel.style.display = 'none';
      props.style.display = '';

      const obj = App.getState().layout.objects.find(o => o.id === id);
      if (!obj) return;

      // 속성 탭으로 자동 전환
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector('[data-tab="properties"]').classList.add('active');
      document.getElementById('tab-properties').classList.add('active');

      fillProperties(obj);
    });

    // 속성 변경 입력
    const fields = ['label', 'x', 'y', 'width', 'height', 'rotation', 'processing-time'];
    fields.forEach(field => {
      const el = document.getElementById('prop-' + field);
      if (!el) return;
      el.addEventListener('change', () => {
        const id = App.getState().selectedObjectId;
        if (!id) return;

        const updates = {};
        if (field === 'label') updates.label = el.value;
        else if (field === 'processing-time') updates.processingTime = parseInt(el.value) || 0;
        else if (field === 'x') updates.x = parseFloat(el.value) || 0;
        else if (field === 'y') updates.y = parseFloat(el.value) || 0;
        else if (field === 'width') updates.width = parseFloat(el.value) || 50;
        else if (field === 'height') updates.height = parseFloat(el.value) || 50;
        else if (field === 'rotation') updates.rotation = parseFloat(el.value) || 0;

        App.updateObject(id, updates);
        ObjectFactory.updateNodeVisual(
          App.getState().layout.objects.find(o => o.id === id)
        );
        History.push();
      });
    });

    // 삭제 버튼
    document.getElementById('btn-delete-selected').addEventListener('click', () => {
      const id = App.getState().selectedObjectId;
      if (!id) return;
      const node = ObjectFactory.findNode(id);
      if (node) node.destroy();
      App.removeObject(id);
      App.selectObject(null);
      CanvasEditor.getObjectLayer().batchDraw();
      History.push();
    });
  }

  function fillProperties(obj) {
    const typeLabels = {
      wall: '벽', door: '문', window: '창문', counter: '카운터',
      'gas-range': '가스레인지', sink: '싱크대', 'prep-table': '조리대',
      fridge: '냉장고', storage: '보관함', station: '공정 스테이션',
    };

    document.getElementById('prop-type').textContent = typeLabels[obj.type] || obj.type;
    document.getElementById('prop-label').value = obj.label || '';
    document.getElementById('prop-x').value = Math.round(obj.x);
    document.getElementById('prop-y').value = Math.round(obj.y);
    document.getElementById('prop-width').value = Math.round(obj.width || 0);
    document.getElementById('prop-height').value = Math.round(obj.height || 0);
    document.getElementById('prop-rotation').value = Math.round(obj.rotation || 0);

    // 스테이션 전용 필드
    const stationFields = document.querySelectorAll('.station-only');
    if (obj.type === 'station') {
      stationFields.forEach(f => f.style.display = '');
      document.getElementById('prop-processing-time').value = obj.processingTime || 0;
    } else {
      stationFields.forEach(f => f.style.display = 'none');
    }
  }

  return { init };
})();
