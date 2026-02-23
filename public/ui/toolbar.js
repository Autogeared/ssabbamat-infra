/**
 * Toolbar — 상단 툴바 이벤트
 */
const Toolbar = (() => {
  function init() {
    // 도구 버튼
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        App.setTool(btn.dataset.tool);
      });
    });

    // 도구 변경 시 active 표시
    App.on('tool-changed', (tool) => {
      document.querySelectorAll('.tool-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tool === tool);
      });
    });

    // Undo/Redo
    document.getElementById('btn-undo').addEventListener('click', () => History.undo());
    document.getElementById('btn-redo').addEventListener('click', () => History.redo());

    // 저장 — 로컬/클라우드 선택
    document.getElementById('btn-save').addEventListener('click', () => {
      ModalManager.showSave();
    });

    // 불러오기
    document.getElementById('btn-load').addEventListener('click', () => {
      ModalManager.showLoad();
    });

    // 내보내기
    document.getElementById('btn-export').addEventListener('click', () => {
      Serializer.exportJSON();
    });

    // 업로드
    document.getElementById('btn-upload').addEventListener('click', () => {
      ModalManager.showUpload();
    });

    // AI 분석
    document.getElementById('btn-ai-analyze').addEventListener('click', () => {
      ModalManager.showInsights();
    });
  }

  return { init };
})();
