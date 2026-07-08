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
  lastCatResult: null,
};

const CAT_IMAGE_SRC = new URL('./cat.png', import.meta.url).href;
let catImage = null;
let catImageLoadPromise = null;

const canvas = document.getElementById('wheelCanvas');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spinBtn');
const resultCard = document.getElementById('resultCard');
const categoryTabs = document.getElementById('categoryTabs');
const lineList = document.getElementById('lineList');
const stationCount = document.getElementById('stationCount');
const selectAllBtn = document.getElementById('selectAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const catOverlay = document.getElementById('catOverlay');
const catStationName = document.getElementById('catStationName');
const catStationLink = document.getElementById('catStationLink');
const catStationPrefecture = document.getElementById('catStationPrefecture');
const catDownloadBtn = document.getElementById('catDownloadBtn');
const catShareBtn = document.getElementById('catShareBtn');
const catCloseBtn = document.getElementById('catCloseBtn');

function init() {
  renderCategoryTabs();
  renderLineList();
  updatePool();
  drawWheel();
  bindEvents();
  preloadCatImage();
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

function stationKey(station) {
  return `${station.name}|${station.prefecture}`;
}

function getGoogleMapsUrl(stationName, prefecture) {
  const label = stationName.endsWith('駅') ? stationName : `${stationName}駅`;
  const query = `${label} ${prefecture}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function updatePool() {
  const uniqueStations = new Map();

  for (const lineId of state.selectedLines) {
    const [catKey, lineKey] = lineId.split(':');
    const cat = CATEGORIES[catKey];
    const line = cat.lines[lineKey];
    const lineInfo = {
      lineName: line.name,
      lineNameEn: line.nameEn,
      lineColor: line.color,
      categoryLabel: cat.label,
      lineId,
    };

    for (const station of line.stations) {
      const key = stationKey(station);
      const existing = uniqueStations.get(key);

      if (existing) {
        existing.lines.push(lineInfo);
      } else {
        uniqueStations.set(key, {
          name: station.name,
          romaji: station.romaji,
          prefecture: station.prefecture,
          lines: [lineInfo],
        });
      }
    }
  }

  state.pool = Array.from(uniqueStations.values());
  stationCount.textContent = `已選 ${state.pool.length} 個車站（去重）`;
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
  const line = station.lines[Math.floor(Math.random() * station.lines.length)];
  const extraLines = station.lines.length > 1
    ? `<div class="result-prefecture">亦經 ${station.lines.length} 條路線</div>`
    : '';

  resultCard.classList.add('winner');
  resultCard.innerHTML = `
    <div>
      <div class="result-station">${station.name}</div>
      <div class="result-romaji">${station.romaji}</div>
      <div class="result-line">
        <span class="result-line-dot" style="background:${line.lineColor}"></span>
        ${line.lineName}
      </div>
      <div class="result-prefecture">${station.prefecture}</div>
      ${extraLines}
    </div>
  `;

  showCatReveal(station.name, station.prefecture);
}

function preloadCatImage() {
  if (catImage) return Promise.resolve(catImage);
  if (catImageLoadPromise) return catImageLoadPromise;

  catImageLoadPromise = (async () => {
    const response = await fetch(CAT_IMAGE_SRC);
    if (!response.ok) throw new Error('無法載入貓咪圖片');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        catImage = img;
        URL.revokeObjectURL(blobUrl);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(blobUrl);
        reject(new Error('無法載入貓咪圖片'));
      };
      img.src = blobUrl;
    });
  })().catch((error) => {
    catImageLoadPromise = null;
    throw error;
  });

  return catImageLoadPromise;
}

function fillRoundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  ctx.fill();
}

function canvasToBlob(exportCanvas) {
  return new Promise((resolve, reject) => {
    if (exportCanvas.toBlob) {
      exportCanvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        fallbackToDataUrl();
      }, 'image/png');
      return;
    }

    fallbackToDataUrl();

    function fallbackToDataUrl() {
      try {
        const dataUrl = exportCanvas.toDataURL('image/png');
        fetch(dataUrl)
          .then((res) => res.blob())
          .then(resolve)
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    }
  });
}

function drawOutlinedText(ctx, text, x, y, { font, fill, stroke, lineWidth }) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawTextBadge(ctx, parts, centerX, centerY, fontSize) {
  const font = `900 ${fontSize}px "Noto Sans JP", "Noto Sans TC", sans-serif`;
  const gap = fontSize * 0.15;
  ctx.font = font;

  const widths = parts.map((part) => ctx.measureText(part.text).width);
  const totalW = widths.reduce((sum, w) => sum + w, 0) + gap * (parts.length - 1);
  const padX = fontSize * 0.4;
  const padY = fontSize * 0.15;
  const boxW = totalW + padX * 2;
  const boxH = fontSize + padY * 2;
  const boxX = centerX - boxW / 2;
  const boxY = centerY - boxH / 2;

  ctx.fillStyle = 'rgba(12, 6, 30, 0.92)';
  fillRoundRect(ctx, boxX, boxY, boxW, boxH, fontSize * 0.15);

  let cursorX = centerX - totalW / 2;
  parts.forEach((part, index) => {
    const textWidth = widths[index];
    const textX = cursorX + textWidth / 2;
    drawOutlinedText(ctx, part.text, textX, centerY, {
      font,
      fill: part.fill,
      stroke: '#000',
      lineWidth: fontSize * 0.06,
    });
    cursorX += textWidth + gap;
  });
}

async function generateCatImageBlob(stationName, prefecture) {
  const image = await preloadCatImage();
  await document.fonts.ready;

  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('貓咪圖片尺寸無效');

  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = width;
  exportCanvas.height = height;
  const exportCtx = exportCanvas.getContext('2d');

  exportCtx.drawImage(image, 0, 0, width, height);

  const captionSize = Math.round(width * 0.032);
  const prefectureSize = Math.round(width * 0.023);
  const centerX = width / 2;
  const captionY = height * 0.055;
  const lineGap = height * 0.045;
  const captionBadgeH = captionSize + captionSize * 0.3;
  const prefectureY = captionY + captionBadgeH / 2 + lineGap + prefectureSize / 2;

  drawTextBadge(
    exportCtx,
    [
      { text: 'ㄇㄧㄠˊ？前往', fill: '#ffffff' },
      { text: stationName, fill: '#ffe566' },
      { text: '站', fill: '#ffffff' },
    ],
    centerX,
    captionY,
    captionSize,
  );

  drawTextBadge(
    exportCtx,
    [{ text: prefecture, fill: '#b8e0ff' }],
    centerX,
    prefectureY,
    prefectureSize,
  );

  return canvasToBlob(exportCanvas);
}

function setCatActionButtonsLoading(isLoading) {
  catDownloadBtn.disabled = isLoading || !state.lastCatResult;
  catShareBtn.disabled = isLoading || !state.lastCatResult;
  catDownloadBtn.textContent = isLoading ? '產生中...' : '下載圖片';
  if (!isLoading) catShareBtn.textContent = '分享';
}

function downloadCatImage() {
  const result = state.lastCatResult;
  if (!result?.blob) return;

  const fileName = `貓咪前往${result.name}站.png`;
  const url = URL.createObjectURL(result.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadCatImageWithFallback() {
  const result = state.lastCatResult;
  if (!result?.blob) return;

  const fileName = `貓咪前往${result.name}站.png`;
  const file = new File([result.blob], fileName, { type: 'image/png' });

  if (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '日本車站轉盤' });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }

  downloadCatImage();
}

async function shareCatImage() {
  const result = state.lastCatResult;
  if (!result?.blob) return;

  const fileName = `貓咪前往${result.name}站.png`;
  const file = new File([result.blob], fileName, { type: 'image/png' });
  const shareText = `ㄇㄧㄠˊ？前往 ${result.name} 站（${result.prefecture}）`;

  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        title: '日本車站轉盤',
        text: shareText,
        files: [file],
      });
      return;
    }

    if (navigator.share) {
      await navigator.share({
        title: '日本車站轉盤',
        text: `${shareText}\n${window.location.href}`,
      });
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(`${shareText}\n${window.location.href}`);
      catShareBtn.textContent = '已複製！';
      setTimeout(() => {
        catShareBtn.textContent = '分享';
      }, 2000);
      return;
    }

    downloadCatImage();
  } catch (error) {
    if (error.name === 'AbortError') return;
    downloadCatImage();
  }
}

async function showCatReveal(stationName, prefecture) {
  catStationName.textContent = stationName;
  catStationLink.href = getGoogleMapsUrl(stationName, prefecture);
  catStationPrefecture.textContent = prefecture;
  catOverlay.classList.remove('closing');
  catOverlay.hidden = false;
  document.body.style.overflow = 'hidden';
  state.lastCatResult = null;
  setCatActionButtonsLoading(true);

  [catStationLink, catStationPrefecture].forEach((el) => {
    el.style.animation = 'none';
    el.offsetHeight;
    el.style.animation = '';
  });

  try {
    const blob = await generateCatImageBlob(stationName, prefecture);
    state.lastCatResult = { blob, name: stationName, prefecture };
    setCatActionButtonsLoading(false);
  } catch (error) {
    console.error(error);
    setCatActionButtonsLoading(false);
    catDownloadBtn.textContent = '產生失敗';
    catShareBtn.textContent = '產生失敗';
  }
}

function hideCatReveal() {
  catOverlay.classList.add('closing');
  setTimeout(() => {
    catOverlay.hidden = true;
    catOverlay.classList.remove('closing');
    document.body.style.overflow = '';
  }, 250);
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

  catDownloadBtn.addEventListener('click', downloadCatImageWithFallback);
  catShareBtn.addEventListener('click', shareCatImage);
  catCloseBtn.addEventListener('click', hideCatReveal);
  catOverlay.querySelector('.cat-overlay-backdrop').addEventListener('click', hideCatReveal);
}

init();
