// UI：全屏浮动按键 / 游戏框缩放 / 幽灵透明度
(function () {
  const STORAGE_KEY = 'tetris-ui-v3';

  const defaults = {
    boardScale: 100,
    btnSize: 56,
    sideWidth: 82,
    showSide: true,
    ghostAlpha: 25, // 0-60 百分比
    layout: 'sides',
    positions: null // { left:{x,y}, ... } 相对视口像素
  };

  let cfg = load();
  let editMode = false;
  let dragKey = null;
  let dragOffset = { x: 0, y: 0 };

  const controls = document.getElementById('controls');
  const boardWrap = document.getElementById('boardWrap');
  const boardOuter = document.getElementById('boardOuter');
  const sidePanel = document.getElementById('sidePanel');
  const editBar = document.getElementById('editBar');
  const mask = document.getElementById('settingsMask');

  const keys = ['left', 'down', 'right', 'rotate', 'drop'];
  const btnEls = {};
  keys.forEach(function (k) {
    btnEls[k] = document.querySelector('[data-key="' + k + '"]');
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, defaults, JSON.parse(raw));
      // 兼容旧版
      const old = localStorage.getItem('tetris-ui-v2');
      if (old) {
        const o = JSON.parse(old);
        return Object.assign({}, defaults, o, { layout: o.layout === 'split' ? 'sides' : (o.layout || 'sides') });
      }
    } catch (e) {}
    return Object.assign({}, defaults);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function applyGhostAlpha() {
    const a = Math.max(0, Math.min(60, cfg.ghostAlpha || 0)) / 100;
    window.TETRIS_GHOST_ALPHA = a;
  }

  function resizeBoard() {
    if (!boardOuter || !boardWrap) return;
    const aw = boardOuter.clientWidth;
    const ah = boardOuter.clientHeight;
    if (aw < 10 || ah < 10) return;

    const scale = (cfg.boardScale || 100) / 100;
    let w = aw * scale;
    let h = w * 2;
    if (h > ah * scale) {
      h = ah * scale;
      w = h / 2;
    }
    w = Math.max(120, Math.floor(w));
    h = Math.max(240, Math.floor(h));
    boardWrap.style.width = w + 'px';
    boardWrap.style.height = h + 'px';
  }

  function applyStyles() {
    document.documentElement.style.setProperty('--btn-size', cfg.btnSize + 'px');
    document.documentElement.style.setProperty('--side-w', cfg.sideWidth + 'px');

    if (cfg.showSide) {
      sidePanel.classList.remove('hidden-side');
      sidePanel.style.display = '';
    } else {
      sidePanel.classList.add('hidden-side');
      sidePanel.style.display = 'none';
    }
    applyGhostAlpha();
    resizeBoard();
  }

  // 基于整个视口的预设（可用两侧空白）
  function presetPositions(layout) {
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;
    const s = cfg.btnSize;
    const pad = 12;
    const safeBottom = 16;

    if (layout === 'sides') {
      // 左：方向键竖排偏下；右：下落+旋转
      const leftX = pad;
      const rightX = w - s - pad;
      const baseY = h - safeBottom - s * 3 - 24;
      return {
        left:   { x: leftX, y: baseY },
        down:   { x: leftX, y: baseY + s + 10 },
        right:  { x: leftX, y: baseY + (s + 10) * 2 },
        rotate: { x: rightX, y: baseY + s + 10 },
        drop:   { x: rightX, y: baseY + (s + 10) * 2 }
      };
    }
    if (layout === 'split') {
      const bottom = h - safeBottom - s;
      return {
        left:   { x: pad, y: bottom - s - 10 },
        down:   { x: pad + s * 0.85, y: bottom },
        right:  { x: pad + s * 1.7, y: bottom - s - 10 },
        rotate: { x: w - s * 2.15 - pad, y: bottom - s * 0.3 },
        drop:   { x: w - s - pad, y: bottom - s * 0.3 }
      };
    }
    // bottom 居中
    const gap = 12;
    const total3 = s * 3 + gap * 2;
    const start3 = Math.max(pad, (w - total3) / 2);
    const total2 = s * 2 + gap;
    const start2 = Math.max(pad, (w - total2) / 2);
    const y1 = h - safeBottom - s * 2 - 20;
    const y2 = h - safeBottom - s;
    return {
      left:   { x: start3, y: y1 },
      down:   { x: start3 + s + gap, y: y1 },
      right:  { x: start3 + (s + gap) * 2, y: y1 },
      rotate: { x: start2, y: y2 },
      drop:   { x: start2 + s + gap, y: y2 }
    };
  }

  function placeButtons() {
    const pos = cfg.positions || presetPositions(cfg.layout);
    keys.forEach(function (k) {
      const el = btnEls[k];
      if (!el || !pos[k]) return;
      el.style.left = pos[k].x + 'px';
      el.style.top = pos[k].y + 'px';
    });
    if (!cfg.positions) cfg.positions = JSON.parse(JSON.stringify(pos));
  }

  function applyLayout(name, resetPos) {
    cfg.layout = name;
    if (resetPos) cfg.positions = null;
    placeButtons();
    document.querySelectorAll('.layout-opt').forEach(function (el) {
      el.classList.toggle('active', el.dataset.layout === name);
    });
  }

  function getPoint(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function onDown(e) {
    if (!editMode) return;
    const el = e.target.closest('.ctrl-btn');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    dragKey = el.dataset.key;
    const rect = el.getBoundingClientRect();
    const p = getPoint(e);
    dragOffset.x = p.x - rect.left;
    dragOffset.y = p.y - rect.top;
  }

  function onMove(e) {
    if (!editMode || !dragKey) return;
    e.preventDefault();
    const p = getPoint(e);
    const s = cfg.btnSize;
    const maxX = (window.innerWidth || 360) - s;
    const maxY = (window.innerHeight || 640) - s;
    let x = p.x - dragOffset.x;
    let y = p.y - dragOffset.y;
    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));
    if (!cfg.positions) cfg.positions = {};
    cfg.positions[dragKey] = { x: x, y: y };
    btnEls[dragKey].style.left = x + 'px';
    btnEls[dragKey].style.top = y + 'px';
  }

  function onUp() { dragKey = null; }

  controls.addEventListener('touchstart', onDown, { passive: false });
  controls.addEventListener('mousedown', onDown);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchend', onUp);
  window.addEventListener('mouseup', onUp);

  keys.forEach(function (k) {
    const el = btnEls[k];
    if (!el) return;
    el.addEventListener('click', function (e) {
      if (editMode) {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    }, true);
  });

  function enterEditMode() {
    editMode = true;
    mask.classList.add('hidden');
    controls.classList.add('edit-mode');
    editBar.classList.remove('hidden');
  }

  function exitEditMode(doSave) {
    editMode = false;
    dragKey = null;
    controls.classList.remove('edit-mode');
    editBar.classList.add('hidden');
    if (doSave) save();
  }

  const boardScaleInput = document.getElementById('boardScale');
  const btnSizeInput = document.getElementById('btnSize');
  const sideWidthInput = document.getElementById('sideWidth');
  const showSideCheck = document.getElementById('showSide');
  const ghostAlphaInput = document.getElementById('ghostAlpha');

  function syncForm() {
    boardScaleInput.value = cfg.boardScale;
    document.getElementById('boardScaleVal').textContent = cfg.boardScale + '%';
    btnSizeInput.value = cfg.btnSize;
    document.getElementById('btnSizeVal').textContent = cfg.btnSize;
    sideWidthInput.value = cfg.sideWidth;
    document.getElementById('sideWVal').textContent = cfg.sideWidth;
    showSideCheck.checked = !!cfg.showSide;
    ghostAlphaInput.value = cfg.ghostAlpha;
    document.getElementById('ghostAlphaVal').textContent = cfg.ghostAlpha + '%';
    document.querySelectorAll('.layout-opt').forEach(function (el) {
      el.classList.toggle('active', el.dataset.layout === cfg.layout);
    });
  }

  document.getElementById('settingsBtn').addEventListener('click', function () {
    if (editMode) exitEditMode(true);
    syncForm();
    mask.classList.remove('hidden');
  });

  document.getElementById('closeSettings').addEventListener('click', function () {
    mask.classList.add('hidden');
  });

  mask.addEventListener('click', function (e) {
    if (e.target === mask) mask.classList.add('hidden');
  });

  boardScaleInput.addEventListener('input', function () {
    cfg.boardScale = +boardScaleInput.value;
    document.getElementById('boardScaleVal').textContent = cfg.boardScale + '%';
    resizeBoard();
  });

  btnSizeInput.addEventListener('input', function () {
    cfg.btnSize = +btnSizeInput.value;
    document.getElementById('btnSizeVal').textContent = cfg.btnSize;
    applyStyles();
  });

  sideWidthInput.addEventListener('input', function () {
    cfg.sideWidth = +sideWidthInput.value;
    document.getElementById('sideWVal').textContent = cfg.sideWidth;
    applyStyles();
    setTimeout(resizeBoard, 50);
  });

  showSideCheck.addEventListener('change', function () {
    cfg.showSide = showSideCheck.checked;
    applyStyles();
    setTimeout(resizeBoard, 50);
  });

  ghostAlphaInput.addEventListener('input', function () {
    cfg.ghostAlpha = +ghostAlphaInput.value;
    document.getElementById('ghostAlphaVal').textContent = cfg.ghostAlpha + '%';
    applyGhostAlpha();
  });

  document.querySelectorAll('.layout-opt').forEach(function (el) {
    el.addEventListener('click', function () {
      applyLayout(el.dataset.layout, true);
    });
  });

  document.getElementById('startEditBtn').addEventListener('click', function () {
    cfg.boardScale = +boardScaleInput.value;
    cfg.btnSize = +btnSizeInput.value;
    cfg.sideWidth = +sideWidthInput.value;
    cfg.showSide = showSideCheck.checked;
    cfg.ghostAlpha = +ghostAlphaInput.value;
    applyStyles();
    placeButtons();
    enterEditMode();
  });

  document.getElementById('doneEditBtn').addEventListener('click', function () {
    exitEditMode(true);
  });

  document.getElementById('resetLayout').addEventListener('click', function () {
    cfg = Object.assign({}, defaults);
    applyStyles();
    applyLayout('sides', true);
    syncForm();
    save();
  });

  document.getElementById('saveSettings').addEventListener('click', function () {
    cfg.boardScale = +boardScaleInput.value;
    cfg.btnSize = +btnSizeInput.value;
    cfg.sideWidth = +sideWidthInput.value;
    cfg.showSide = showSideCheck.checked;
    cfg.ghostAlpha = +ghostAlphaInput.value;
    applyStyles();
    placeButtons();
    save();
    mask.classList.add('hidden');
  });

  applyStyles();
  requestAnimationFrame(function () {
    placeButtons();
    resizeBoard();
  });
  window.addEventListener('resize', function () {
    resizeBoard();
    // 无自定义位置时按新屏幕重算预设
    if (!localStorage.getItem(STORAGE_KEY)) {
      cfg.positions = null;
      placeButtons();
    }
  });
  setTimeout(resizeBoard, 300);
  setTimeout(function () { placeButtons(); resizeBoard(); }, 500);
})();
