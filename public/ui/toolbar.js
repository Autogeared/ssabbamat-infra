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

    // 저장
    document.getElementById('btn-save').addEventListener('click', () => {
      const name = prompt('저장 이름을 입력하세요:', '내 매장 도면');
      if (name) {
        Serializer.save(name);
        alert('저장되었습니다.');
      }
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
