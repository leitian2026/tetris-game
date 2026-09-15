// 俄罗斯方块核心逻辑
const COLS = 10;
const ROWS = 20;
let CELL_W = 30;
let CELL_H = 30;

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

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
const boardWrap = document.getElementById('boardWrap');

const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');
const linesEl = document.getElementById('lines');
const startOverlay = document.getElementById('startOverlay');
const pauseOverlay = document.getElementById('pauseOverlay');
const gameoverOverlay = document.getElementById('gameoverOverlay');
const finalScoreEl = document.getElementById('finalScore');

let board = createMatrix(COLS, ROWS);
let piece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let dropInterval = 1000;
let lastTime = 0;
let dropCounter = 0;
let animId = null;
let running = false;
let paused = false;
let gameOver = false;

if (typeof window.TETRIS_GHOST_ALPHA !== 'number') {
  window.TETRIS_GHOST_ALPHA = 0.25;
}

/** 外框宽高可独立；格子宽高按外框分别计算并铺满 */
function syncCanvasSize() {
  if (!boardWrap) return;
  const dw = Math.max(100, boardWrap.clientWidth || 200);
  const dh = Math.max(200, boardWrap.clientHeight || 400);
  CELL_W = Math.max(6, Math.floor(dw / COLS));
  CELL_H = Math.max(6, Math.floor(dh / ROWS));
  const cw = CELL_W * COLS;
  const ch = CELL_H * ROWS;
  if (canvas.width !== cw || canvas.height !== ch) {
    canvas.width = cw;
    canvas.height = ch;
  }
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  draw();
  drawNext();
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

function randomType() {
  return 1 + Math.floor(Math.random() * 7);
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
  if (!piece || gameOver || paused) return;
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
}

function playerMove(dir) {
  if (!piece || gameOver || paused) return;
  piece.pos.x += dir;
  if (collide(board, piece)) {
    piece.pos.x -= dir;
  }
}

function playerDrop() {
  if (!piece || gameOver || paused) return;
  piece.pos.y++;
  if (collide(board, piece)) {
    piece.pos.y--;
    merge(board, piece);
    sweep();
    resetPiece();
  }
  dropCounter = 0;
}

function hardDrop() {
  if (!piece || gameOver || paused) return;
  while (!collide(board, piece)) {
    piece.pos.y++;
  }
  piece.pos.y--;
  merge(board, piece);
  sweep();
  resetPiece();
  dropCounter = 0;
}

function sweep() {
  let rowCount = 0;
  outer: for (let y = board.length - 1; y >= 0; y--) {
    for (let x = 0; x < board[y].length; x++) {
      if (board[y][x] === 0) continue outer;
    }
    const row = board.splice(y, 1)[0].fill(0);
    board.unshift(row);
    y++;
    rowCount++;
  }
  if (rowCount > 0) {
    const points = [0, 100, 300, 500, 800];
    score += (points[rowCount] || 800) * level;
    lines += rowCount;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 80);
    updateStats();
  }
}

function resetPiece() {
  piece = nextPiece || createPiece(randomType());
  nextPiece = createPiece(randomType());
  piece.pos.y = 0;
  piece.pos.x = Math.floor(COLS / 2) - Math.ceil(piece.matrix[0].length / 2);
  if (collide(board, piece)) {
    gameOver = true;
    running = false;
    cancelAnimationFrame(animId);
    finalScoreEl.textContent = `分数: ${score}`;
    gameoverOverlay.classList.remove('hidden');
  }
  drawNext();
}

function drawMatrix(matrix, offset, context, cw, ch) {
  if (cw == null) cw = CELL_W;
  if (ch == null) ch = CELL_H;
  matrix.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val !== 0) {
        const px = (x + offset.x) * cw;
        const py = (y + offset.y) * ch;
        context.fillStyle = COLORS[val];
        context.fillRect(px, py, cw - 1, ch - 1);
        context.fillStyle = 'rgba(255,255,255,0.25)';
        context.fillRect(px, py, cw - 1, Math.max(2, Math.floor(ch * 0.12)));
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
    ctx.moveTo(x * CELL_W, 0);
    ctx.lineTo(x * CELL_W, ROWS * CELL_H);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL_H);
    ctx.lineTo(COLS * CELL_W, y * CELL_H);
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
}

function drawNext() {
  nextCtx.fillStyle = '#1e293b';
  nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
  if (!nextPiece) return;
  const m = nextPiece.matrix;
  const bs = 18;
  const ox = (nextCanvas.width / bs - m[0].length) / 2;
  const oy = (nextCanvas.height / bs - m.length) / 2;
  drawMatrix(m, { x: ox, y: oy }, nextCtx, bs, bs);
}

function updateStats() {
  scoreEl.textContent = score;
  levelEl.textContent = level;
  linesEl.textContent = lines;
}

function update(time = 0) {
  if (!running || paused) return;
  const delta = time - lastTime;
  lastTime = time;
  dropCounter += delta;
  if (dropCounter > dropInterval) {
    playerDrop();
  }
  draw();
  animId = requestAnimationFrame(update);
}

function startGame() {
  board = createMatrix(COLS, ROWS);
  score = 0;
  lines = 0;
  level = 1;
  dropInterval = 1000;
  dropCounter = 0;
  gameOver = false;
  paused = false;
  nextPiece = null;
  resetPiece();
  updateStats();
  startOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  gameoverOverlay.classList.add('hidden');
  running = true;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(update);
}

function togglePause() {
  if (!running || gameOver) return;
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

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('pauseBtn').addEventListener('click', togglePause);
document.getElementById('resetBtn').addEventListener('click', startGame);

document.getElementById('btnLeft').addEventListener('click', () => playerMove(-1));
document.getElementById('btnRight').addEventListener('click', () => playerMove(1));
document.getElementById('btnDown').addEventListener('click', playerDrop);
document.getElementById('btnRotate').addEventListener('click', () => playerRotate(1));
document.getElementById('btnDrop').addEventListener('click', hardDrop);

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
      playerDrop(); break;
    case 'ArrowUp':
    case 'w': case 'W':
    case ' ':
      e.preventDefault();
      playerRotate(1); break;
    case 'Enter':
      hardDrop(); break;
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
    if (dy > 40) playerDrop();
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
