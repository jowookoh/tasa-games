import { GameBase } from '../game-base.js';
import { $, shuffleArray, cacheBust } from '../utils.js';

const PHOTO_TEMPLATES = [
  'images/photo-1.webp',
  'images/photo-2.webp',
  'images/photo-3.webp',
  'images/photo-4.webp',
  'images/photo-5.webp',
  'images/photo-6.webp',
  'images/photo-7.webp',
  'images/photo-8.webp',
  'images/photo-9.webp',
];

const GRID_SIZE = 224;
const FLOOD_THRESHOLD = 70;
const MIN_REGION_SIZE = 80;
const GRAD_START = [102, 126, 234];
const GRAD_END = [118, 75, 162];

function neighbors(idx) {
  const col = idx % GRID_SIZE;
  const row = (idx - col) / GRID_SIZE;
  const out = [];
  if (col > 0) out.push(idx - 1);
  if (col < GRID_SIZE - 1) out.push(idx + 1);
  if (row > 0) out.push(idx - GRID_SIZE);
  if (row < GRID_SIZE - 1) out.push(idx + GRID_SIZE);
  return out;
}

function buildRegions(rgbData) {
  const total = GRID_SIZE * GRID_SIZE;
  const regionMap = new Int32Array(total).fill(-1);
  const regions = [];

  for (let i = 0; i < total; i++) {
    if (regionMap[i] >= 0) continue;
    const regionId = regions.length;
    const pixels = [];
    const queue = [i];
    regionMap[i] = regionId;

    const sr = rgbData[i * 3], sg = rgbData[i * 3 + 1], sb = rgbData[i * 3 + 2];

    while (queue.length > 0) {
      const idx = queue.pop();
      pixels.push(idx);

      for (const n of neighbors(idx)) {
        if (regionMap[n] >= 0) continue;
        const nr = rgbData[n * 3], ng = rgbData[n * 3 + 1], nb = rgbData[n * 3 + 2];
        const dist = Math.sqrt((sr - nr) ** 2 + (sg - ng) ** 2 + (sb - nb) ** 2);
        if (dist <= FLOOD_THRESHOLD) {
          regionMap[n] = regionId;
          queue.push(n);
        }
      }
    }
    regions.push(pixels);
  }

  for (let r = 0; r < regions.length; r++) {
    if (regions[r].length >= MIN_REGION_SIZE) continue;

    const neighborRegions = new Map();
    for (const idx of regions[r]) {
      for (const n of neighbors(idx)) {
        const nrId = regionMap[n];
        if (nrId !== r) {
          neighborRegions.set(nrId, (neighborRegions.get(nrId) || 0) + 1);
        }
      }
    }

    let bestNeighbor = -1, bestCount = 0;
    for (const [nrId, count] of neighborRegions) {
      if (count > bestCount) { bestCount = count; bestNeighbor = nrId; }
    }

    if (bestNeighbor >= 0) {
      for (const idx of regions[r]) {
        regionMap[idx] = bestNeighbor;
      }
      regions[bestNeighbor].push(...regions[r]);
      regions[r] = [];
    }
  }

  return { regionMap, regions };
}

export class PixelGame extends GameBase {
  constructor(app) {
    super('pixel', app);
    this.activeIdx = 0;
    this.templates = [];
    this.canvas = null;
    this.ctx = null;
    this.animating = false;
    this.progressEl = null;
  }

  init() {
    $('#pixel-palette').style.display = 'none';

    const gridEl = $('#pixel-grid');
    gridEl.innerHTML = '';
    gridEl.style.display = 'none';

    const wrap = gridEl.parentElement;

    this.canvas = document.createElement('canvas');
    this.canvas.width = GRID_SIZE;
    this.canvas.height = GRID_SIZE;
    this.canvas.className = 'pixel-canvas';
    wrap.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    this.progressEl = document.createElement('div');
    this.progressEl.className = 'pixel-progress';
    wrap.appendChild(this.progressEl);

    this.canvas.addEventListener('click', (e) => this.handleClick(e));
  }

  start() {
    this.templates = PHOTO_TEMPLATES.map(() => ({
      rgbData: null,
      regionMap: null,
      regions: null,
      revealed: null,
      loaded: false,
    }));
    this.activeIdx = 0;
    this.order = shuffleArray(PHOTO_TEMPLATES.map((_, i) => i));
    this.loadAllTemplates();
    this.updateProgress();
    this.drawCanvas();
  }

  loadAllTemplates() {
    PHOTO_TEMPLATES.forEach((src, i) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const rgbData = this.pixelateImage(img);
        const { regionMap, regions } = buildRegions(rgbData);
        this.templates[i].rgbData = rgbData;
        this.templates[i].regionMap = regionMap;
        this.templates[i].regions = regions;
        this.templates[i].revealed = new Uint8Array(regions.length);
        this.templates[i].loaded = true;
        if (i === this.currentTplIdx) this.drawCanvas();
      };
      img.src = cacheBust(src);
    });
  }

  get currentTplIdx() {
    return this.order[this.activeIdx];
  }

  updateProgress() {
    if (!this.progressEl) return;
    this.progressEl.textContent = `${this.activeIdx + 1} / ${PHOTO_TEMPLATES.length}`;
  }

  pixelateImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = GRID_SIZE;
    canvas.height = GRID_SIZE;
    const ctx = canvas.getContext('2d');
    const minDim = Math.min(img.width, img.height);
    const sx = (img.width - minDim) / 2;
    const sy = (img.height - minDim) / 2;
    ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, GRID_SIZE, GRID_SIZE);
    const imageData = ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
    const rgbData = new Uint8Array(GRID_SIZE * GRID_SIZE * 3);
    for (let i = 0, j = 0; i < imageData.data.length; i += 4, j += 3) {
      rgbData[j] = imageData.data[i];
      rgbData[j + 1] = imageData.data[i + 1];
      rgbData[j + 2] = imageData.data[i + 2];
    }
    return rgbData;
  }

  advanceToNext() {
    if (this.activeIdx < PHOTO_TEMPLATES.length - 1) {
      this.activeIdx++;
      this.updateProgress();
      this.drawCanvas();
    }
  }

  drawCanvas() {
    const tpl = this.templates[this.currentTplIdx];
    const imageData = this.ctx.createImageData(GRID_SIZE, GRID_SIZE);
    const d = imageData.data;

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const regionId = tpl.regionMap ? tpl.regionMap[i] : -1;
      const isRevealed = tpl.revealed && regionId >= 0 && tpl.revealed[regionId];
      const pi = i * 4;

      if (isRevealed && tpl.rgbData) {
        const ri = i * 3;
        d[pi] = tpl.rgbData[ri];
        d[pi + 1] = tpl.rgbData[ri + 1];
        d[pi + 2] = tpl.rgbData[ri + 2];
      } else {
        const col = i % GRID_SIZE;
        const row = (i - col) / GRID_SIZE;
        const t = (col + row) / (GRID_SIZE * 2);
        d[pi] = GRAD_START[0] + (GRAD_END[0] - GRAD_START[0]) * t;
        d[pi + 1] = GRAD_START[1] + (GRAD_END[1] - GRAD_START[1]) * t;
        d[pi + 2] = GRAD_START[2] + (GRAD_END[2] - GRAD_START[2]) * t;
      }
      d[pi + 3] = 255;
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  handleClick(e) {
    if (this.animating) return;
    const tpl = this.templates[this.currentTplIdx];
    if (!tpl.loaded) return;

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = GRID_SIZE / rect.width;
    const scaleY = GRID_SIZE / rect.height;
    const px = Math.floor((e.clientX - rect.left) * scaleX);
    const py = Math.floor((e.clientY - rect.top) * scaleY);
    const idx = py * GRID_SIZE + px;

    if (idx < 0 || idx >= GRID_SIZE * GRID_SIZE) return;

    const regionId = tpl.regionMap[idx];
    if (regionId < 0 || tpl.revealed[regionId]) return;

    this.revealRegion(regionId);
  }

  revealRegion(regionId) {
    const tpl = this.templates[this.currentTplIdx];
    const pixels = tpl.regions[regionId];
    if (!pixels || pixels.length === 0) return;

    this.animating = true;
    tpl.revealed[regionId] = 1;

    const cx = pixels.reduce((s, i) => s + i % GRID_SIZE, 0) / pixels.length;
    const cy = pixels.reduce((s, i) => s + Math.floor(i / GRID_SIZE), 0) / pixels.length;

    const sorted = [...pixels].sort((a, b) => {
      const da = Math.abs(a % GRID_SIZE - cx) + Math.abs(Math.floor(a / GRID_SIZE) - cy);
      const db = Math.abs(b % GRID_SIZE - cx) + Math.abs(Math.floor(b / GRID_SIZE) - cy);
      return da - db;
    });

    const steps = 12;
    const chunkSize = Math.ceil(sorted.length / steps);
    const imageData = this.ctx.getImageData(0, 0, GRID_SIZE, GRID_SIZE);
    const d = imageData.data;

    let step = 0;
    const animate = () => {
      const start = step * chunkSize;
      const end = Math.min(start + chunkSize, sorted.length);

      for (let j = start; j < end; j++) {
        const i = sorted[j];
        const pi = i * 4;
        const ri = i * 3;
        d[pi] = tpl.rgbData[ri];
        d[pi + 1] = tpl.rgbData[ri + 1];
        d[pi + 2] = tpl.rgbData[ri + 2];
      }
      this.ctx.putImageData(imageData, 0, 0);
      step++;

      if (step < steps) {
        requestAnimationFrame(animate);
      } else {
        this.animating = false;
        this.autoRevealSmall();
      }
    };
    requestAnimationFrame(animate);
  }

  autoRevealSmall() {
    const tpl = this.templates[this.currentTplIdx];
    const toAutoReveal = [];

    for (let r = 0; r < tpl.regions.length; r++) {
      if (tpl.revealed[r] || tpl.regions[r].length === 0) continue;

      let bordered = false;
      for (const idx of tpl.regions[r]) {
        for (const n of neighbors(idx)) {
          const nrId = tpl.regionMap[n];
          if (nrId !== r && tpl.revealed[nrId]) { bordered = true; break; }
        }
        if (bordered) break;
      }

      if (bordered && tpl.regions[r].length < MIN_REGION_SIZE) {
        toAutoReveal.push(r);
      }
    }

    if (toAutoReveal.length > 0) {
      for (const r of toAutoReveal) tpl.revealed[r] = 1;
      this.drawCanvas();
      requestAnimationFrame(() => this.autoRevealSmall());
    } else {
      this.checkCompletion();
    }
  }

  checkCompletion() {
    const tpl = this.templates[this.currentTplIdx];
    for (let r = 0; r < tpl.regions.length; r++) {
      if (tpl.regions[r].length > 0 && !tpl.revealed[r]) return;
    }

    const wrap = this.canvas.parentElement;
    if (wrap.querySelector('.pixel-complete-overlay')) return;

    const isLast = this.activeIdx >= PHOTO_TEMPLATES.length - 1;

    setTimeout(() => {
      const overlay = document.createElement('div');
      overlay.className = 'pixel-complete-overlay';
      overlay.innerHTML = `
        <div class="pixel-complete-content">
          <h2>🎉 Bravo Tašo! 🎉</h2>
          <button class="action-btn primary pixel-next-btn">${isLast ? '👍 OK' : '➡️ Dalje'}</button>
        </div>
      `;
      wrap.appendChild(overlay);
      overlay.querySelector('.pixel-next-btn').addEventListener('click', () => {
        overlay.remove();
        if (!isLast) this.advanceToNext();
      });
    }, 300);
  }

  onEnter() {
    this.start();
  }

  onPlayAgain() {
    this.start();
  }

  destroy() {}
}
