/**
 * Stations — 공정 스테이션 관리
 */
const Stations = (() => {
  function init() {
    // 스테이션 관련 이벤트 리스닝은 FlowPathManager에서 처리
  }

  function getStations() {
    return App.getState().layout.objects.filter(o => o.type === 'station');
  }

  function getStation(id) {
    return App.getState().layout.objects.find(o => o.id === id && o.type === 'station');
  }

  function updateProcessingTime(id, time) {
    App.updateObject(id, { processingTime: time });
    History.push();
    MetricsPanel.recalculate();
  }

  return { init, getStations, getStation, updateProcessingTime };
})();
