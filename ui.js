// 全自由布局：游戏框 / 侧栏 / 按键 均可调大小 + 拖动
(function () {
  const STORAGE_KEY = 'tetris-ui-v4';

  function defaultCfg() {
    const vw = window.innerWidth || 360;
    const vh = window.innerHeight || 640;
    const bw = Math.min(220, Math.floor(vw * 0.55));
    const bh = Math.min(440, Math.floor(bw * 2));
    return {
      boardW: bw,
      boardH: bh,
      boardX: Math.floor((vw - bw) / 2 - 20),
      boardY: 52,
      sideW: 82,
      sideX: Math.min(vw - 94, Math.floor((vw - bw) / 2 - 20) + bw + 10),
      sideY: 120,
      showSide: true,
      btnSize: 56,
      ghostAlpha: 25,
      layout: 'sides',
      btnPos: null
    };
  }

  let cfg = load();
  let editMode = false;
  let dragTarget = null; // { type: 'board'|'side'|'btn', key? }
  let dragOffset = { x: 0, y: 0 };

  const boardWrap = document.getElementById('boardWrap');
  const sidePanel = document.getElementById('sidePanel');
  const controls = document.getElementById('controls');
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
      if (raw) return Object.assign(defaultCfg(), JSON.parse(raw));
    } catch (e) {}
    return defaultCfg();
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function applyGhost() {
    window.TETRIS_GHOST_ALPHA = Math.max(0, Math.min(60, cfg.ghostAlpha || 0)) / 100;
  }

  function presetBtnPos(layout) {
    const w = window.innerWidth || 360;
    const h = window.innerHeight || 640;
    const s = cfg.btnSize;
    const pad = 12;
    const safeBottom = 20;

    if (layout === 'sides') {
      const leftX = pad;
      const rightX = w - s - pad;
      const baseY = h - safeBottom - s * 3 - 28;
      return {
        left: { x: leftX, y: baseY },
        down: { x: leftX, y: baseY + s + 10 },
        right: { x: leftX, y: baseY + (s + 10) * 2 },
        rotate: { x: rightX, y: baseY + s + 10 },
        drop: { x: rightX, y: baseY + (s + 10) * 2 }
      };
    }
    if (layout === 'split') {
      const bottom = h - safeBottom - s;
      return {
        left: { x: pad, y: bottom - s - 10 },
        down: { x: pad + s * 0.85, y: bottom },
        right: { x: pad + s * 1.7, y: bottom - s - 10 },
        rotate: { x: w - s * 2.15 - pad, y: bottom - s * 0.3 },
        drop: { x: w - s - pad, y: bottom - s * 0.3 }
      };
    }
    const gap = 12;
    const total3 = s * 3 + gap * 2;
    const start3 = Math.max(pad, (w - total3) / 2);
    const total2 = s * 2 + gap;
    const start2 = Math.max(pad, (w - total2) / 2);
    const y1 = h - safeBottom - s * 2 - 20;
    const y2 = h - safeBottom - s;
    return {
      left: { x: start3, y: y1 },
      down: { x: start3 + s + gap, y: y1 },
      right: { x: start3 + (s + gap) * 2, y: y1 },
      rotate: { x: start2, y: y2 },
      drop: { x: start2 + s + gap, y: y2 }
    };
  }

  function applyAll() {
    document.documentElement.style.setProperty('--btn-size', cfg.btnSize + 'px');

    boardWrap.style.width = cfg.boardW + 'px';
    boardWrap.style.height = cfg.boardH + 'px';
    boardWrap.style.left = cfg.boardX + 'px';
    boardWrap.style.top = cfg.boardY + 'px';

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

    const pos = cfg.btnPos || presetBtnPos(cfg.layout);
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
    // 设置面板打开时不拖
    if (!mask.classList.contains('hidden')) return;

    e.preventDefault();
    e.stopPropagation();

    var type = el.getAttribute('data-drag');
    var rect = el.getBoundingClientRect();
    var p = getPoint(e);
    dragOffset.x = p.x - rect.left;
    dragOffset.y = p.y - rect.top;

    if (type === 'board') {
      dragTarget = { type: 'board' };
    } else if (type === 'side') {
      dragTarget = { type: 'side' };
    } else if (type === 'btn') {
      dragTarget = { type: 'btn', key: el.getAttribute('data-key') };
    }
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

  function onUp() {
    dragTarget = null;
  }

  // 全局监听，支持拖 board / side / btn
  document.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('mousedown', onDown);
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchend', onUp);
  window.addEventListener('mouseup', onUp);

  // 编辑时屏蔽按键游戏操作
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

  // ---- 表单 ----
  var boardWInput = document.getElementById('boardW');
  var boardHInput = document.getElementById('boardH');
  var btnSizeInput = document.getElementById('btnSize');
  var sideWidthInput = document.getElementById('sideWidth');
  var showSideCheck = document.getElementById('showSide');
  var ghostAlphaInput = document.getElementById('ghostAlpha');

  function syncForm() {
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

  boardWInput.addEventListener('input', function () {
    cfg.boardW = +boardWInput.value;
    document.getElementById('boardWVal').textContent = cfg.boardW;
    boardWrap.style.width = cfg.boardW + 'px';
  });
  boardHInput.addEventListener('input', function () {
    cfg.boardH = +boardHInput.value;
    document.getElementById('boardHVal').textContent = cfg.boardH;
    boardWrap.style.height = cfg.boardH + 'px';
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

  applyAll();
  setTimeout(applyAll, 200);
  setTimeout(applyAll, 600);
  window.addEventListener('resize', function () {
    // 仅限制不越界
    var vw = window.innerWidth || 360;
    var vh = window.innerHeight || 640;
    cfg.boardX = Math.min(cfg.boardX, Math.max(0, vw - cfg.boardW));
    cfg.boardY = Math.min(cfg.boardY, Math.max(0, vh - cfg.boardH));
    applyAll();
  });
})();
