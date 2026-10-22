'use strict';

const DEFAULT_PROVIDER = 'claude';
let PROVIDERS = [];
const MAX_ITEMS = 8; // chỉ dùng cho chỉ báo mẫu

const state = {
  provider: DEFAULT_PROVIDER,
  activeNav: 'workspace',
  projectId: 'gateway',
  projects: [
    {
      id: 'gateway', name: 'Inference Gateway', description: 'Dịch vụ định tuyến yêu cầu mô hình có giới hạn tốc độ, ghi nhật ký và nhà cung cấp dự phòng.',
      context: [
        { title: 'Quyết định công nghệ', description: 'Dịch vụ FastAPI, Postgres lưu nhật ký, Redis đếm giới hạn tốc độ.' },
        { title: 'Chính sách thử lại', description: 'Backoff lũy thừa, tối đa 3 lần, không thử lại với lỗi 4xx.' },
        { title: 'Câu hỏi còn mở', description: 'Nhà cung cấp dự phòng có cần giữ streaming cho mọi nhà cung cấp không?' },
      ]
    },
    {
      id: 'circa', name: 'C.I.R.C.A Desktop', description: 'Ứng dụng Electron quản lý ngữ cảnh và chuyển tiếp công việc giữa các website AI.',
      context: [
        { title: 'Kiến trúc', description: 'Electron + Python backend, lưu cục bộ bằng SQLite.' },
        { title: 'Giai đoạn hiện tại', description: 'Hoàn thiện giao diện, sau đó làm quản lý ngữ cảnh cục bộ.' },
      ]
    },
    {
      id: 'research', name: 'Nghiên cứu thị trường', description: 'Tổng hợp khảo sát người dùng và đối thủ cho quý tới.',
      context: [
        { title: 'Phạm vi', description: 'Tập trung nhóm người dùng làm việc với nhiều công cụ AI.' },
      ]
    },
  ],
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const currentProject = () => state.projects.find(p => p.id === state.projectId);


function setProject(id) {
  const project = state.projects.find(p => p.id === id);
  if (!project) return;

  state.projectId = project.id;

  $('#project-title').textContent = project.name;
  $('#project-name').textContent = project.name;
  $('#project-desc').textContent = project.description;

  // Đánh dấu dự án đang được chọn
  $$('#projects .recent-item').forEach(button => {
    const active = button.dataset.id === project.id;

    button.classList.toggle('active', active);

    if (active) {
      button.setAttribute('aria-current', 'true');
    } else {
      button.removeAttribute('aria-current');
    }
  });

  // Cập nhật danh sách ngữ cảnh
  renderContext();
}

/* ---------- Điều hướng ---------- */
function setActiveNav(name) {
  state.activeNav = name;
  $$('.nav-item').forEach(b => b.dataset.nav === name ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
}

/* ---------- Dự án ---------- */
function buildProjects() {
  const list = $('#projects');
  state.projects.forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'recent-item';
    b.dataset.id = p.id;
    b.title = p.name;
    b.setAttribute('role', 'listitem');
    const mini = document.createElement('span');
    mini.className = 'mini';
    mini.setAttribute('aria-hidden', 'true');
    mini.textContent = p.name[0];
    const text = document.createElement('span');
    text.className = 'r-text';
    const title = document.createElement('strong');
    title.textContent = p.name;
    const sub = document.createElement('small');
    sub.dataset.count = '';
    text.append(title, sub);
    b.append(mini, text);
    b.addEventListener('click', () => { setProject(p.id); setActiveNav('workspace'); });
    list.appendChild(b);
  });
}

function setProvider(id) {
  const provider = ProviderRegistry.getById(id);
  if (!provider) return;

  state.provider = provider.id;

  const label = $('#provider-label');
  if (label) label.textContent = provider.name;

  const select = $('#provider-select');
  if (select) select.value = provider.id;
}

function buildProviders() {
  const select = $('#provider-select');
  select.replaceChildren();

  PROVIDERS = ProviderRegistry.getAll();

  PROVIDERS.forEach(provider => {
    const option = document.createElement('option');
    option.value = provider.id;
    option.textContent = provider.name;
    select.appendChild(option);
  });

  select.addEventListener('change', async () => {
    const previous = state.provider;
    setProvider(select.value);

    if (!window.circaDesktop?.isElectron) {
      console.warn('Hãy chạy C.I.R.C.A bằng Electron.');
      return;
    }

    try {
      await window.circaDesktop.openProvider(select.value);
    } catch (error) {
      console.error('Không thể mở website AI:', error);
      setProvider(previous); // trả dropdown về AI cũ nếu mở thất bại
    }
  });
}

/* ---------- Ngữ cảnh ---------- */
function renderContext() {
  const items = currentProject().context;
  const list = $('#ctx-list');
  list.replaceChildren();
  items.forEach(item => {
    const li = document.createElement('li');
    li.className = 'ctx-item';
    const strong = document.createElement('strong');
    strong.innerHTML = '<svg aria-hidden="true"><use href="#i-pin"/></svg>';
    strong.append(item.title);
    const span = document.createElement('span');
    span.textContent = item.description;
    li.append(strong, span);
    list.appendChild(li);
  });
  const pct = Math.min(100, Math.round(items.length / MAX_ITEMS * 100));
  $('#usage-fill').style.width = pct + '%';
  $('#usage-bar').setAttribute('aria-valuenow', pct);
  $('#usage-text').textContent = `${items.length}/${MAX_ITEMS} mục`;
  state.projects.forEach(p => {
    const el = $(`.recent-item[data-id="${p.id}"] [data-count]`);
    if (el) el.textContent = `${p.context.length} mục đã ghim`;
  });
}

function buildHandoffPrompt() {
  const p = currentProject();
  const items = p.context.map(c => `- ${c.title}: ${c.description}`).join('\n');
  return `Bạn đang tiếp tục làm việc trong dự án "${p.name}".\n\nTóm tắt dự án:\n${p.description}\n\nNgữ cảnh đã ghim:\n${items}\n\nHãy xem lại ngữ cảnh trên, xác nhận những gì bạn hiểu và hỏi lại nếu có điểm chưa rõ trước khi chúng ta tiếp tục.`;
}

/* ---------- Thu gọn thanh bên ---------- */
const SIDES = {
  left: { cls: 'left-collapsed', btn: '#toggle-left', name: 'trái' },
  right: { cls: 'right-collapsed', btn: '#toggle-right', name: 'phải', panel: '#context-panel' },
};


function setCollapsed(side, collapsed) {
  const cfg = SIDES[side];
  if (!cfg) return;

  const app = document.querySelector('.app');
  const panel = cfg.panel ? document.querySelector(cfg.panel) : null;

  app.classList.toggle(cfg.cls, collapsed);

  const btn = document.querySelector(cfg.btn);
  btn?.setAttribute('aria-expanded', String(!collapsed));
  const label = `${collapsed ? 'Mở rộng' : 'Thu gọn'} thanh bên ${cfg.name}`;
  btn?.setAttribute('aria-label', label);
  if (btn) btn.title = label;

  if (panel) {
    panel.inert = collapsed || app.classList.contains('web-focus');
  }

  requestAnimationFrame(() => {
    window.circaReportStageBounds?.();
  });

  console.log(
    `[CIRCA] ${side}:`,
    collapsed ? 'đã thu gọn' : 'đã mở rộng',
    app.className
  );
}

function initToggles() {
  Object.keys(SIDES).forEach(side => {
    $(SIDES[side].btn).addEventListener('click', () => setCollapsed(side, !$('.app').classList.contains(SIDES[side].cls)));
  });
}

/* ---------- Kéo đổi kích thước panel ---------- */
const LAYOUT_KEY = 'circa-layout';
const MIN_STAGE = 360; // bề rộng tối thiểu của khung website

const RESIZE = {
  left: {
    handle: '#resize-left', panel: '#sidebar', prop: '--lw-user',
    min: 200, max: 400, fallback: 272, dir: 1,
  },
  right: {
    handle: '#resize-right', panel: '#context-panel', prop: '--rw-user',
    min: 260, max: 640, fallback: 320, dir: -1,
  },
};

// Giới hạn bề rộng: trong khoảng min–max và luôn chừa MIN_STAGE cho website.
function clampWidth(width, cfg, startWidth, mainWidth) {
  const room = Math.max(0, mainWidth - MIN_STAGE);
  const max = Math.max(cfg.min, Math.min(cfg.max, startWidth + room));
  return Math.round(Math.max(cfg.min, Math.min(max, width)));
}

function saveLayout() {
  const app = $('.app');
  const layout = {};
  Object.entries(RESIZE).forEach(([side, cfg]) => {
    const value = parseFloat(app.style.getPropertyValue(cfg.prop));
    if (value) layout[side] = value;
  });
  try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { }
}

function restoreLayout() {
  let layout = {};
  try { layout = JSON.parse(localStorage.getItem(LAYOUT_KEY)) || {}; } catch { }

  Object.entries(RESIZE).forEach(([side, cfg]) => {
    const value = Number(layout[side]);
    if (value >= cfg.min && value <= cfg.max) {
      $('.app').style.setProperty(cfg.prop, value + 'px');
    }
  });
}

function initResizers() {
  const app = $('.app');
  restoreLayout();

  Object.entries(RESIZE).forEach(([side, cfg]) => {
    const handle = $(cfg.handle);
    const panel = $(cfg.panel);
    let drag = null;

    const currentWidth = () => panel.getBoundingClientRect().width;
    const mainWidth = () => $('.main').getBoundingClientRect().width;

    function apply(width, startWidth, room) {
      const value = clampWidth(width, cfg, startWidth, room);
      app.style.setProperty(cfg.prop, value + 'px');
      handle.setAttribute('aria-valuenow', value);
    }

    function end() {
      if (!drag) return;
      const id = drag.id;
      drag = null;
      try { handle.releasePointerCapture(id); } catch { }
      app.classList.remove('resizing');
      handle.classList.remove('dragging');
      // Hiện lại website sau khi kéo xong.
      window.circaDesktop?.setStageVisible(true);
      saveLayout();
      window.circaReportStageBounds?.();
    }

    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      end(); // dọn lần kéo cũ nếu bị kẹt
      e.preventDefault();

      drag = {
        id: e.pointerId,
        startX: e.clientX,
        startWidth: currentWidth(),
        room: mainWidth(),
      };
      handle.setPointerCapture(e.pointerId);
      app.classList.add('resizing');
      handle.classList.add('dragging');

      // WebContentsView là lớp native nằm đè lên giao diện và nuốt sự kiện chuột.
      // Ẩn website trong lúc kéo để giao diện nhận được toàn bộ chuyển động chuột.
      window.circaDesktop?.setStageVisible(false);
    });

    handle.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      apply(drag.startWidth + (e.clientX - drag.startX) * cfg.dir, drag.startWidth, drag.room);
    });

    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type =>
      handle.addEventListener(type, end));
    window.addEventListener('blur', end);

    // Nhấp đúp để về kích thước mặc định
    handle.addEventListener('dblclick', () => {
      app.style.removeProperty(cfg.prop);
      handle.setAttribute('aria-valuenow', cfg.fallback);
      saveLayout();
    });

    // Bàn phím: ←/→ đổi 16px, giữ Shift đổi 48px
    handle.addEventListener('keydown', e => {
      const sign = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (!sign) return;
      e.preventDefault();

      const step = (e.shiftKey ? 48 : 16) * sign * cfg.dir;
      const start = currentWidth();
      apply(start + step, start, mainWidth());
      saveLayout();
    });

    handle.setAttribute('aria-valuenow', Math.round(currentWidth()) || cfg.fallback);
  });
}

/* ---------- Tab ---------- */
function selectTab(tab) {
  $$('.tabs [role="tab"]').forEach(t => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
}

function initTabs() {
  const tabs = $$('.tabs [role="tab"]');
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      selectTab(next); next.focus();
    });
  });
}

/* ---------- Hộp thoại ---------- */
let lastTrigger = null;

function openModal(id, trigger) {
  lastTrigger = trigger;
  const modal = $(id);
  modal.classList.add('open');
  const focusable = $('input, textarea, button.btn-primary, button', modal);
  focusable && focusable.focus();
}

function closeModals() {
  const open = $$('.modal.open');
  if (!open.length) return;
  open.forEach(m => m.classList.remove('open'));
  $('#copy-feedback').textContent = '';
  lastTrigger && lastTrigger.focus();
}

async function copyPrompt() {
  const text = $('#prompt-text').textContent;
  const fb = $('#copy-feedback');
  try {
    await navigator.clipboard.writeText(text);
    fb.textContent = 'Đã sao chép nội dung';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('#prompt-text'));
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
    fb.textContent = 'Không thể sao chép tự động. Đã chọn văn bản, hãy nhấn Ctrl+C';
  }
}

function handleAddSubmit(e) {
  e.preventDefault();
  const data = new FormData(e.target);
  currentProject().context.push({ title: data.get('title').trim(), description: data.get('description').trim() });
  renderContext();
  e.target.reset();
  $('#save-btn').disabled = true;
  closeModals();
}

/* ---------- Giao diện sáng/tối ---------- */
function setTheme(theme, animate = true) {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (animate && !reduce) {
    root.classList.add('theme-anim');
    clearTimeout(setTheme.t);
    setTheme.t = setTimeout(() => root.classList.remove('theme-anim'), 450);
  }
  root.dataset.theme = theme;
  try { localStorage.setItem('circa-theme', theme); } catch { }
  const next = theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối';
  const btn = $('#theme-toggle');
  $('#theme-label').textContent = next;
  btn.title = next;
  btn.setAttribute('aria-label', `Chuyển sang ${next.toLowerCase()}`);
}


/* ---------- Nhà cung cấp AI ---------- */
async function initProviders() {
  try {
    await ProviderRegistry.load();
  } catch (error) {
    console.error('Lỗi nạp cấu hình AI:', error);

    const heading = $('.placeholder h2');
    const description = $('.placeholder p');
    if (heading) heading.textContent = 'Không thể nạp cấu hình AI';
    if (description) {
      description.textContent =
        'Kiểm tra plugins/providers.json và js/providers.js.';
    }
    return;
  }

  buildProviders();

  const initial = ProviderRegistry.getById(DEFAULT_PROVIDER);
  setProvider(initial ? initial.id : PROVIDERS[0].id);
}

/* ---------- Thu phóng chữ & giao diện (Ctrl + con lăn, Ctrl +/-/0) ---------- */
function initZoom() {
  const hud = document.createElement('div');
  hud.className = 'zoom-hud';
  hud.setAttribute('role', 'status');
  document.body.append(hud);

  let timer;
  const show = (label, factor) => {
    hud.textContent = `${label} ${Math.round(factor * 100)}%`;
    hud.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(() => hud.classList.remove('show'), 1100);
  };

  // Trong Electron: tiến trình chính xử lý zoom, giao diện chỉ hiện thông báo.
  if (window.circaDesktop?.onZoom) {
    window.circaDesktop.onZoom(({ target, factor }) =>
      show(target === 'ui' ? 'Giao diện' : 'Website', factor));
    return;
  }

  // Chạy trên trình duyệt thường
  let f = 1;
  const set = v => {
    f = Math.min(1.8, Math.max(0.6, Math.round(v * 100) / 100));
    document.documentElement.style.zoom = f;
    show('Giao diện', f);
  };
  window.addEventListener('wheel', e => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    set(f + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); set(f + 0.1); }
    else if (e.key === '-') { e.preventDefault(); set(f - 0.1); }
    else if (e.key === '0') { e.preventDefault(); set(1); }
  });
}

/* ---------- Chế độ tập trung web ---------- */
function initWebFocus() {
  const app = $('.app');
  const btn = $('#focus-web');
  const isOn = () => app.classList.contains('web-focus');

  function set(on) {
    if (on === isOn()) return;
    app.classList.toggle('web-focus', on);

    const label = on ? 'Thu nhỏ khung web (Ctrl+Shift+F)' : 'Mở rộng khung web (Ctrl+Shift+F)';
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', label);
    btn.title = label;

    $('#sidebar').inert = on;
    $('#context-panel').inert = on || app.classList.contains('right-collapsed');

    requestAnimationFrame(() => window.circaReportStageBounds?.());
  }

  btn.addEventListener('click', () => set(!isOn()));

  // Phím tắt khi con trỏ đang ở website (do tiến trình chính chuyển tiếp)
  window.circaDesktop?.onToggleFocus?.(() => set(!isOn()));

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isOn() && !$('.modal.open')) {
      set(false);
    } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      set(!isOn());
    }
  });
}

/* ---------- Khởi tạo ---------- */
async function init() {
  // Giao diện không phụ thuộc providers.json được gắn trước,
  // để một lỗi cấu hình không làm hỏng toàn bộ ứng dụng.
  buildProjects();
  setProject(state.projectId);
  initTabs();
  initToggles();
  initResizers();
  initZoom();
  initWebFocus();

  setTheme(document.documentElement.dataset.theme || 'dark', false);

  $('#theme-toggle').addEventListener('click', () => {
    setTheme(
      document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    );
  });

  $$('.nav-item').forEach(button => {
    button.addEventListener('click', () => {
      setActiveNav(button.dataset.nav);
    });
  });

  $('#add-context').addEventListener('click', event => {
    openModal('#modal-add', event.currentTarget);
  });

  $('#continue-context').addEventListener('click', event => {
    $('#prompt-text').textContent = buildHandoffPrompt();
    openModal('#modal-continue', event.currentTarget);
  });

  $('#add-form').addEventListener('submit', handleAddSubmit);

  $('#add-form').addEventListener('input', event => {
    $('#save-btn').disabled =
      !event.currentTarget.checkValidity() ||
      !event.currentTarget.title.value.trim();
  });

  $('#copy-prompt').addEventListener('click', copyPrompt);

  $$('[data-close]').forEach(button => {
    button.addEventListener('click', closeModals);
  });

  $$('.modal').forEach(modal => {
    modal.addEventListener('mousedown', event => {
      if (event.target === modal) closeModals();
    });
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModals();
  });

  await initProviders();
}

init();