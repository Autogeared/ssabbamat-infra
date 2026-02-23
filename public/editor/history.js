/**
 * History — Undo/Redo 스택
 */
const History = (() => {
  let undoStack = [];
  let redoStack = [];
  const MAX_HISTORY = 50;

  function init() {
    // 초기 상태 저장
    push();
  }

  function snapshot() {
    const layout = App.getState().layout;
    return JSON.stringify(layout);
  }

  function push() {
    const snap = snapshot();
    // 마지막 상태와 동일하면 스킵
    if (undoStack.length > 0 && undoStack[undoStack.length - 1] === snap) return;
    undoStack.push(snap);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack = [];
    updateButtons();
  }

  function undo() {
    if (undoStack.length <= 1) return;
    const current = undoStack.pop();
    redoStack.push(current);
    const prev = undoStack[undoStack.length - 1];
    restore(prev);
    updateButtons();
  }

  function redo() {
    if (redoStack.length === 0) return;
    const next = redoStack.pop();
    undoStack.push(next);
    restore(next);
    updateButtons();
  }

  function restore(json) {
    const layout = JSON.parse(json);
    App.setLayout(layout);
  }

  function updateButtons() {
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = undoStack.length <= 1;
    if (btnRedo) btnRedo.disabled = redoStack.length === 0;
  }

  function clear() {
    undoStack = [];
    redoStack = [];
    push();
  }

  return { init, push, undo, redo, clear };
})();
