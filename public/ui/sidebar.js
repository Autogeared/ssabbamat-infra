/**
 * Sidebar — 탭 전환, 속성 패널, 팔레트 드래그, 공정(태스크) 관리, 메트릭 표시
 */
const Sidebar = (() => {
  function init() {
    setupTabs();
    setupPaletteDrag();
    setupProperties();
    setupTaskList();
    setupMetrics();
  }

  // ── 탭 전환 ──
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

  // ── 팔레트 드래그 ──
  function setupPaletteDrag() {
    document.querySelectorAll('.palette-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('object-type', item.dataset.type);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
  }

  // ── 속성 패널 ──
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
    const fields = ['label', 'x', 'y', 'width', 'height', 'rotation'];
    fields.forEach(field => {
      const el = document.getElementById('prop-' + field);
      if (!el) return;
      el.addEventListener('change', () => {
        const id = App.getState().selectedObjectId;
        if (!id) return;

        const updates = {};
        if (field === 'label') updates.label = el.value;
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
      fridge: '냉장고', storage: '보관함',
    };

    document.getElementById('prop-type').textContent = typeLabels[obj.type] || obj.type;
    document.getElementById('prop-label').value = obj.label || '';
    document.getElementById('prop-x').value = Math.round(obj.x);
    document.getElementById('prop-y').value = Math.round(obj.y);
    document.getElementById('prop-width').value = Math.round(obj.width || 0);
    document.getElementById('prop-height').value = Math.round(obj.height || 0);
    document.getElementById('prop-rotation').value = Math.round(obj.rotation || 0);
  }

  // ── 공정(태스크) 목록 관리 ──
  let dragSrcIdx = null;

  function setupTaskList() {
    document.getElementById('btn-add-task').addEventListener('click', addNewTask);
    App.on('tasks-changed', renderTaskList);
    App.on('layout-changed', () => {
      // 객체가 변경되면 드롭다운 갱신
      renderTaskList(App.getState().layout.tasks);
    });
  }

  function addNewTask() {
    const tasks = App.getState().layout.tasks;
    const task = {
      id: 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 5),
      name: '태스크 ' + (tasks.length + 1),
      objectId: null,
      duration: 30,
    };
    App.addTask(task);
    History.push();
  }

  function renderTaskList(tasks) {
    if (!tasks) tasks = App.getState().layout.tasks;
    const container = document.getElementById('task-list');
    const objects = App.getState().layout.objects;

    if (tasks.length === 0) {
      container.innerHTML = '<p class="task-empty">태스크를 추가하여 공정을 정의하세요.</p>';
      return;
    }

    container.innerHTML = '';

    tasks.forEach((task, idx) => {
      const row = document.createElement('div');
      row.className = 'task-row';
      row.draggable = true;
      row.dataset.idx = idx;

      // 순번
      const num = document.createElement('span');
      num.className = 'task-num';
      num.textContent = (idx + 1);

      // 이름 입력
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'task-name';
      nameInput.value = task.name;
      nameInput.placeholder = '태스크명';
      nameInput.addEventListener('change', () => {
        App.updateTask(task.id, { name: nameInput.value });
        History.push();
      });

      // 장비 드롭다운
      const objSelect = document.createElement('select');
      objSelect.className = 'task-object';
      objSelect.innerHTML = '<option value="">장비 선택</option>';
      objects.forEach(obj => {
        if (obj.type === 'wall' || obj.type === 'door' || obj.type === 'window') return;
        const opt = document.createElement('option');
        opt.value = obj.id;
        opt.textContent = obj.label || obj.type;
        if (task.objectId === obj.id) opt.selected = true;
        objSelect.appendChild(opt);
      });
      objSelect.addEventListener('change', () => {
        App.updateTask(task.id, { objectId: objSelect.value || null });
        History.push();
      });

      // 소요시간
      const durWrap = document.createElement('div');
      durWrap.className = 'task-dur-wrap';
      const durInput = document.createElement('input');
      durInput.type = 'number';
      durInput.className = 'task-dur';
      durInput.value = task.duration || 0;
      durInput.min = 0;
      durInput.title = '소요시간(초)';
      const durLabel = document.createElement('span');
      durLabel.className = 'task-dur-label';
      durLabel.textContent = '초';
      durInput.addEventListener('change', () => {
        App.updateTask(task.id, { duration: parseInt(durInput.value) || 0 });
        History.push();
      });
      durWrap.appendChild(durInput);
      durWrap.appendChild(durLabel);

      // 삭제 버튼
      const delBtn = document.createElement('button');
      delBtn.className = 'task-del';
      delBtn.textContent = '\u00d7';
      delBtn.title = '삭제';
      delBtn.addEventListener('click', () => {
        App.removeTask(task.id);
        History.push();
      });

      row.appendChild(num);
      row.appendChild(nameInput);
      row.appendChild(objSelect);
      row.appendChild(durWrap);
      row.appendChild(delBtn);
      container.appendChild(row);

      // 드래그 정렬
      row.addEventListener('dragstart', (e) => {
        dragSrcIdx = idx;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx);
      });
      row.addEventListener('dragend', () => {
        row.classList.remove('dragging');
        dragSrcIdx = null;
      });
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', () => {
        row.classList.remove('drag-over');
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const fromIdx = dragSrcIdx;
        const toIdx = idx;
        if (fromIdx === null || fromIdx === toIdx) return;

        const arr = [...App.getState().layout.tasks];
        const [moved] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, moved);
        App.reorderTasks(arr);
        History.push();
      });
    });
  }

  // ── 메트릭 패널 ──
  function setupMetrics() {
    App.on('metrics-updated', renderMetrics);
  }

  function renderMetrics(m) {
    if (!m) {
      document.getElementById('metric-task-count').textContent = '-';
      document.getElementById('metric-distance').textContent = '-';
      document.getElementById('metric-walk-time').textContent = '-';
      document.getElementById('metric-processing').textContent = '-';
      document.getElementById('metric-cycle-time').textContent = '-';
      document.getElementById('metric-complexity').textContent = '-';
      document.getElementById('metric-bottleneck').textContent = '-';
      document.getElementById('metric-segments').innerHTML = '';
      return;
    }

    document.getElementById('metric-task-count').textContent = m.taskCount;
    document.getElementById('metric-distance').textContent = m.totalDistance + ' m';
    document.getElementById('metric-walk-time').textContent = m.totalWalkTime + ' 초';
    document.getElementById('metric-processing').textContent = m.totalProcessing + ' 초';
    document.getElementById('metric-cycle-time').textContent = m.totalCycleTime + ' 초';
    document.getElementById('metric-complexity').textContent = m.complexityScore + ' / 100';

    if (m.bottleneck) {
      document.getElementById('metric-bottleneck').textContent =
        m.bottleneck.stationLabel + ' (' + m.bottleneck.time + '초)';
    } else {
      document.getElementById('metric-bottleneck').textContent = '-';
    }

    // 구간별 이동
    const segEl = document.getElementById('metric-segments');
    if (m.segments && m.segments.length > 0) {
      segEl.innerHTML = m.segments.map((s, i) =>
        '<div class="segment-row">' +
          '<span class="seg-num">' + (i + 1) + '</span> ' +
          '<span class="seg-names">' + s.from + ' → ' + s.to + '</span> ' +
          '<span class="seg-dist">' + s.distance + 'm / ' + s.walkTime + '초</span>' +
        '</div>'
      ).join('');
    } else {
      segEl.innerHTML = '';
    }
  }

  return { init };
})();
