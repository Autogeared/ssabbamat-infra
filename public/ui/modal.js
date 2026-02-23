/**
 * ModalManager — 업로드, AI 인사이트, 불러오기 모달
 */
const ModalManager = (() => {
  let uploadedImage = null;

  function init() {
    // 모든 모달 닫기 버튼
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').style.display = 'none';
      });
    });

    // 오버레이 클릭으로 닫기
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
    });

    setupUploadModal();
    setupInsightsModal();
    setupSaveModal();
    setupLoadTabs();
  }

  // ── 업로드 모달 ──
  function showUpload() {
    uploadedImage = null;
    document.getElementById('modal-upload').style.display = 'flex';
    document.getElementById('upload-dropzone').style.display = '';
    document.getElementById('upload-preview').style.display = 'none';
    document.getElementById('upload-progress').style.display = 'none';
    document.getElementById('btn-recognize').disabled = true;
  }

  function setupUploadModal() {
    const dropzone = document.getElementById('upload-dropzone');
    const input = document.getElementById('upload-input');
    const btnRecognize = document.getElementById('btn-recognize');

    dropzone.addEventListener('click', () => input.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });

    input.addEventListener('change', () => {
      if (input.files.length > 0) handleFile(input.files[0]);
    });

    btnRecognize.addEventListener('click', doRecognize);
  }

  function handleFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    // 1024px으로 리사이즈 + JPEG 80% 압축
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 1024;
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        uploadedImage = canvas.toDataURL('image/jpeg', 0.8);

        // 프리뷰 표시
        document.getElementById('upload-dropzone').style.display = 'none';
        document.getElementById('upload-preview').style.display = '';
        document.getElementById('preview-img').src = uploadedImage;
        document.getElementById('upload-info').textContent = `${w}×${h}px, JPEG 80%`;
        document.getElementById('btn-recognize').disabled = false;
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function doRecognize() {
    if (!uploadedImage) return;

    document.getElementById('upload-preview').style.display = 'none';
    document.getElementById('upload-progress').style.display = '';
    document.getElementById('btn-recognize').disabled = true;

    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: uploadedImage }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'API 오류');
      }

      const data = await res.json();

      document.getElementById('upload-status').textContent =
        `${data.objects.length}개 객체 인식 완료! (신뢰도: ${Math.round(data.confidence * 100)}%)`;

      // 인식된 객체를 캔버스에 추가
      const layout = App.getState().layout;
      const scaleX = layout.canvasWidth / 1000;
      const scaleY = layout.canvasHeight / 1000;

      for (const obj of data.objects) {
        const scaled = {
          ...obj,
          x: Math.round(obj.x * scaleX),
          y: Math.round(obj.y * scaleY),
          width: Math.round(obj.width * scaleX),
          height: Math.round(obj.height * scaleY),
        };
        App.addObject(scaled);
        ObjectFactory.createNode(scaled);
      }

      History.push();

      setTimeout(() => {
        document.getElementById('modal-upload').style.display = 'none';
      }, 1500);

    } catch (err) {
      document.getElementById('upload-status').textContent = '오류: ' + err.message;
      document.getElementById('btn-recognize').disabled = false;
      document.getElementById('upload-preview').style.display = '';
      document.getElementById('upload-progress').style.display = 'none';
    }
  }

  // ── AI 인사이트 모달 ──
  function showInsights() {
    const modal = document.getElementById('modal-insights');
    modal.style.display = 'flex';
    document.getElementById('insights-loading').style.display = '';
    document.getElementById('insights-content').innerHTML = '';
    doInsights();
  }

  function setupInsightsModal() {
    // 이벤트는 init에서 처리됨
  }

  async function doInsights() {
    const layout = App.getState().layout;
    const metrics = App.getState().metrics;

    if (!metrics) {
      document.getElementById('insights-loading').style.display = 'none';
      document.getElementById('insights-content').innerHTML =
        '<p style="color:var(--text-muted);">동선 메트릭이 없습니다. 장비를 배치하고 공정 탭에서 태스크를 추가해주세요.</p>';
      return;
    }

    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout, metrics }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'API 오류');
      }

      const data = await res.json();
      document.getElementById('insights-loading').style.display = 'none';
      document.getElementById('insights-content').innerHTML = markdownToHTML(data.insights);

    } catch (err) {
      document.getElementById('insights-loading').style.display = 'none';
      document.getElementById('insights-content').innerHTML =
        `<p style="color:var(--danger);">오류: ${err.message}</p>`;
    }
  }

  // ── 저장 모달 ──
  function showSave() {
    const modal = document.getElementById('modal-save');
    modal.style.display = 'flex';
    document.getElementById('save-name-input').value = '';
    document.getElementById('save-status').style.display = 'none';
    document.getElementById('save-name-input').focus();
  }

  function setupSaveModal() {
    document.getElementById('btn-save-local').addEventListener('click', () => {
      const name = document.getElementById('save-name-input').value.trim();
      if (!name) { alert('저장 이름을 입력하세요.'); return; }
      Serializer.save(name);
      const status = document.getElementById('save-status');
      status.textContent = '로컬에 저장되었습니다.';
      status.style.display = '';
      status.style.color = 'var(--success, #10B981)';
      setTimeout(() => { document.getElementById('modal-save').style.display = 'none'; }, 800);
    });

    document.getElementById('btn-save-cloud').addEventListener('click', async () => {
      const name = document.getElementById('save-name-input').value.trim();
      if (!name) { alert('저장 이름을 입력하세요.'); return; }
      const btn = document.getElementById('btn-save-cloud');
      const status = document.getElementById('save-status');
      btn.disabled = true;
      btn.textContent = '저장 중...';
      status.style.display = 'none';
      try {
        await Serializer.saveToCloud(name);
        status.textContent = '클라우드에 저장되었습니다.';
        status.style.color = 'var(--success, #10B981)';
        status.style.display = '';
        setTimeout(() => { document.getElementById('modal-save').style.display = 'none'; }, 800);
      } catch (err) {
        status.textContent = '오류: ' + err.message;
        status.style.color = 'var(--danger, #EF4444)';
        status.style.display = '';
      } finally {
        btn.disabled = false;
        btn.textContent = '클라우드 저장';
      }
    });
  }

  // ── 불러오기 탭 전환 ──
  function setupLoadTabs() {
    const tabLocal = document.getElementById('load-tab-local');
    const tabCloud = document.getElementById('load-tab-cloud');
    const panelLocal = document.getElementById('load-local-panel');
    const panelCloud = document.getElementById('load-cloud-panel');

    tabLocal.addEventListener('click', () => {
      tabLocal.classList.add('active');
      tabCloud.classList.remove('active');
      panelLocal.style.display = '';
      panelCloud.style.display = 'none';
    });

    tabCloud.addEventListener('click', () => {
      tabCloud.classList.add('active');
      tabLocal.classList.remove('active');
      panelLocal.style.display = 'none';
      panelCloud.style.display = '';
      refreshCloudList();
    });
  }

  async function refreshCloudList() {
    const list = document.getElementById('cloud-list');
    const loading = document.getElementById('cloud-list-loading');
    list.innerHTML = '';
    loading.style.display = '';

    try {
      const layouts = await Serializer.listCloud();
      loading.style.display = 'none';

      if (!layouts || layouts.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">클라우드에 저장된 도면이 없습니다.</p>';
        return;
      }

      list.innerHTML = layouts.map(item => {
        const d = item.savedAt ? new Date(item.savedAt).toLocaleString('ko-KR') : '';
        return `<div class="saved-item" data-cloud-id="${item.id}">
          <div><div class="name">${item.name}</div><div class="date">${d}</div></div>
          <button class="btn-del" data-cloud-del="${item.id}">&times;</button>
        </div>`;
      }).join('');

      list.querySelectorAll('.saved-item').forEach(item => {
        item.addEventListener('click', async (e) => {
          if (e.target.classList.contains('btn-del')) {
            if (!confirm('클라우드에서 삭제하시겠습니까?')) return;
            try {
              await Serializer.deleteFromCloud(e.target.dataset.cloudDel);
              refreshCloudList();
            } catch (err) { alert('삭제 실패: ' + err.message); }
            return;
          }
          try {
            await Serializer.loadFromCloud(item.dataset.cloudId);
            document.getElementById('modal-load').style.display = 'none';
          } catch (err) { alert('불러오기 실패: ' + err.message); }
        });
      });
    } catch (err) {
      loading.style.display = 'none';
      list.innerHTML = `<p style="color:var(--danger, #EF4444);font-size:13px;">오류: ${err.message}</p>`;
    }
  }

  // ── 불러오기 모달 ──
  function showLoad() {
    const modal = document.getElementById('modal-load');
    modal.style.display = 'flex';

    // 로컬 탭 기본 선택
    document.getElementById('load-tab-local').classList.add('active');
    document.getElementById('load-tab-cloud').classList.remove('active');
    document.getElementById('load-local-panel').style.display = '';
    document.getElementById('load-cloud-panel').style.display = 'none';

    refreshSavedList();

    document.getElementById('import-input').addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        Serializer.importJSON(e.target.files[0]).then(() => {
          modal.style.display = 'none';
        }).catch(err => alert('가져오기 실패: ' + err.message));
      }
    });
  }

  function refreshSavedList() {
    const list = document.getElementById('saved-list');
    const layouts = Serializer.getAll();
    const names = Object.keys(layouts);

    if (names.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">저장된 도면이 없습니다.</p>';
      return;
    }

    list.innerHTML = names.map(name => {
      const d = new Date(layouts[name].savedAt).toLocaleString('ko-KR');
      return `<div class="saved-item" data-name="${name}">
        <div><div class="name">${name}</div><div class="date">${d}</div></div>
        <button class="btn-del" data-del="${name}">&times;</button>
      </div>`;
    }).join('');

    list.querySelectorAll('.saved-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-del')) {
          Serializer.remove(e.target.dataset.del);
          refreshSavedList();
          return;
        }
        Serializer.load(item.dataset.name);
        document.getElementById('modal-load').style.display = 'none';
      });
    });
  }

  // ── 간이 마크다운 → HTML ──
  function markdownToHTML(md) {
    return md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
  }

  return { init, showUpload, showInsights, showLoad, showSave };
})();
