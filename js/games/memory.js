import { GameBase } from '../game-base.js';
import { shuffleArray, $, cacheBust } from '../utils.js';

const CARD_IMAGES = [
  'images/warriors.jpg',
  'images/damiano.jpg',
  'images/lucius-barbie.jpg',
  'images/gray-cat.jpg',
  'images/dog-with-hat.jpg',
  'images/johnny-depp.jpg',
  'images/alice-wonderland.jpg',
  'images/draco-malfoy.jpg',
  'images/spirit-horse.jpg'
];

export class MemoryGame extends GameBase {
  constructor(app) {
    super('memory', app);
    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.totalPairs = 0;
    this.moves = 0;
    this.isLocked = false;

    this.board = $('#memory-board');
    this.movesDisplay = $('#moves-count');
    this.pairsDisplay = $('#pairs-count');
    this.difficultySelector = $('#difficulty-selector');
    this.restartBtn = $('#restart-btn');
  }

  init() {
    document.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => this.start(parseInt(btn.dataset.pairs)));
    });
    this.restartBtn.addEventListener('click', () => this.showDifficultySelector());
  }

  showDifficultySelector() {
    this.difficultySelector.classList.remove('hidden');
    this.board.innerHTML = '';
    this.restartBtn.classList.add('hidden');
    this.reset();
  }

  reset() {
    this.cards = [];
    this.flippedCards = [];
    this.matchedPairs = 0;
    this.totalPairs = 0;
    this.moves = 0;
    this.isLocked = false;
    this.updateUI();
  }

  start(pairs) {
    this.difficultySelector.classList.add('hidden');
    this.totalPairs = pairs;

    const selectedImages = shuffleArray([...CARD_IMAGES]).slice(0, pairs);
    const cardPairs = shuffleArray([...selectedImages, ...selectedImages]);

    this.cards = cardPairs.map((image, index) => ({
      id: index,
      image,
      isFlipped: false,
      isMatched: false
    }));

    this.renderBoard();
    this.updateUI();
  }

  renderBoard() {
    this.board.className = 'memory-board grid-4';
    this.board.innerHTML = this.cards.map(card => `
      <div class="memory-card" data-id="${card.id}">
        <div class="memory-card-inner">
          <div class="memory-card-front"></div>
          <div class="memory-card-back"><img src="${cacheBust(card.image)}" alt="card" draggable="false"></div>
        </div>
      </div>
    `).join('');

    this.board.querySelectorAll('.memory-card').forEach(cardEl => {
      cardEl.addEventListener('click', () => this.handleCardClick(parseInt(cardEl.dataset.id)));
    });

    this.restartBtn.classList.remove('hidden');
  }

  handleCardClick(cardId) {
    if (this.isLocked) return;

    const card = this.cards[cardId];
    if (card.isFlipped || card.isMatched) return;
    if (this.flippedCards.length >= 2) return;

    card.isFlipped = true;
    this.flippedCards.push(card);
    this.updateCardElement(cardId, true);

    if (this.flippedCards.length === 2) {
      this.moves++;
      this.updateUI();
      this.checkForMatch();
    }
  }

  updateCardElement(cardId, isFlipped, isMatched = false) {
    const cardEl = this.board.querySelector(`[data-id="${cardId}"]`);
    if (isFlipped) cardEl.classList.add('flipped');
    else cardEl.classList.remove('flipped');
    if (isMatched) cardEl.classList.add('matched');
  }

  checkForMatch() {
    const [card1, card2] = this.flippedCards;

    if (card1.image === card2.image) {
      card1.isMatched = true;
      card2.isMatched = true;
      this.matchedPairs++;

      this.updateCardElement(card1.id, true, true);
      this.updateCardElement(card2.id, true, true);
      this.flippedCards = [];
      this.updateUI();

      if (this.matchedPairs === this.totalPairs) {
        setTimeout(() => this.showWin({ moves: this.moves }), 600);
      }
    } else {
      this.isLocked = true;
      setTimeout(() => {
        card1.isFlipped = false;
        card2.isFlipped = false;
        this.updateCardElement(card1.id, false);
        this.updateCardElement(card2.id, false);
        this.flippedCards = [];
        this.isLocked = false;
      }, 1000);
    }
  }

  updateUI() {
    this.movesDisplay.textContent = this.moves;
    this.pairsDisplay.textContent = `${this.matchedPairs}/${this.totalPairs}`;
  }

  onEnter() {
    this.showDifficultySelector();
  }

  onPlayAgain() {
    this.showDifficultySelector();
  }
}
