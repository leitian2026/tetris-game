// UI 自定义：圆形按键位置/大小 + 游戏框缩放
(function () {
  const STORAGE_KEY = 'tetris-ui-v1';

  const defaults = {
    boardScale: 100,
    btnSize: 56,
    ctrlHeight: 150,
    layout: 'bottom',
    positions: null // { left:{x,y}, ... } 百分比或 px
  };

  let cfg = load();
  let editMode = false;
  let dragKey = null;
  let dragOffset = { x: 0, y: 0 };

  const controls = document.getElementById('controls');
  const boardWrap = document.getElementById('boardWrap');
  const keys = ['left', 'down', 'right', 'rotate', 'drop'];
  const btnEls = {};
  keys.forEach(k => {
    btnEls[k] = document.querySelector(`[data-key="${k}"]`);
  });

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch (e) {}
    return { ...defaults };
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  }

  function applyStyles() {
    document.documentElement.style.setProperty('--btn-size', cfg.btnSize + 'px');
    document.documentElement.style.setProperty('--ctrl-area-h', cfg.ctrlHeight + 'px');
    // 游戏框宽度相对主区域
    const scale = cfg.boardScale / 100;
    boardWrap.style.width = (scale * 100) + '%';
    boardWrap.style.maxWidth = (scale * 100) + '%';
  }

  function presetPositions(layout) {
    const w = controls.clientWidth || 320;
    const h = cfg.ctrlHeight;
    const s = cfg.btnSize;
    const cx = w / 2;
    const bottom = h - s - 8;

    if (layout === 'split') {
      // 左：方向  右：旋转/下落
      return {
        left:   { x: 16, y: bottom - s - 10 },
        down:   { x: 16 + s * 0.85, y: bottom },
        right:  { x: 16 + s * 1.7, y: bottom - s - 10 },
        rotate: { x: w - s * 2.2 - 16, y: bottom - s * 0.5 },
        drop:   { x: w - s - 16, y: bottom - s * 0.5 }
      };
    }
    if (layout === 'arc') {
      // 底部弧形
      const r = Math.min(w * 0.38, 110);
      const cy = h - 20;
      const angles = {
        left: Math.PI * 1.15,
        down: Math.PI * 0.5 + Math.PI,
        right: Math.PI * 1.85,
        rotate: Math.PI * 1.35,
        drop: Math.PI * 1.65
      };
      // 更直观的弧：左 下 右 在下弧，旋转和落在两侧偏上
      return {
        left:   { x: cx - r - s / 2, y: bottom - 4 },
        down:   { x: cx - s / 2, y: bottom + 6 },
        right:  { x: cx + r - s / 2, y: bottom - 4 },
        rotate: { x: cx - r * 0.55 - s / 2, y: bottom - s * 0.95 },
        drop:   { x: cx + r * 0.55 - s / 2, y: bottom - s * 0.95 }
      };
    }
    // bottom 默认
    const gap = 10;
    const total3 = s * 3 + gap * 2;
    const start3 = (w - total3) / 2;
    const total2 = s * 2 + gap;
    const start2 = (w - total2) / 2;
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
    keys.forEach(k => {
      const el = btnEls[k];
      if (!el || !pos[k]) return;
      el.style.left = pos[k].x + 'px';
      el.style.top = pos[k].y + 'px';
    });
    // 若还没有自定义坐标，写入当前预设方便之后拖动
    if (!cfg.positions) {
      cfg.positions = pos;
    }
  }

  function applyLayout(name, resetPos) {
    cfg.layout = name;
    if (resetPos) cfg.positions = null;
    placeButtons();
    document.querySelectorAll('.layout-opt').forEach(el => {
      el.classList.toggle('active', el.dataset.layout === name);
    });
  }

  // ---- 拖动 ----
  function onPointerDown(e) {
    if (!editMode) return;
    const el = e.target.closest('.ctrl-btn');
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    dragKey = el.dataset.key;
    const rect = el.getBoundingClientRect();
    const parentRect = controls.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragOffset.x = clientX - rect.left;
    dragOffset.y = clientY - rect.top;
    el.setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e) {
    if (!editMode || !dragKey) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const parentRect = controls.getBoundingClientRect();
    let x = clientX - parentRect.left - dragOffset.x;
    let y = clientY - parentRect.top - dragOffset.y;
    const s = cfg.btnSize;
    x = Math.max(0, Math.min(x, parentRect.width - s));
    y = Math.max(0, Math.min(y, parentRect.height - s));
    if (!cfg.positions) cfg.positions = {};
    cfg.positions[dragKey] = { x, y };
    btnEls[dragKey].style.left = x + 'px';
    btnEls[dragKey].style.top = y + 'px';
  }

  function onPointerUp() {
    dragKey = null;
  }

  controls.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  controls.addEventListener('touchstart', onPointerDown, { passive: false });
  window.addEventListener('touchmove', onPointerMove, { passive: false });
  window.addEventListener('touchend', onPointerUp);

  // ---- 设置面板 ----
  const mask = document.getElementById('settingsMask');
  const boardScaleInput = document.getElementById('boardScale');
  const btnSizeInput = document.getElementById('btnSize');
  const ctrlHeightInput = document.getElementById('ctrlHeight');
  const editModeCheck = document.getElementById('editMode');

  function syncForm() {
    boardScaleInput.value = cfg.boardScale;
    document.getElementById('boardScaleVal').textContent = cfg.boardScale + '%';
    btnSizeInput.value = cfg.btnSize;
    document.getElementById('btnSizeVal').textContent = cfg.btnSize;
    ctrlHeightInput.value = cfg.ctrlHeight;
    document.getElementById('ctrlHVal').textContent = cfg.ctrlHeight;
    editModeCheck.checked = editMode;
    document.querySelectorAll('.layout-opt').forEach(el => {
      el.classList.toggle('active', el.dataset.layout === cfg.layout);
    });
  }

  document.getElementById('settingsBtn').addEventListener('click', () => {
    syncForm();
    mask.classList.remove('hidden');
  });
  document.getElementById('closeSettings').addEventListener('click', () => {
    mask.classList.add('hidden');
    editMode = false;
    editModeCheck.checked = false;
    controls.classList.remove('edit-mode');
  });
  mask.addEventListener('click', e => {
    if (e.target === mask) {
      mask.classList.add('hidden');
      editMode = false;
      editModeCheck.checked = false;
      controls.classList.remove('edit-mode');
    }
  });

  boardScaleInput.addEventListener('input', () => {
    cfg.boardScale = +boardScaleInput.value;
    document.getElementById('boardScaleVal').textContent = cfg.boardScale + '%';
    applyStyles();
  });
  btnSizeInput.addEventListener('input', () => {
    cfg.btnSize = +btnSizeInput.value;
    document.getElementById('btnSizeVal').textContent = cfg.btnSize;
    applyStyles();
    // 尺寸变了重新套预设或保持相对位置
    if (!cfg.positions) placeButtons();
  });
  ctrlHeightInput.addEventListener('input', () => {
    cfg.ctrlHeight = +ctrlHeightInput.value;
    document.getElementById('ctrlHVal').textContent = cfg.ctrlHeight;
    applyStyles();
    if (!cfg.positions) placeButtons();
  });

  document.querySelectorAll('.layout-opt').forEach(el => {
    el.addEventListener('click', () => {
      applyLayout(el.dataset.layout, true);
    });
  });

  editModeCheck.addEventListener('change', () => {
    editMode = editModeCheck.checked;
    controls.classList.toggle('edit-mode', editMode);
  });

  document.getElementById('resetLayout').addEventListener('click', () => {
    cfg = { ...defaults };
    editMode = false;
    editModeCheck.checked = false;
    controls.classList.remove('edit-mode');
    applyStyles();
    applyLayout('bottom', true);
    syncForm();
    save();
  });

  document.getElementById('saveSettings').addEventListener('click', () => {
    save();
    mask.classList.add('hidden');
    editMode = false;
    editModeCheck.checked = false;
    controls.classList.remove('edit-mode');
  });

  // 初始化
  applyStyles();
  // 等布局稳定后再放按键
  requestAnimationFrame(() => {
    placeButtons();
    // 窗口变化时若是预设布局则重算
    window.addEventListener('resize', () => {
      if (!localStorage.getItem(STORAGE_KEY) || !JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}').positions) {
        cfg.positions = null;
        placeButtons();
      }
    });
  });
})();
