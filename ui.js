// UI 自定义：圆形按键拖动 / 游戏框缩放 / 侧边栏
(function () {
  const STORAGE_KEY = 'tetris-ui-v2';

  const defaults = {
    boardScale: 100,
    btnSize: 56,
    ctrlHeight: 150,
    sideWidth: 82,
    showSide: true,
    layout: 'split',
    positions: null
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
    } catch (e) {}
    return Object.assign({}, defaults);
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
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
    document.documentElement.style.setProperty('--ctrl-area-h', cfg.ctrlHeight + 'px');
    document.documentElement.style.setProperty('--side-w', cfg.sideWidth + 'px');

    if (cfg.showSide) {
      sidePanel.classList.remove('hidden-side');
      sidePanel.style.display = '';
    } else {
      sidePanel.classList.add('hidden-side');
      sidePanel.style.display = 'none';
    }
    resizeBoard();
  }

  function presetPositions(layout) {
    const w = controls.clientWidth || 320;
    const h = cfg.ctrlHeight;
    const s = cfg.btnSize;
    const cx = w / 2;
    const bottom = Math.max(4, h - s - 8);

    if (layout === 'split') {
      return {
        left:   { x: 12, y: Math.max(4, bottom - s - 8) },
        down:   { x: 12 + s * 0.75, y: bottom },
        right:  { x: 12 + s * 1.5, y: Math.max(4, bottom - s - 8) },
        rotate: { x: w - s * 2.15 - 12, y: Math.max(4, bottom - s * 0.35) },
        drop:   { x: w - s - 12, y: Math.max(4, bottom - s * 0.35) }
      };
    }
    if (layout === 'arc') {
      const r = Math.min(w * 0.36, 100);
      return {
        left:   { x: cx - r - s / 2, y: bottom - 2 },
        down:   { x: cx - s / 2, y: Math.min(bottom + 8, h - s - 2) },
        right:  { x: cx + r - s / 2, y: bottom - 2 },
        rotate: { x: cx - r * 0.55 - s / 2, y: Math.max(4, bottom - s * 0.9) },
        drop:   { x: cx + r * 0.55 - s / 2, y: Math.max(4, bottom - s * 0.9) }
      };
    }
    const gap = 10;
    const total3 = s * 3 + gap * 2;
    const start3 = Math.max(0, (w - total3) / 2);
    const total2 = s * 2 + gap;
    const start2 = Math.max(0, (w - total2) / 2);
    return {
      left:   { x: start3, y: 8 },
      down:   { x: start3 + s + gap, y: 8 },
      right:  { x: start3 + (s + gap) * 2, y: 8 },
      rotate: { x: start2, y: 8 + s + 12 },
      drop:   { x: start2 + s + gap, y: 8 + s + 12 }
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
    const parentRect = controls.getBoundingClientRect();
    let x = p.x - parentRect.left - dragOffset.x;
    let y = p.y - parentRect.top - dragOffset.y;
    const s = cfg.btnSize;
    x = Math.max(0, Math.min(x, parentRect.width - s));
    y = Math.max(0, Math.min(y, parentRect.height - s));
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
    document.querySelector('.app').style.paddingTop = '44px';
  }

  function exitEditMode(doSave) {
    editMode = false;
    dragKey = null;
    controls.classList.remove('edit-mode');
    editBar.classList.add('hidden');
    document.querySelector('.app').style.paddingTop = '';
    if (doSave) save();
  }

  const boardScaleInput = document.getElementById('boardScale');
  const btnSizeInput = document.getElementById('btnSize');
  const ctrlHeightInput = document.getElementById('ctrlHeight');
  const sideWidthInput = document.getElementById('sideWidth');
  const showSideCheck = document.getElementById('showSide');

  function syncForm() {
    boardScaleInput.value = cfg.boardScale;
    document.getElementById('boardScaleVal').textContent = cfg.boardScale + '%';
    btnSizeInput.value = cfg.btnSize;
    document.getElementById('btnSizeVal').textContent = cfg.btnSize;
    ctrlHeightInput.value = cfg.ctrlHeight;
    document.getElementById('ctrlHVal').textContent = cfg.ctrlHeight;
    sideWidthInput.value = cfg.sideWidth;
    document.getElementById('sideWVal').textContent = cfg.sideWidth;
    showSideCheck.checked = !!cfg.showSide;
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

  ctrlHeightInput.addEventListener('input', function () {
    cfg.ctrlHeight = +ctrlHeightInput.value;
    document.getElementById('ctrlHVal').textContent = cfg.ctrlHeight;
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

  document.querySelectorAll('.layout-opt').forEach(function (el) {
    el.addEventListener('click', function () {
      applyLayout(el.dataset.layout, true);
    });
  });

  document.getElementById('startEditBtn').addEventListener('click', function () {
    cfg.boardScale = +boardScaleInput.value;
    cfg.btnSize = +btnSizeInput.value;
    cfg.ctrlHeight = +ctrlHeightInput.value;
    cfg.sideWidth = +sideWidthInput.value;
    cfg.showSide = showSideCheck.checked;
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
    applyLayout('split', true);
    syncForm();
    save();
  });

  document.getElementById('saveSettings').addEventListener('click', function () {
    cfg.boardScale = +boardScaleInput.value;
    cfg.btnSize = +btnSizeInput.value;
    cfg.ctrlHeight = +ctrlHeightInput.value;
    cfg.sideWidth = +sideWidthInput.value;
    cfg.showSide = showSideCheck.checked;
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
  window.addEventListener('resize', resizeBoard);
  setTimeout(resizeBoard, 300);
  setTimeout(resizeBoard, 800);
})();
