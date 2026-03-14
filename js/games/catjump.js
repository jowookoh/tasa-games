import { GameBase } from '../game-base.js';
import { $, cacheBust } from '../utils.js';

const GRAVITY = 0.55;
const JUMP_FORCE = -12.5;
const JUMP_FORWARD_VX = 3.0;
const GROUND_HEIGHT = 32;
const CAT_DRAW_H = 60;
const DOG_DRAW_H = 56;
const SPRITE_Y_OFFSET = 8;
const CAT_FRAMES = 3;
const DOG_FRAMES = 4;
const ANIM_SPEED = 24;

const BASE_SPEED = 2.5;
const SPAWN_MIN = 1800;
const SPAWN_MAX = 3200;

const COOKIE_SIZE = 24;
const COOKIE_SPAWN_MIN = 800;
const COOKIE_SPAWN_MAX = 1800;
const COOKIE_Y_MIN_RATIO = 0.3;
const COOKIE_Y_MAX_RATIO = 0.75;

const TREAT_TIERS = [
  { emoji: '🧁', name: 'cupcake', points: 1 },
  { emoji: '🍩', name: 'donut', points: 2 },
  { emoji: '🍰', name: 'cake', points: 4 },
  { emoji: '🎂', name: 'birthday cake', points: 8 },
  { emoji: '👑', name: 'crown', points: 16 },
];

export class CatJumpGame extends GameBase {
  constructor(app) {
    super('catjump', app);
    this.canvas = null;
    this.ctx = null;
    this.animFrame = null;
    this.spawnTimeout = null;
    this.running = false;
    this.gameOver = false;
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('catjump-best') || '0', 10);
    this.speed = BASE_SPEED;
    this.frame = 0;
    this.groundY = 0;

    this.cat = { x: 0, y: 0, vy: 0, vx: 0, baseX: 70, grounded: true, w: 0, h: 0 };
    this.dogs = [];
    this.cookies = [];
    this.dustParticles = [];
    this.pickupEffects = [];
    this.groundOffset = 0;
    this.cookieTimeout = null;

    this.sprites = { catWalk: null, catJump: null, dogWalk: null, sky: null, ground: null };
    this.spriteMeta = { catFrameW: 0, catFrameH: 0, catJumpW: 0, dogFrameW: 0, dogFrameH: 0 };
    this.spritesLoaded = false;

    this.scoreDisplay = null;
    this.bestDisplay = null;
    this.gameOverlay = null;

    this.boundJump = this.jump.bind(this);
    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundResize = null;
  }

  loadSprites() {
    let loaded = 0;
    const total = 5;
    const onLoad = () => {
      loaded++;
      if (loaded === total) {
        const cw = this.sprites.catWalk;
        this.spriteMeta.catFrameW = cw.width / CAT_FRAMES;
        this.spriteMeta.catFrameH = cw.height;

        const cj = this.sprites.catJump;
        this.spriteMeta.catJumpW = cj.width;

        const dw = this.sprites.dogWalk;
        this.spriteMeta.dogFrameW = dw.width / DOG_FRAMES;
        this.spriteMeta.dogFrameH = dw.height;

        this.spritesLoaded = true;
      }
    };
    const load = (src) => {
      const img = new Image();
      img.onload = onLoad;
      img.src = cacheBust(src);
      return img;
    };
    this.sprites.catWalk = load('images/cat-walk.png');
    this.sprites.catJump = load('images/cat-jump.png');
    this.sprites.dogWalk = load('images/dog-walk.png');
    this.sprites.sky = load('images/sky-bg.png');
    this.sprites.ground = load('images/ground-tile.png');
  }

  init() {
    this.canvas = $('#catjump-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.loadSprites();
    this.scoreDisplay = $('#catjump-score');
    this.bestDisplay = $('#catjump-best');
    this.gameOverlay = $('#catjump-overlay');

    $('#catjump-restart').addEventListener('click', () => this.start());
  }

  stop() {
    this.running = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.spawnTimeout) {
      clearTimeout(this.spawnTimeout);
      this.spawnTimeout = null;
    }
    if (this.cookieTimeout) {
      clearTimeout(this.cookieTimeout);
      this.cookieTimeout = null;
    }
    this.canvas.removeEventListener('pointerdown', this.boundJump);
    document.removeEventListener('keydown', this.boundKeyDown);
    if (this.boundResize) {
      window.removeEventListener('resize', this.boundResize);
      this.boundResize = null;
    }
  }

  start() {
    this.stop();
    this.canvas.classList.remove('hidden');
    this.gameOverlay.classList.add('hidden');
    $('#catjump-restart').classList.remove('hidden');
    this.container.querySelector('.game-header').classList.remove('hidden');

    this.resizeCanvas();
    this.resetState();

    this.bestDisplay.textContent = this.bestScore;
    this.scoreDisplay.textContent = '0';

    this.canvas.addEventListener('pointerdown', this.boundJump);
    document.addEventListener('keydown', this.boundKeyDown);

    if (this.boundResize) window.removeEventListener('resize', this.boundResize);
    this.boundResize = () => {};
    window.addEventListener('resize', this.boundResize);

    this.running = true;
    this.gameOver = false;
    this.frame = 0;

    this.scheduleSpawn();
    this.scheduleCookie();
    this.loop();
  }

  resizeCanvas() {
    this.canvas.width = 800;
    this.canvas.height = 600;
    this.groundY = this.canvas.height - GROUND_HEIGHT;
  }

  resetState() {
    this.score = 0;
    this.speed = BASE_SPEED;
    this.dogs = [];
    this.cookies = [];
    this.dustParticles = [];
    this.pickupEffects = [];
    this.groundOffset = 0;

    const catAspect = this.spritesLoaded ? this.spriteMeta.catFrameW / this.spriteMeta.catFrameH : 1.25;
    this.cat.h = CAT_DRAW_H;
    this.cat.w = CAT_DRAW_H * catAspect;
    this.cat.baseX = 70;
    this.cat.x = 70;
    this.cat.y = this.groundY - this.cat.h;
    this.cat.vy = 0;
    this.cat.vx = 0;
    this.cat.grounded = true;
    this.cat.jumpsLeft = 2;
  }

  handleKeyDown(e) {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      this.jump();
    }
  }

  jump() {
    if (!this.running || this.gameOver) return;
    if (this.cat.jumpsLeft <= 0) return;

    const isDoubleJump = !this.cat.grounded;
    this.cat.vy = isDoubleJump ? JUMP_FORCE * 0.8 : JUMP_FORCE;
    this.cat.vx = isDoubleJump ? this.cat.vx : JUMP_FORWARD_VX;
    this.cat.grounded = false;
    this.cat.jumpsLeft--;

    const dustY = isDoubleJump ? this.cat.y + this.cat.h : this.groundY;
    const count = isDoubleJump ? 6 : 4;
    for (let i = 0; i < count; i++) {
      this.dustParticles.push({
        x: this.cat.x + this.cat.w / 2,
        y: dustY,
        vx: (Math.random() - 0.5) * 3,
        vy: isDoubleJump ? Math.random() * 2 + 0.5 : -Math.random() * 2 - 1,
        life: 1,
        size: Math.random() * 5 + 2,
        color: isDoubleJump ? '#FFD700' : undefined
      });
    }
  }

  scheduleSpawn() {
    if (!this.running || this.gameOver) return;
    const crownThreshold = (TREAT_TIERS.length - 1) * 10;
    let speedFactor;
    if (this.score < crownThreshold) {
      speedFactor = Math.max(0.5, 1 - this.score * 0.01);
    } else {
      const extra = this.score - crownThreshold;
      speedFactor = Math.max(0.2, 0.5 - extra * 0.005);
    }
    const delay = Math.random() * (SPAWN_MAX - SPAWN_MIN) * speedFactor + SPAWN_MIN * speedFactor;
    this.spawnTimeout = setTimeout(() => {
      this.spawnDog();
      this.scheduleSpawn();
    }, delay);
  }

  spawnDog() {
    if (!this.running || this.gameOver) return;
    const dogAspect = this.spritesLoaded ? this.spriteMeta.dogFrameW / this.spriteMeta.dogFrameH : 1.7;
    const dh = DOG_DRAW_H;
    const dw = dh * dogAspect;
    this.dogs.push({
      x: this.canvas.width + dw,
      y: this.groundY - dh,
      w: dw,
      h: dh,
      frame: Math.random() * 100 | 0
    });
  }

  scheduleCookie() {
    if (!this.running || this.gameOver) return;
    const delay = Math.random() * (COOKIE_SPAWN_MAX - COOKIE_SPAWN_MIN) + COOKIE_SPAWN_MIN;
    this.cookieTimeout = setTimeout(() => {
      this.spawnCookie();
      this.scheduleCookie();
    }, delay);
  }

  spawnCookie() {
    if (!this.running || this.gameOver) return;
    const minY = this.canvas.height * COOKIE_Y_MIN_RATIO;
    const maxY = this.groundY - COOKIE_SIZE;
    const y = Math.random() * (maxY - minY) + minY;
    const tierIdx = Math.min(Math.floor(this.score / 10), TREAT_TIERS.length - 1);
    const tier = TREAT_TIERS[tierIdx];
    this.cookies.push({
      x: this.canvas.width + COOKIE_SIZE,
      y,
      size: COOKIE_SIZE,
      collected: false,
      emoji: tier.emoji,
      points: tier.points
    });
  }

  loop() {
    if (!this.running) return;
    this.frame++;
    this.update();
    this.draw();
    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  update() {
    const { cat, dogs } = this;
    this.speed = BASE_SPEED + this.score * 0.08;
    this.groundOffset += this.speed;

    cat.vy += GRAVITY;
    cat.y += cat.vy;

    if (!cat.grounded) {
      cat.x += cat.vx;
      cat.vx *= 0.98;
    }

    if (cat.y >= this.groundY - cat.h) {
      cat.y = this.groundY - cat.h;
      cat.vy = 0;
      cat.vx = 0;
      cat.grounded = true;
      cat.jumpsLeft = 2;
    }

    if (cat.grounded && cat.x > cat.baseX) {
      cat.x -= this.speed * 0.7;
      if (cat.x < cat.baseX) cat.x = cat.baseX;
    }

    for (let i = dogs.length - 1; i >= 0; i--) {
      const dog = dogs[i];
      dog.x -= this.speed;
      dog.frame++;

      if (dog.x + dog.w < 0) {
        dogs.splice(i, 1);
        continue;
      }

      if (this.checkCollision(cat, dog)) {
        this.endGame();
        return;
      }
    }

    for (let i = this.cookies.length - 1; i >= 0; i--) {
      const c = this.cookies[i];
      c.x -= this.speed * 0.8;

      if (c.x + c.size < 0) {
        this.cookies.splice(i, 1);
        continue;
      }

      if (!c.collected && this.hitsCookie(cat, c)) {
        c.collected = true;
        this.score += c.points;
        this.scoreDisplay.textContent = this.score;
        const cx = c.x + c.size / 2;
        const cy = c.y + c.size / 2;
        const sparkleColors = ['#FFD700', '#FF69B4', '#00CED1', '#FF6347', '#7FFF00', '#FFA500'];
        const particleCount = 10 + c.points * 2;
        for (let j = 0; j < particleCount; j++) {
          const angle = (Math.PI * 2 / particleCount) * j + Math.random() * 0.3;
          const spd = Math.random() * 3 + 1.5 + c.points * 0.3;
          this.dustParticles.push({
            x: cx, y: cy,
            vx: Math.cos(angle) * spd,
            vy: Math.sin(angle) * spd,
            life: 1,
            size: Math.random() * 4 + 2,
            color: sparkleColors[j % sparkleColors.length]
          });
        }
        this.pickupEffects.push({ x: cx, y: cy, life: 1, text: `+${c.points}` });
        this.cookies.splice(i, 1);
      }
    }

    if (cat.grounded && this.frame % 4 === 0) {
      this.dustParticles.push({
        x: cat.x + 5,
        y: this.groundY,
        vx: -Math.random() * 1.5 - 0.5,
        vy: -Math.random() * 0.8,
        life: 1,
        size: Math.random() * 3 + 1
      });
    }

    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) this.dustParticles.splice(i, 1);
    }

    for (let i = this.pickupEffects.length - 1; i >= 0; i--) {
      const e = this.pickupEffects[i];
      e.y -= 1.2;
      e.life -= 0.025;
      if (e.life <= 0) this.pickupEffects.splice(i, 1);
    }
  }

  checkCollision(cat, dog) {
    const pad = 14;
    const cx = cat.x + pad;
    const cw = cat.w - pad * 2;
    const cy = cat.y + pad;
    const ch = cat.h - pad * 2;

    const dx = dog.x + pad;
    const dw = dog.w - pad * 2;
    const dy = dog.y + pad;
    const dh = dog.h - pad * 2;

    return cx < dx + dw && cx + cw > dx && cy < dy + dh && cy + ch > dy;
  }

  hitsCookie(cat, cookie) {
    const catCX = cat.x + cat.w / 2;
    const catCY = cat.y + cat.h / 2;
    const cookieCX = cookie.x + cookie.size / 2;
    const cookieCY = cookie.y + cookie.size / 2;
    const dist = Math.hypot(catCX - cookieCX, catCY - cookieCY);
    return dist < (cat.w / 2 + cookie.size / 2) * 0.7;
  }

  draw() {
    const { ctx, canvas } = this;
    const cW = canvas.width;
    const cH = canvas.height;
    const speed = this.speed;

    this.drawSky(cW, cH);
    this.drawGround(cW, cH, speed);

    for (const p of this.dustParticles) {
      ctx.globalAlpha = p.life * 0.6;
      ctx.fillStyle = p.color || '#C4A87C';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    for (const e of this.pickupEffects) {
      ctx.globalAlpha = e.life;
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 2.5;
      ctx.strokeText(e.text, e.x, e.y);
      ctx.fillText(e.text, e.x, e.y);
    }
    ctx.globalAlpha = 1;

    for (const cookie of this.cookies) {
      this.drawCookie(cookie);
    }

    for (const dog of this.dogs) {
      this.drawDog(dog);
    }

    this.drawCat();
  }

  drawSky(cW, cH) {
    const { ctx } = this;
    const sky = this.sprites.sky;
    if (sky && sky.complete) {
      ctx.drawImage(sky, 0, 0, sky.width, sky.height, 0, 0, cW, cH);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, cH);
      grad.addColorStop(0, '#4A90D9');
      grad.addColorStop(1, '#A8D8EA');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, cW, cH);
    }
  }

  drawGround(cW, cH, speed) {
    const { ctx } = this;
    const gY = this.groundY;
    const gH = cH - gY;
    const ground = this.sprites.ground;

    ctx.fillStyle = '#3D2B1A';
    ctx.fillRect(0, gY + gH / 2, cW, gH / 2);

    if (ground && ground.complete) {
      const tileW = ground.width;
      const offset = (this.groundOffset * 0.25) % tileW;
      for (let x = -offset; x < cW; x += tileW) {
        ctx.drawImage(ground, 0, 0, ground.width, ground.height, x, gY, tileW, gH);
      }
    }
  }

  drawCat() {
    if (!this.spritesLoaded) return;
    const { ctx, cat } = this;
    const jumping = !cat.grounded;
    const { catFrameW, catFrameH, catJumpW } = this.spriteMeta;

    if (jumping) {
      const sprite = this.sprites.catJump;
      const jumpAspect = catJumpW / catFrameH;
      const jumpH = cat.h * 0.6;
      const jumpW = jumpH * jumpAspect;
      const yOff = cat.h - jumpH;
      ctx.drawImage(sprite, 0, 0, sprite.width, sprite.height,
        cat.x, cat.y + yOff + SPRITE_Y_OFFSET, jumpW, jumpH);
    } else {
      const frameIdx = Math.floor(this.frame / ANIM_SPEED) % CAT_FRAMES;
      const sx = frameIdx * catFrameW;
      ctx.drawImage(this.sprites.catWalk, sx, 0, catFrameW, catFrameH,
        cat.x, cat.y + SPRITE_Y_OFFSET, cat.w, cat.h);
    }
  }

  drawDog(dog) {
    if (!this.spritesLoaded) return;
    const { ctx } = this;
    const { dogFrameW, dogFrameH } = this.spriteMeta;

    const frameIdx = Math.floor(dog.frame / ANIM_SPEED) % DOG_FRAMES;
    const sx = frameIdx * dogFrameW;
    ctx.drawImage(this.sprites.dogWalk, sx, 0, dogFrameW, dogFrameH,
      dog.x, dog.y + SPRITE_Y_OFFSET, dog.w, dog.h);
  }

  drawCookie(cookie) {
    const { ctx } = this;
    const bob = Math.sin(this.frame * 0.08) * 2;
    const fontSize = cookie.size * 1.3;
    ctx.font = `${fontSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(cookie.emoji, cookie.x + cookie.size / 2, cookie.y + cookie.size / 2 + bob);
  }

  endGame() {
    this.gameOver = true;
    this.stop();

    const isNewBest = this.score > this.bestScore;
    if (isNewBest) {
      this.bestScore = this.score;
      localStorage.setItem('catjump-best', String(this.bestScore));
      this.bestDisplay.textContent = this.bestScore;
    }

    this.gameOverlay.classList.remove('hidden');
    this.gameOverlay.querySelector('.overlay-title').textContent = isNewBest ? '🏆 Novi rekord!' : '😿 Jao!';
    this.gameOverlay.querySelector('.overlay-msg').textContent = `Sakupio si ${this.score} kolačića!${isNewBest ? ' Novi rekord!' : ' Pokušaj ponovo!'}`;
    this.gameOverlay.querySelector('.overlay-btn').textContent = '🔄 Pokušaj ponovo';
    this.gameOverlay.querySelector('.overlay-btn').onclick = () => this.start();
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
