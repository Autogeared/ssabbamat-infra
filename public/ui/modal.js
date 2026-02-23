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
        '<p style="color:var(--text-muted);">동선 메트릭이 없습니다. 공정 스테이션을 배치하고 동선을 연결해주세요.</p>';
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

  // ── 불러오기 모달 ──
  function showLoad() {
    const modal = document.getElementById('modal-load');
    modal.style.display = 'flex';
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

  return { init, showUpload, showInsights, showLoad };
})();
