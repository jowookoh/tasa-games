import { GameBase } from '../game-base.js';
import { $ } from '../utils.js';

const INGREDIENTS = [
  { id: 'rice', emoji: '🍚', name: 'Pirinač' },
  { id: 'salmon', emoji: '🍣', name: 'Losos' },
  { id: 'shrimp', emoji: '🍤', name: 'Škampi' },
  { id: 'avocado', emoji: '🥑', name: 'Avokado' },
  { id: 'cucumber', emoji: '🥒', name: 'Krastavac' },
  { id: 'egg', emoji: '🥚', name: 'Jaje' },
  { id: 'nori', emoji: '🟢', name: 'Nori' },
  { id: 'tuna', emoji: '🐟', name: 'Tuna' },
];

const RECIPES = [
  { name: 'Sake Nigiri', ingredients: ['rice', 'salmon'], emoji: '🍣' },
  { name: 'Ebi Nigiri', ingredients: ['rice', 'shrimp'], emoji: '🍤' },
  { name: 'Tamago Nigiri', ingredients: ['rice', 'egg'], emoji: '🍳' },
  { name: 'Kapa Maki', ingredients: ['rice', 'nori', 'cucumber'], emoji: '🥒' },
  { name: 'Sake Maki', ingredients: ['rice', 'nori', 'salmon'], emoji: '🍣' },
  { name: 'Tuna Maki', ingredients: ['rice', 'nori', 'tuna'], emoji: '🐟' },
  { name: 'Kalifornija', ingredients: ['rice', 'nori', 'avocado', 'shrimp'], emoji: '🥑' },
  { name: 'Dragon Roll', ingredients: ['rice', 'nori', 'avocado', 'shrimp', 'cucumber'], emoji: '🐉' },
];

const ORDER_TIME = 15000;
const MAX_ACTIVE_ORDERS = 3;
const SPAWN_INTERVAL_BASE = 4000;

export class SushiGame extends GameBase {
  constructor(app) {
    super('sushi', app);
    this.score = 0;
    this.ordersCompleted = 0;
    this.ordersFailed = 0;
    this.maxFails = 3;
    this.activeOrders = [];
    this.plate = [];
    this.running = false;
    this.spawnTimer = null;
    this.tickTimer = null;
    this.area = null;
    this.scoreDisplay = null;
    this.ordersDisplay = null;
  }

  init() {
    this.area = $('#sushi-game-area');
    this.scoreDisplay = $('#sushi-score');
    this.ordersDisplay = $('#sushi-orders');
  }

  stop() {
    this.running = false;
    if (this.spawnTimer) { clearInterval(this.spawnTimer); this.spawnTimer = null; }
    if (this.tickTimer) { clearInterval(this.tickTimer); this.tickTimer = null; }
  }

  start() {
    this.stop();
    this.score = 0;
    this.ordersCompleted = 0;
    this.ordersFailed = 0;
    this.activeOrders = [];
    this.plate = [];
    this.running = true;

    this.scoreDisplay.textContent = '0';
    this.ordersDisplay.textContent = '0';
    this.container.querySelector('.game-header').classList.remove('hidden');

    this.render();
    this.spawnOrder();

    this.spawnTimer = setInterval(() => this.spawnOrder(), SPAWN_INTERVAL_BASE);
    this.tickTimer = setInterval(() => this.tick(), 200);
  }

  spawnOrder() {
    if (!this.running) return;
    if (this.activeOrders.length >= MAX_ACTIVE_ORDERS) return;

    const difficulty = Math.min(Math.floor(this.ordersCompleted / 3), RECIPES.length - 1);
    const available = RECIPES.slice(0, Math.max(3, difficulty + 2));
    const recipe = available[Math.floor(Math.random() * available.length)];

    this.activeOrders.push({
      recipe,
      timeLeft: ORDER_TIME,
      totalTime: ORDER_TIME,
    });
    this.render();
  }

  tick() {
    if (!this.running) return;
    let changed = false;

    for (let i = this.activeOrders.length - 1; i >= 0; i--) {
      this.activeOrders[i].timeLeft -= 200;
      if (this.activeOrders[i].timeLeft <= 0) {
        this.activeOrders.splice(i, 1);
        this.ordersFailed++;
        changed = true;
        if (this.ordersFailed >= this.maxFails) {
          this.endGame();
          return;
        }
      }
    }

    if (changed) {
      this.render();
    } else {
      this.updateTimers();
    }
  }

  addIngredient(ingredientId) {
    if (!this.running) return;
    this.plate.push(ingredientId);
    this.render();
  }

  clearPlate() {
    this.plate = [];
    this.render();
  }

  servePlate() {
    if (!this.running || this.plate.length === 0) return;

    const plateStr = [...this.plate].sort().join(',');
    let matchIdx = -1;

    for (let i = 0; i < this.activeOrders.length; i++) {
      const orderStr = [...this.activeOrders[i].recipe.ingredients].sort().join(',');
      if (plateStr === orderStr) {
        matchIdx = i;
        break;
      }
    }

    if (matchIdx >= 0) {
      const order = this.activeOrders.splice(matchIdx, 1)[0];
      const timeBonus = Math.ceil((order.timeLeft / order.totalTime) * 50);
      const points = 10 + timeBonus;
      this.score += points;
      this.ordersCompleted++;
      this.scoreDisplay.textContent = this.score;
      this.ordersDisplay.textContent = this.ordersCompleted;
    } else {
      this.score = Math.max(0, this.score - 5);
      this.scoreDisplay.textContent = this.score;
    }

    this.plate = [];
    this.render();
  }

  endGame() {
    this.stop();
    this.area.innerHTML = `
      <div class="sushi-gameover">
        <h2>😿 Gotovo!</h2>
        <p>Završio si <strong>${this.ordersCompleted}</strong> porudžbina</p>
        <p>Rezultat: <strong>${this.score}</strong></p>
        <button class="action-btn primary sushi-restart-btn">🔄 Pokušaj ponovo</button>
      </div>
    `;
    this.area.querySelector('.sushi-restart-btn').addEventListener('click', () => this.start());
  }

  updateTimers() {
    const bars = this.area.querySelectorAll('.order-timer-fill');
    this.activeOrders.forEach((order, i) => {
      if (bars[i]) {
        const pct = Math.max(0, order.timeLeft / order.totalTime * 100);
        bars[i].style.width = `${pct}%`;
        bars[i].className = `order-timer-fill${pct < 30 ? ' urgent' : ''}`;
      }
    });
  }

  render() {
    const failHearts = '❤️'.repeat(this.maxFails - this.ordersFailed) + '🖤'.repeat(this.ordersFailed);

    const ordersHTML = this.activeOrders.map((order, i) => {
      const pct = Math.max(0, order.timeLeft / order.totalTime * 100);
      const ingredientEmojis = order.recipe.ingredients.map(id => {
        const ing = INGREDIENTS.find(x => x.id === id);
        return ing ? ing.emoji : '?';
      }).join(' ');

      return `
        <div class="sushi-order">
          <div class="order-header">
            <span class="order-name">${order.recipe.emoji} ${order.recipe.name}</span>
          </div>
          <div class="order-ingredients">${ingredientEmojis}</div>
          <div class="order-timer">
            <div class="order-timer-fill${pct < 30 ? ' urgent' : ''}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');

    const plateHTML = this.plate.map(id => {
      const ing = INGREDIENTS.find(x => x.id === id);
      return ing ? ing.emoji : '?';
    }).join(' ');

    const ingredientBtns = INGREDIENTS.map(ing => `
      <button class="sushi-ing-btn" data-id="${ing.id}">
        <span class="ing-emoji">${ing.emoji}</span>
        <span class="ing-name">${ing.name}</span>
      </button>
    `).join('');

    this.area.innerHTML = `
      <div class="sushi-lives">${failHearts}</div>
      <div class="sushi-orders">${ordersHTML || '<div class="sushi-waiting">Čekam porudžbine... 🍵</div>'}</div>
      <div class="sushi-plate-area">
        <div class="sushi-plate-label">🍽️ Tvoj tanjir</div>
        <div class="sushi-plate">${plateHTML || '<span class="plate-empty">Dodaj sastojke!</span>'}</div>
        <div class="sushi-plate-actions">
          <button class="action-btn secondary sushi-clear-btn">🗑️ Obriši</button>
          <button class="action-btn primary sushi-serve-btn">✅ Posluži!</button>
        </div>
      </div>
      <div class="sushi-ingredients">${ingredientBtns}</div>
    `;

    this.area.querySelectorAll('.sushi-ing-btn').forEach(btn => {
      btn.addEventListener('click', () => this.addIngredient(btn.dataset.id));
    });
    this.area.querySelector('.sushi-clear-btn').addEventListener('click', () => this.clearPlate());
    this.area.querySelector('.sushi-serve-btn').addEventListener('click', () => this.servePlate());
  }

  onEnter() {
    this.start();
  }

  onPlayAgain() {
    this.start();
  }

  destroy() {
    this.stop();
  }
}
