export class GameBase {
  constructor(id, app) {
    this.id = id;
    this.app = app;
    this.container = document.getElementById(`${id}-game`);
  }

  init() {}

  start() {}

  reset() {}

  destroy() {}

  showWin(stats = {}) {
    this.app.showWinModal(stats);
  }
}
