import { CATEGORIES } from './data/stations.js';

const WHEEL_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#e9c46a', '#f4a261',
  '#264653', '#8338ec', '#ff006e', '#fb5607', '#3a86ff',
  '#06d6a0', '#118ab2', '#ef476f', '#ffd166', '#073b4c',
  '#80c241', '#0096d2', '#dd0077', '#f8b500', '#7c2683',
];

const state = {
  activeCategory: 'jr',
  selectedLines: new Set(),
  pool: [],
  isSpinning: false,
  currentRotation: 0,
};

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const resultCard = document.getElementById('resultCard');
const categoryTabs = document.getElementById('categoryTabs');
const lineList = document.getElementById('lineList');
const stationCount = document.getElementById('stationCount');
const selectAllBtn = document.getElementById('selectAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');

function init() {
  renderCategoryTabs();
  renderLineList();
  updatePool();
  drawWheel();
  bindEvents();
}

function renderCategoryTabs() {
  categoryTabs.innerHTML = Object.entries(CATEGORIES).map(([key, cat]) => `
    <button class="category-tab ${key === state.activeCategory ? 'active' : ''}" data-category="${key}">
      <span class="tab-icon">${cat.icon}</span>
      ${cat.label}
    </button>
  `).join('');
}

function renderLineList() {
  const cat = CATEGORIES[state.activeCategory];
  lineList.innerHTML = Object.entries(cat.lines).map(([key, line]) => {
    const id = `${state.activeCategory}:${key}`;
    const checked = state.selectedLines.has(id);
    return `
      <label class="line-item ${checked ? 'checked' : ''}" data-line-id="${id}">
        <input type="checkbox" ${checked ? 'checked' : ''} data-line-id="${id}">
        <span class="line-color" style="background:${line.color}"></span>
        <span class="line-info">
          <span class="line-name">${line.name}</span>
          <span class="line-count">${line.stations.length} 站</span>
        </span>
      </label>
    `;
  }).join('');
}

function updatePool() {
  state.pool = [];
  for (const lineId of state.selectedLines) {
    const [catKey, lineKey] = lineId.split(':');
    const cat = CATEGORIES[catKey];
    const line = cat.lines[lineKey];
    for (const station of line.stations) {
      state.pool.push({
        ...station,
        lineName: line.name,
        lineNameEn: line.nameEn,
        lineColor: line.color,
        categoryLabel: cat.label,
        lineId,
      });
    }
  }
  stationCount.textContent = `已選 ${state.pool.length} 個車站`;
  spinBtn.disabled = state.pool.length === 0 || state.isSpinning;
  drawWheel();
}

function drawWheel() {
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 4;

  ctx.clearRect(0, 0, size, size);

  if (state.pool.length === 0) {
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2332';
    ctx.fill();
    ctx.strokeStyle = '#2d3f56';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#8b9cb3';
    ctx.font = '16px "Noto Sans TC", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('請選擇路線', center, center - 10);
    ctx.font = '13px "Noto Sans TC", sans-serif';
    ctx.fillText('開始轉動', center, center + 14);
    return;
  }

  const count = state.pool.length;
  const sliceAngle = (Math.PI * 2) / count;

  for (let i = 0; i < count; i++) {
    const startAngle = i * sliceAngle - Math.PI / 2;
    const endAngle = startAngle + sliceAngle;
    const color = WHEEL_COLORS[i % WHEEL_COLORS.length];

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const midAngle = startAngle + sliceAngle / 2;
    const textRadius = radius * 0.65;
    const textX = center + Math.cos(midAngle) * textRadius;
    const textY = center + Math.sin(midAngle) * textRadius;

    ctx.save();
    ctx.translate(textX, textY);
    ctx.rotate(midAngle + Math.PI / 2);

    const label = state.pool[i].name;
    const fontSize = count > 20 ? 9 : count > 12 ? 11 : 13;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${fontSize}px "Noto Sans JP", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 3;

    const maxWidth = radius * 0.45;
    if (ctx.measureText(label).width > maxWidth && label.length > 3) {
      ctx.fillText(label.slice(0, 3) + '…', 0, 0);
    } else {
      ctx.fillText(label, 0, 0);
    }
    ctx.restore();
  }

  ctx.beginPath();
  ctx.arc(center, center, 28, 0, Math.PI * 2);
  ctx.fillStyle = '#0f1419';
  ctx.fill();
  ctx.strokeStyle = '#e63946';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#e63946';
  ctx.font = 'bold 11px "Noto Sans TC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GO', center, center);
}

function spin() {
  if (state.isSpinning || state.pool.length === 0) return;

  state.isSpinning = true;
  spinBtn.disabled = true;
  spinBtn.classList.add('spinning');
  resultCard.classList.remove('winner');
  resultCard.innerHTML = `
    <div class="result-placeholder">
      <span class="result-icon">🎡</span>
      <p>轉動中...</p>
    </div>
  `;

  const winnerIndex = Math.floor(Math.random() * state.pool.length);
  const winner = state.pool[winnerIndex];
  const sliceAngle = 360 / state.pool.length;

  const targetAngle = 360 - (winnerIndex * sliceAngle + sliceAngle / 2);
  const extraSpins = 5 + Math.floor(Math.random() * 3);
  const totalRotation = state.currentRotation + extraSpins * 360 + targetAngle - (state.currentRotation % 360);

  const duration = 4000 + Math.random() * 1000;
  const startTime = performance.now();
  const startRotation = state.currentRotation;

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOut(progress);
    const rotation = startRotation + (totalRotation - startRotation) * eased;

    canvas.style.transform = `rotate(${rotation}deg)`;
    state.currentRotation = rotation;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      state.isSpinning = false;
      spinBtn.disabled = state.pool.length === 0;
      spinBtn.classList.remove('spinning');
      showResult(winner);
    }
  }

  requestAnimationFrame(animate);
}

function showResult(station) {
  resultCard.classList.add('winner');
  resultCard.innerHTML = `
    <div>
      <div class="result-station">${station.name}</div>
      <div class="result-romaji">${station.romaji}</div>
      <div class="result-line">
        <span class="result-line-dot" style="background:${station.lineColor}"></span>
        ${station.lineName}
      </div>
      <div class="result-prefecture">${station.prefecture}</div>
    </div>
  `;
}

function bindEvents() {
  categoryTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.category-tab');
    if (!tab) return;
    state.activeCategory = tab.dataset.category;
    renderCategoryTabs();
    renderLineList();
  });

  lineList.addEventListener('change', (e) => {
    const checkbox = e.target;
    if (!checkbox.dataset.lineId) return;
    const lineId = checkbox.dataset.lineId;
    const item = checkbox.closest('.line-item');

    if (checkbox.checked) {
      state.selectedLines.add(lineId);
      item.classList.add('checked');
    } else {
      state.selectedLines.delete(lineId);
      item.classList.remove('checked');
    }
    updatePool();
  });

  selectAllBtn.addEventListener('click', () => {
    const cat = CATEGORIES[state.activeCategory];
    for (const key of Object.keys(cat.lines)) {
      state.selectedLines.add(`${state.activeCategory}:${key}`);
    }
    renderLineList();
    updatePool();
  });

  clearAllBtn.addEventListener('click', () => {
    const cat = CATEGORIES[state.activeCategory];
    for (const key of Object.keys(cat.lines)) {
      state.selectedLines.delete(`${state.activeCategory}:${key}`);
    }
    renderLineList();
    updatePool();
  });

  spinBtn.addEventListener('click', spin);
}

init();
