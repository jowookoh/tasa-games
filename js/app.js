import { MemoryGame } from './games/memory.js';
import { $ } from './utils.js';

class App {
  constructor() {
    this.currentScreen = 'home';
    this.currentGame = null;
    this.games = {};

    this.elements = {
      backBtn: $('#back-btn'),
      homeScreen: $('#home-screen'),
      winModal: $('#win-modal'),
      finalMoves: $('#final-moves'),
      playAgainBtn: $('#play-again-btn'),
      homeBtn: $('#home-btn')
    };
  }

  init() {
    this.registerGame('memory', MemoryGame);

    document.querySelectorAll('.game-card[data-game]').forEach(card => {
      card.addEventListener('click', () => this.navigateToGame(card.dataset.game));
    });

    this.elements.backBtn.addEventListener('click', () => this.navigateHome());
    this.elements.playAgainBtn.addEventListener('click', () => this.handlePlayAgain());
    this.elements.homeBtn.addEventListener('click', () => {
      this.hideWinModal();
      this.navigateHome();
    });
  }

  registerGame(id, GameClass) {
    const game = new GameClass(this);
    game.init();
    this.games[id] = game;
  }

  navigateToGame(gameId) {
    const game = this.games[gameId];
    if (!game) return;

    this.elements.homeScreen.classList.remove('active');
    this.elements.backBtn.classList.remove('hidden');

    game.container.classList.add('active');
    this.currentScreen = gameId;
    this.currentGame = game;

    if (game.onEnter) game.onEnter();
  }

  navigateHome() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    this.elements.homeScreen.classList.add('active');
    this.elements.backBtn.classList.add('hidden');
    this.elements.winModal.classList.add('hidden');
    this.currentScreen = 'home';
    this.currentGame = null;
  }

  showWinModal(stats = {}) {
    this.elements.finalMoves.textContent = stats.moves || 0;
    this.elements.winModal.classList.remove('hidden');
  }

  hideWinModal() {
    this.elements.winModal.classList.add('hidden');
  }

  handlePlayAgain() {
    this.hideWinModal();
    if (this.currentGame && this.currentGame.onPlayAgain) {
      this.currentGame.onPlayAgain();
    }
  }
}

const app = new App();
app.init();
