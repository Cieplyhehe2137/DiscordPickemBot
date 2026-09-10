let io = null;

function setIo(instance) {
  io = instance;
}

function getIo() {
  return io;
}

function emitDashboardRefresh(payload = {}) {
  if (!io) {
    return false;
  }

  io.emit("dashboard:refresh", payload);

  return true;
}

module.exports = {
  setIo,
  getIo,
  emitDashboardRefresh,
};
