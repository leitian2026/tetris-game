// 俄罗斯方块核心逻辑（豪华版）
const COLS = 10;
const ROWS = 20;
let BLOCK = 30; // 正方形格子边长

const COLORS = [
  null,
  '#00f0f0',
  '#0000f0',
  '#f0a000',
  '#f0f000',
  '#00f000',
  '#a000f0',
  '#f00000',
];

const SHAPES = [
  [],
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[2,0,0],[2,2,2],[0,0,0]],
  [[0,0,3],[3,3,3],[0,0,0]],
  [[4,4],[4,4]],
  [[0,5,5],[5,5,0],[0,0,0]],
  [[0,6,0],[6,6,6],[0,0,0]],
  [[7,7,0],[0,7,7],[0,0,0]],
];

const LINE_POINTS = [0, 100, 300, 500, 800];
const CLEAR_DURATION = 260; // ms，消行闪光动画时长

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas ? holdCanvas.getContext('2d') : null;
const boardWrap = document.getElementById('boardWrap');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const startOverlay = document.getElementById('startOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameoverOverlay = document.getElementById('gameoverOverlay');
const finalScoreEl = document.getElementById('finalScore');
const bestStartEl = document.getElementById('bestStart');
const bestFinalEl = document.getElementById('bestFinal');
const newBestBadge = document.getElementById('newBestBadge');
const toastEl = document.getElementById('toast');

let board = createMatrix(COLS, ROWS);
let piece = null;
let bag = [];
let queue = [];
let holdType = null;
let holdUsed = false;
let score = 0;
let lines = 0;
let level = 1;
let combo = -1;
let dropInterval = 1000;
let lastTime = 0;
let dropCounter = 0;
let animId = null;
let running = false;
let paused = false;
let settingsPaused = false;
let gameOver = false;
let clearingRows = null;
let clearStart = 0;
let toastTimer = null;
let beatBestThisGame = false;

let best = 0;
try { best = Number(localStorage.getItem('tetris-best') || 0) || 0; } catch (e) {}

if (typeof window.TETRIS_GHOST_ALPHA !== 'number') {
  window.TETRIS_GHOST_ALPHA = 0.25;
}

// ===== 音效（纯合成音，无需外部资源，离线可用） =====
let soundOn = true;
let audioCtx = null;
function ensureAudio() {
  if (audioCtx) return;
  try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { audioCtx = null; }
}
function beep(freq, duration, type, gainVal) {
  if (!soundOn) return;
  ensureAudio();
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    const g = gainVal != null ? gainVal : 0.05;
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(g, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {}
}
function playSound(kind) {
  switch (kind) {
    case 'move': beep(220, 0.05, 'square', 0.025); break;
    case 'rotate': beep(330, 0.07, 'square', 0.035); break;
    case 'hold': beep(440, 0.07, 'triangle', 0.04); break;
    case 'lock': beep(150, 0.06, 'square', 0.03); break;
    case 'hard': beep(150, 0.09, 'square', 0.05); break;
    case 'clear1': beep(523, 0.14, 'sawtooth', 0.05); break;
    case 'clear2': beep(587, 0.16, 'sawtooth', 0.055); break;
    case 'clear3': beep(659, 0.18, 'sawtooth', 0.06); break;
    case 'tetris': beep(880, 0.28, 'sawtooth', 0.08); setTimeout(() => beep(1108, 0.22, 'sawtooth', 0.07), 90); break;
    case 'levelup': beep(660, 0.1, 'triangle', 0.06); setTimeout(() => beep(880, 0.18, 'triangle', 0.06), 90); break;
    case 'gameover': beep(200, 0.15, 'sawtooth', 0.07); setTimeout(() => beep(120, 0.4, 'sawtooth', 0.07), 140); break;
  }
}
window.TETRIS_SET_SOUND = function (v) { soundOn = !!v; };

// 打开设置面板时静默暂停游戏（不弹出“已暂停”遮罩），关闭后恢复。
// 修复：以前打开设置调整参数时方块仍在持续下落。
window.TETRIS_SET_SETTINGS_PAUSE = function (open) {
  if (!running || gameOver) return;
  if (open) {
    if (!paused && !settingsPaused) {
      settingsPaused = true;
      cancelAnimationFrame(animId);
    }
  } else if (settingsPaused) {
    settingsPaused = false;
    if (!paused) {
      lastTime = performance.now();
      animId = requestAnimationFrame(update);
    }
  }
};

function showToast(text, kind) {
  if (!toastEl) return;
  toastEl.textContent = text;
  toastEl.className = 'toast show' + (kind ? ' ' + kind : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = 'toast'; }, 850);
}

/**
 * 根据外框当前尺寸，取最大正方形格子；
 * 再把外框收成画布实际大小（无黑边、不拉伸）。
 * 由 ui 先设好期望宽高，本函数负责「贴合」。
 */
function syncCanvasSize() {
  if (!boardWrap) return;
  const maxW = Math.max(100, boardWrap.clientWidth || 200);
  const maxH = Math.max(200, boardWrap.clientHeight || 400);
  const cell = Math.max(8, Math.floor(Math.min(maxW / COLS, maxH / ROWS)));
  BLOCK = cell;
  const cw = cell * COLS;
  const ch = cell * ROWS;

  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  canvas.style.width = cw + 'px';
  canvas.style.height = ch + 'px';

  if (boardWrap.clientWidth !== cw || boardWrap.clientHeight !== ch) {
    boardWrap.style.width = cw + 'px';
    boardWrap.style.height = ch + 'px';
  }

  if (typeof window.TETRIS_ON_BOARD_SIZED === 'function') {
    window.TETRIS_ON_BOARD_SIZED(cw, ch);
  }

  draw();
  drawNext();
  drawHold();
}
window.TETRIS_RESIZE_CANVAS = syncCanvasSize;

function createMatrix(w, h) {
  const m = [];
  while (h--) m.push(new Array(w).fill(0));
  return m;
}

function createPiece(type) {
  const shape = SHAPES[type].map(row => [...row]);
  return {
    matrix: shape,
    pos: { x: Math.floor(COLS / 2) - Math.ceil(shape[0].length / 2), y: 0 },
    type
  };
}

// 7 袋随机：每 7 个方块保证 I/J/L/O/S/T/Z 各出现一次，避免长时间抽不到某个方块
function refillBag() {
  bag = [1, 2, 3, 4, 5, 6, 7];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
}
function nextFromBag() {
  if (bag.length === 0) refillBag();
  return bag.pop();
}
function ensureQueue() {
  while (queue.length < 4) queue.push(nextFromBag());
}
function spawnFromQueue() {
  ensureQueue();
  const type = queue.shift();
  ensureQueue();
  return createPiece(type);
}

function collide(board, piece) {
  const m = piece.matrix;
  const o = piece.pos;
  for (let y = 0; y < m.length; y++) {
    for (let x = 0; x < m[y].length; x++) {
      if (m[y][x] !== 0 &&
          (board[y + o.y] === undefined ||
           board[y + o.y][x + o.x] === undefined ||
           board[y + o.y][x + o.x] !== 0)) {
        return true;
      }
    }
  }
  return false;
}

function merge(board, piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) {
        board[y + piece.pos.y][x + piece.pos.x] = val;
      }
    });
  });
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < y; x++) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    }
  }
  if (dir > 0) {
    matrix.forEach(row => row.reverse());
  } else {
    matrix.reverse();
  }
}

function playerRotate(dir) {
  if (!piece || gameOver || paused || settingsPaused || clearingRows) return;
  const pos = piece.pos.x;
  let offset = 1;
  rotate(piece.matrix, dir);
  while (collide(board, piece)) {
    piece.pos.x += offset;
    offset = -(offset + (offset > 0 ? 1 : -1));
    if (offset > piece.matrix[0].length) {
      rotate(piece.matrix, -dir);
      piece.pos.x = pos;
      return;
    }
  }
  playSound('rotate');
}

function playerMove(dir) {
  if (!piece || gameOver || paused || settingsPaused || clearingRows) return;
  piece.pos.x += dir;
  if (collide(board, piece)) {
    piece.pos.x -= dir;
  } else {
    playSound('move');
  }
}

function playerDrop(manual) {
  if (!piece || gameOver || paused || settingsPaused || clearingRows) return;
  piece.pos.y++;
  if (collide(board, piece)) {
    piece.pos.y--;
    lockPiece();
  } else if (manual) {
    score += 1; // 手动加速下落给分，鼓励主动操作
    updateStats();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (!piece || gameOver || paused || settingsPaused || clearingRows) return;
  let dist = 0;
  while (!collide(board, piece)) {
    piece.pos.y++;
    dist++;
  }
  piece.pos.y--;
  dist = Math.max(0, dist - 1);
  score += dist * 2;
  playSound('hard');
  lockPiece();
  dropCounter = 0;
  updateStats();
}

function holdSwap() {
  if (!piece || gameOver || paused || settingsPaused || clearingRows || holdUsed) return;
  const curType = piece.type;
  if (holdType === null) {
    holdType = curType;
    piece = spawnFromQueue();
  } else {
    const t = holdType;
    holdType = curType;
    piece = createPiece(t);
  }
  holdUsed = true;
  playSound('hold');
  if (collide(board, piece)) {
    gameOver = true;
    running = false;
    cancelAnimationFrame(animId);
    endGame();
  }
  drawHold();
  drawNext();
}

function lockPiece() {
  merge(board, piece);
  piece = null;
  holdUsed = false;
  playSound('lock');
  const rows = getFullRows();
  if (rows.length > 0) {
    clearingRows = rows;
    clearStart = performance.now();
    playSound(rows.length >= 4 ? 'tetris' : (rows.length === 1 ? 'clear1' : rows.length === 2 ? 'clear2' : 'clear3'));
  } else {
    combo = -1;
    resetPiece();
  }
}

function getFullRows() {
  const rows = [];
  for (let y = 0; y < board.length; y++) {
    if (board[y].every(v => v !== 0)) rows.push(y);
  }
  return rows;
}

function finishClear() {
  const rowsToClear = clearingRows.slice().sort((a, b) => a - b);
  const n = rowsToClear.length;
  rowsToClear.forEach(y => {
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
  });
  lines += n;
  const base = (LINE_POINTS[n] || 800) * level;
  let comboBonus = 0;
  combo++;
  if (combo > 0) comboBonus = 50 * combo * level;
  score += base + comboBonus;

  const newLevel = Math.floor(lines / 10) + 1;
  const leveledUp = newLevel > level;
  level = newLevel;
  dropInterval = Math.max(100, 1000 - (level - 1) * 80);

  if (n >= 4) {
    showToast('TETRIS!', 'tetris');
  } else if (comboBonus > 0) {
    showToast('连击 x' + combo, 'combo');
  }
  if (leveledUp) {
    setTimeout(() => { showToast('等级 ' + level, 'level'); playSound('levelup'); }, n >= 4 || comboBonus > 0 ? 500 : 0);
  }

  updateStats();
  clearingRows = null;
  resetPiece();
}

function resetPiece() {
  piece = spawnFromQueue();
  if (collide(board, piece)) {
    gameOver = true;
    running = false;
    cancelAnimationFrame(animId);
    endGame();
  }
  drawNext();
  drawHold();
}

function endGame() {
  finalScoreEl.textContent = `分数: ${score}`;
  beatBestThisGame = score > best;
  if (beatBestThisGame) {
    best = score;
    try { localStorage.setItem('tetris-best', String(best)); } catch (e) {}
  }
  if (bestFinalEl) bestFinalEl.textContent = best;
  if (newBestBadge) newBestBadge.classList.toggle('hidden', !beatBestThisGame);
  gameoverOverlay.classList.remove('hidden');
  playSound('gameover');
}

function drawMatrix(matrix, offset, context, blockSize) {
  if (blockSize == null) blockSize = BLOCK;
  matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) {
        context.fillStyle = COLORS[val];
        context.fillRect(
          (x + offset.x) * blockSize,
          (y + offset.y) * blockSize,
          blockSize - 1,
          blockSize - 1
        );
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(
          (x + offset.x) * blockSize,
          (y + offset.y) * blockSize,
          blockSize - 1,
          Math.max(2, Math.floor(blockSize * 0.12))
        );
      }
    });
  });
}

function draw() {
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * BLOCK, 0);
    ctx.lineTo(x * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * BLOCK);
    ctx.lineTo(COLS * BLOCK, y * BLOCK);
    ctx.stroke();
  }

  drawMatrix(board, { x: 0, y: 0 }, ctx);

  if (piece) {
    const ghost = {
      matrix: piece.matrix,
      pos: { x: piece.pos.x, y: piece.pos.y }
    };
    while (!collide(board, ghost)) {
      ghost.pos.y++;
    }
    ghost.pos.y--;
    const alpha = (typeof window.TETRIS_GHOST_ALPHA === 'number')
      ? window.TETRIS_GHOST_ALPHA
      : 0.25;
    if (alpha > 0.01) {
      ctx.globalAlpha = alpha;
      drawMatrix(ghost.matrix, ghost.pos, ctx);
      ctx.globalAlpha = 1;
    }
    drawMatrix(piece.matrix, piece.pos, ctx);
  }

  if (clearingRows) {
    const t = Math.min(1, (performance.now() - clearStart) / CLEAR_DURATION);
    const pulse = 0.55 + 0.35 * Math.sin(t * Math.PI * 3);
    const alpha = Math.max(0, (1 - t)) * pulse + (1 - t) * 0.3;
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.95, alpha)})`;
    clearingRows.forEach(y => {
      ctx.fillRect(0, y * BLOCK, COLS * BLOCK, BLOCK);
    });
  }
}

function drawNext() {
  if (!nextCtx) return;
  nextCtx.fillStyle = '#1e293b';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  const bs = 11;
  const cols = nextCanvas.width / bs;
  const showCount = Math.min(2, queue.length);
  const slot = nextCanvas.height / bs / showCount;
  for (let i = 0; i < showCount; i++) {
    const m = SHAPES[queue[i]];
    if (!m || !m.length) continue;
    const ox = (cols - m[0].length) / 2;
    const oy = i * slot + (slot - m.length) / 2;
    drawMatrix(m, { x: ox, y: oy }, nextCtx, bs);
  }
}

function drawHold() {
  if (!holdCtx) return;
  holdCtx.fillStyle = '#1e293b';
  holdCtx.fillRect(0, 0, holdCanvas.width, holdCanvas.height);
  if (holdType == null) return;
  const bs = 11;
  const m = SHAPES[holdType];
  const ox = (holdCanvas.width / bs - m[0].length) / 2;
  const oy = (holdCanvas.height / bs - m.length) / 2;
  holdCtx.globalAlpha = holdUsed ? 0.35 : 1;
  drawMatrix(m, { x: ox, y: oy }, holdCtx, bs);
  holdCtx.globalAlpha = 1;
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function update(time = 0) {
  if (!running || paused || settingsPaused) return;
  const delta = time - lastTime;
  lastTime = time;

  if (clearingRows) {
    if (performance.now() - clearStart >= CLEAR_DURATION) {
      finishClear();
    }
  } else {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      playerDrop(false);
    }
  }
  draw();
  animId = requestAnimationFrame(update);
}

function startGame() {
  board = createMatrix(COLS, ROWS);
  score = 0;
  lines = 0;
  level = 1;
  combo = -1;
  dropInterval = 1000;
  dropCounter = 0;
  gameOver = false;
  paused = false;
  settingsPaused = false;
  clearingRows = null;
  bag = [];
  queue = [];
  holdType = null;
  holdUsed = false;
  resetPiece();
  updateStats();
  if (bestStartEl) bestStartEl.textContent = best;
  startOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  running = true;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(update);
}

function togglePause() {
  if (!running || gameOver || settingsPaused) return;
  paused = !paused;
  if (paused) {
    pauseOverlay.classList.remove('hidden');
    cancelAnimationFrame(animId);
  } else {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    animId = requestAnimationFrame(update);
  }
}

if (bestStartEl) bestStartEl.textContent = best;

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('resetBtn').addEventListener('click', startGame);

document.getElementById('btnLeft').addEventListener('click', () => playerMove(-1));
document.getElementById('btnRight').addEventListener('click', () => playerMove(1));
document.getElementById('btnDown').addEventListener('click', () => playerDrop(true));
document.getElementById('btnRotate').addEventListener('click', () => playerRotate(1));
document.getElementById('btnDrop').addEventListener('click', hardDrop);

const holdPanel = document.getElementById('holdPanel');
if (holdPanel) holdPanel.addEventListener('click', holdSwap);

document.addEventListener('keydown', e => {
  if (gameOver && e.key !== 'r' && e.key !== 'R') return;
  switch (e.key) {
    case 'ArrowLeft':
    case 'a': case 'A':
      playerMove(-1); break;
    case 'ArrowRight':
    case 'd': case 'D':
      playerMove(1); break;
    case 'ArrowDown':
    case 's': case 'S':
      playerDrop(true); break;
    case 'ArrowUp':
    case 'w': case 'W':
    case ' ':
      e.preventDefault();
      playerRotate(1); break;
    case 'Enter':
      hardDrop(); break;
    case 'c': case 'C': case 'Shift':
      holdSwap(); break;
    case 'p': case 'P':
      togglePause(); break;
    case 'r': case 'R':
      startGame(); break;
  }
});

let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;

canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = Date.now();
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const dt = Date.now() - touchStartTime;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  if (dt < 200 && absX < 15 && absY < 15) {
    playerRotate(1);
  } else if (absX > absY) {
    if (dx > 30) playerMove(1);
    else if (dx < -30) playerMove(-1);
  } else {
    if (dy > 40) playerDrop(true);
    else if (dy < -40) hardDrop();
  }
}, { passive: false });

syncCanvasSize();
setTimeout(syncCanvasSize, 100);
setTimeout(syncCanvasSize, 400);
window.addEventListener('resize', syncCanvasSize);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
