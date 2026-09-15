// 宽高滑块独立：作为上限；实际游戏区取其中最大正方形格子并贴合外框
(function () {
  const STORAGE_KEY = 'tetris-ui-v8';

  function viewport() {
    return {
      vw: window.innerWidth || 360,
      vh: window.innerHeight || 640
    };
  }

  function availableBoardArea() {
    var v = viewport();
    var btn = (cfg && cfg.btnSize) || 56;
    var sidePad = btn + 16;
    var topPad = 48;
    var bottomPad = 24;
    if (cfg && cfg.layout !== 'sides') {
      bottomPad = btn * 2 + 36;
    }
    var maxW = Math.max(120, v.vw - sidePad * 2);
    var maxH = Math.max(240, v.vh - topPad - bottomPad);
    return { maxW: maxW, maxH: maxH, topPad: topPad, sidePad: sidePad, vw: v.vw, vh: v.vh };
  }

  function fitBoardSize() {
    var area = availableBoardArea();
    var cell = Math.floor(Math.min(area.maxW / 10, area.maxH / 20));
    cell = Math.max(10, cell);
    var w = cell * 10;
    var h = cell * 20;
    return {
      boardW: w,
      boardH: h,
      boardX: Math.floor((area.vw - w) / 2),
      boardY: area.topPad + Math.max(0, Math.floor((area.maxH - h) / 2))
    };
  }

  function defaultCfg() {
    var fit = fitBoardSize();
    var v = viewport();
    var sideW = 82;
    return {
      boardW: fit.boardW,
      boardH: fit.boardH,
      boardX: fit.boardX,
      boardY: fit.boardY,
      sideW: sideW,
      sideX: Math.min(v.vw - sideW - 8, fit.boardX + fit.boardW + 8),
      sideY: fit.boardY + 40,
      showSide: true,
      btnSize: 56,
      ghostAlpha: 25,
      layout: 'sides',
      btnPos: null
    };
  }

  var cfg = load();
  var editMode = false;
  var dragTarget = null;
  var dragOffset = { x: 0, y: 0 };
  var sizingLock = false; // 避免 snap 回调和滑块互相打架

  var boardWrap = document.getElementById('boardWrap');
  var sidePanel = document.getElementById('sidePanel');
  var controls = document.getElementById('controls');
  var editBar = document.getElementById('editBar');
  var mask = document.getElementById('settingsMask');
  var keys = ['left', 'down', 'right', 'rotate', 'drop'];
  var btnEls = {};
  keys.forEach(function (k) {
    btnEls[k] = document.querySelector('[data-key="' + k + '"]');
  });

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign(defaultCfg(), JSON.parse(raw));
      localStorage.removeItem('tetris-ui-v7');
      localStorage.removeItem('tetris-ui-v6');
    } catch (e) {}
    return defaultCfg();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function applyGhost() {
    window.TETRIS_GHOST_ALPHA = Math.max(0, Math.min(60, cfg.ghostAlpha || 0)) / 100;
  }

  function resizeCanvas() {
    if (typeof window.TETRIS_RESIZE_CANVAS === 'function') {
      requestAnimationFrame(function () {
        window.TETRIS_RESIZE_CANVAS();
      });
    }
  }

  // game.js 贴合后回调实际尺寸
  window.TETRIS_ON_BOARD_SIZED = function (w, h) {
    if (sizingLock) return;
    cfg.boardW = w;
    cfg.boardH = h;
    if (boardWInput) {
      boardWInput.value = w;
      document.getElementById('boardWVal').textContent = w;
    }
    if (boardHInput) {
      boardHInput.value = h;
      document.getElementById('boardHVal').textContent = h;
    }
  };

  function updateSliderLimits() {
    var v = viewport();
    boardWInput.max = Math.max(200, v.vw - 8);
    boardHInput.max = Math.max(300, v.vh - 8);
    boardWInput.min = 100;
    boardHInput.min = 200;
  }

  function presetBtnPos(layout) {
    var w = (window.innerWidth || 360);
    var h = (window.innerHeight || 640);
    var s = cfg.btnSize;
    var pad = 12;
    var safeBottom = 20;

    if (layout === 'sides') {
      var leftX = pad;
      var rightX = w - s - pad;
      var baseY = h - safeBottom - s * 3 - 28;
      return {
        left: { x: leftX, y: baseY },
        down: { x: leftX, y: baseY + s + 10 },
        right: { x: leftX, y: baseY + (s + 10) * 2 },
        rotate: { x: rightX, y: baseY + s + 10 },
        drop: { x: rightX, y: baseY + (s + 10) * 2 }
      };
    }
    if (layout === 'split') {
      var bottom = h - safeBottom - s;
      return {
        left: { x: pad, y: bottom - s - 10 },
        down: { x: pad + s * 0.85, y: bottom },
        right: { x: pad + s * 1.7, y: bottom - s - 10 },
        rotate: { x: w - s * 2.15 - pad, y: bottom - s * 0.3 },
        drop: { x: w - s - pad, y: bottom - s * 0.3 }
      };
    }
    var gap = 12;
    var total3 = s * 3 + gap * 2;
    var start3 = Math.max(pad, (w - total3) / 2);
    var total2 = s * 2 + gap;
    var start2 = Math.max(pad, (w - total2) / 2);
    var y1 = h - safeBottom - s * 2 - 20;
    var y2 = h - safeBottom - s;
    return {
      left: { x: start3, y: y1 },
      down: { x: start3 + s + gap, y: y1 },
      right: { x: start3 + (s + gap) * 2, y: y1 },
      rotate: { x: start2, y: y2 },
      drop: { x: start2 + s + gap, y: y2 }
    };
  }

  /** 先按用户设定的宽高设外框，再由 game 贴合正方形格子 */
  function applyBoardBox() {
    sizingLock = true;
    boardWrap.style.width = cfg.boardW + 'px';
    boardWrap.style.height = cfg.boardH + 'px';
    boardWrap.style.left = cfg.boardX + 'px';
    boardWrap.style.top = cfg.boardY + 'px';
    sizingLock = false;
    resizeCanvas();
  }

  function applyAll() {
    document.documentElement.style.setProperty('--btn-size', cfg.btnSize + 'px');
    applyBoardBox();

    if (cfg.showSide) {
      sidePanel.classList.remove('hidden-side');
      sidePanel.style.display = 'flex';
      sidePanel.style.width = cfg.sideW + 'px';
      sidePanel.style.left = cfg.sideX + 'px';
      sidePanel.style.top = cfg.sideY + 'px';
    } else {
      sidePanel.classList.add('hidden-side');
      sidePanel.style.display = 'none';
    }

    var pos = cfg.btnPos || presetBtnPos(cfg.layout);
    keys.forEach(function (k) {
      if (!btnEls[k] || !pos[k]) return;
      btnEls[k].style.left = pos[k].x + 'px';
      btnEls[k].style.top = pos[k].y + 'px';
    });
    if (!cfg.btnPos) cfg.btnPos = JSON.parse(JSON.stringify(pos));

    applyGhost();
  }

  function getPoint(e) {
    if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function onDown(e) {
    if (!editMode) return;
    var el = e.target.closest('[data-drag]');
    if (!el) return;
    if (!mask.classList.contains('hidden')) return;
    e.preventDefault();
    e.stopPropagation();
    var type = el.getAttribute('data-drag');
    var rect = el.getBoundingClientRect();
    var p = getPoint(e);
    dragOffset.x = p.x - rect.left;
    dragOffset.y = p.y - rect.top;
    if (type === 'board') dragTarget = { type: 'board' };
    else if (type === 'side') dragTarget = { type: 'side' };
    else if (type === 'btn') dragTarget = { type: 'btn', key: el.getAttribute('data-key') };
  }

  function onMove(e) {
    if (!editMode || !dragTarget) return;
    e.preventDefault();
    var p = getPoint(e);
    var vw = window.innerWidth || 360;
    var vh = window.innerHeight || 640;

    if (dragTarget.type === 'board') {
      var x = Math.max(0, Math.min(p.x - dragOffset.x, vw - cfg.boardW));
      var y = Math.max(0, Math.min(p.y - dragOffset.y, vh - cfg.boardH));
      cfg.boardX = Math.floor(x);
      cfg.boardY = Math.floor(y);
      boardWrap.style.left = cfg.boardX + 'px';
      boardWrap.style.top = cfg.boardY + 'px';
    } else if (dragTarget.type === 'side') {
      var sw = cfg.sideW;
      var sh = sidePanel.offsetHeight || 160;
      var sx = Math.max(0, Math.min(p.x - dragOffset.x, vw - sw));
      var sy = Math.max(0, Math.min(p.y - dragOffset.y, vh - sh));
      cfg.sideX = Math.floor(sx);
      cfg.sideY = Math.floor(sy);
      sidePanel.style.left = cfg.sideX + 'px';
      sidePanel.style.top = cfg.sideY + 'px';
    } else if (dragTarget.type === 'btn' && dragTarget.key) {
      var s = cfg.btnSize;
      var bx = Math.max(0, Math.min(p.x - dragOffset.x, vw - s));
      var by = Math.max(0, Math.min(p.y - dragOffset.y, vh - s));
      if (!cfg.btnPos) cfg.btnPos = {};
      cfg.btnPos[dragTarget.key] = { x: Math.floor(bx), y: Math.floor(by) };
      btnEls[dragTarget.key].style.left = cfg.btnPos[dragTarget.key].x + 'px';
      btnEls[dragTarget.key].style.top = cfg.btnPos[dragTarget.key].y + 'px';
    }
  }

  function onUp() { dragTarget = null; }

  document.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('mousedown', onDown);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchend', onUp);
  window.addEventListener('mouseup', onUp);

  keys.forEach(function (k) {
    if (!btnEls[k]) return;
    btnEls[k].addEventListener('click', function (e) {
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
    boardWrap.classList.add('edit-target');
    sidePanel.classList.add('edit-target');
    editBar.classList.remove('hidden');
  }

  function exitEditMode(doSave) {
    editMode = false;
    dragTarget = null;
    controls.classList.remove('edit-mode');
    boardWrap.classList.remove('edit-target');
    sidePanel.classList.remove('edit-target');
    editBar.classList.add('hidden');
    if (doSave) save();
  }

  var boardWInput = document.getElementById('boardW');
  var boardHInput = document.getElementById('boardH');
  var btnSizeInput = document.getElementById('btnSize');
  var sideWidthInput = document.getElementById('sideWidth');
  var showSideCheck = document.getElementById('showSide');
  var ghostAlphaInput = document.getElementById('ghostAlpha');

  function syncForm() {
    updateSliderLimits();
    boardWInput.value = cfg.boardW;
    document.getElementById('boardWVal').textContent = cfg.boardW;
    boardHInput.value = cfg.boardH;
    document.getElementById('boardHVal').textContent = cfg.boardH;
    btnSizeInput.value = cfg.btnSize;
    document.getElementById('btnSizeVal').textContent = cfg.btnSize;
    sideWidthInput.value = cfg.sideW;
    document.getElementById('sideWVal').textContent = cfg.sideW;
    showSideCheck.checked = !!cfg.showSide;
    ghostAlphaInput.value = cfg.ghostAlpha;
    document.getElementById('ghostAlphaVal').textContent = cfg.ghostAlpha + '%';
    document.querySelectorAll('.layout-opt').forEach(function (el) {
      el.classList.toggle('active', el.dataset.layout === cfg.layout);
    });
  }

  function readForm() {
    cfg.boardW = +boardWInput.value;
    cfg.boardH = +boardHInput.value;
    cfg.btnSize = +btnSizeInput.value;
    cfg.sideW = +sideWidthInput.value;
    cfg.showSide = showSideCheck.checked;
    cfg.ghostAlpha = +ghostAlphaInput.value;
  }

  function doFitBoard() {
    var fit = fitBoardSize();
    cfg.boardW = fit.boardW;
    cfg.boardH = fit.boardH;
    cfg.boardX = fit.boardX;
    cfg.boardY = fit.boardY;
    var v = viewport();
    cfg.sideX = Math.min(v.vw - cfg.sideW - 8, cfg.boardX + cfg.boardW + 8);
    cfg.sideY = cfg.boardY + 40;
    applyAll();
    syncForm();
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

  // 宽、高独立调节上限；贴合后两边都会变成实际 1:2 尺寸
  boardWInput.addEventListener('input', function () {
    cfg.boardW = +boardWInput.value;
    document.getElementById('boardWVal').textContent = cfg.boardW;
    // 临时用当前高度作上限，让正方形能随宽度变大
    boardWrap.style.width = cfg.boardW + 'px';
    boardWrap.style.height = Math.max(cfg.boardH, cfg.boardW * 2) + 'px';
    resizeCanvas();
  });
  boardHInput.addEventListener('input', function () {
    cfg.boardH = +boardHInput.value;
    document.getElementById('boardHVal').textContent = cfg.boardH;
    boardWrap.style.height = cfg.boardH + 'px';
    boardWrap.style.width = Math.max(cfg.boardW, Math.floor(cfg.boardH / 2)) + 'px';
    resizeCanvas();
  });

  btnSizeInput.addEventListener('input', function () {
    cfg.btnSize = +btnSizeInput.value;
    document.getElementById('btnSizeVal').textContent = cfg.btnSize;
    document.documentElement.style.setProperty('--btn-size', cfg.btnSize + 'px');
  });
  sideWidthInput.addEventListener('input', function () {
    cfg.sideW = +sideWidthInput.value;
    document.getElementById('sideWVal').textContent = cfg.sideW;
    sidePanel.style.width = cfg.sideW + 'px';
  });
  showSideCheck.addEventListener('change', function () {
    cfg.showSide = showSideCheck.checked;
    applyAll();
  });
  ghostAlphaInput.addEventListener('input', function () {
    cfg.ghostAlpha = +ghostAlphaInput.value;
    document.getElementById('ghostAlphaVal').textContent = cfg.ghostAlpha + '%';
    applyGhost();
  });

  document.getElementById('fitBoardBtn').addEventListener('click', function () {
    readForm();
    doFitBoard();
  });

  document.querySelectorAll('.layout-opt').forEach(function (el) {
    el.addEventListener('click', function () {
      cfg.layout = el.dataset.layout;
      cfg.btnPos = null;
      applyAll();
      document.querySelectorAll('.layout-opt').forEach(function (o) {
        o.classList.toggle('active', o.dataset.layout === cfg.layout);
      });
    });
  });

  document.getElementById('startEditBtn').addEventListener('click', function () {
    readForm();
    applyAll();
    enterEditMode();
  });
  document.getElementById('doneEditBtn').addEventListener('click', function () {
    exitEditMode(true);
  });
  document.getElementById('resetLayout').addEventListener('click', function () {
    cfg = defaultCfg();
    cfg.btnPos = null;
    applyAll();
    syncForm();
    save();
  });
  document.getElementById('saveSettings').addEventListener('click', function () {
    readForm();
    applyAll();
    save();
    mask.classList.add('hidden');
  });

  if (!localStorage.getItem(STORAGE_KEY)) {
    doFitBoard();
  } else {
    applyAll();
  }
  setTimeout(function () {
    updateSliderLimits();
    applyAll();
  }, 200);

  window.addEventListener('resize', function () {
    updateSliderLimits();
    var vw = window.innerWidth || 360;
    var vh = window.innerHeight || 640;
    cfg.boardX = Math.min(cfg.boardX, Math.max(0, vw - cfg.boardW));
    cfg.boardY = Math.min(cfg.boardY, Math.max(0, vh - cfg.boardH));
    applyAll();
  });
})();
