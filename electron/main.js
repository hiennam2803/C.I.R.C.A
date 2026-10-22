'use strict';

const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
} = require('electron');

const path = require('node:path');
const fs = require('node:fs');

let mainWindow = null;
let aiView = null;
let currentProvider = 'claude';

let aiReady = false;          // website đã tải xong ít nhất một lần
let stageSuppressed = false;  // giao diện đang tạm ẩn website (kéo panel, hộp thoại)

const PROVIDERS = {
  claude: 'https://claude.ai/',
  chatgpt: 'https://chatgpt.com/',
  gemini: 'https://gemini.google.com/',
};

// ----- Thu phóng: giao diện (ui) và website AI (site) tách riêng, có lưu lại -----
const ZOOM = { min: 0.6, max: 1.8, step: 0.1 };
const zoom = { ui: 1, site: 1 };
let lastZoomAt = 0;

const clampZoom = (v) =>
  Math.round(Math.min(ZOOM.max, Math.max(ZOOM.min, v)) * 100) / 100;
const zoomFile = () => path.join(app.getPath('userData'), 'zoom.json');

function loadZoom() {
  try {
    const saved = JSON.parse(fs.readFileSync(zoomFile(), 'utf8'));
    for (const key of ['ui', 'site']) {
      if (Number.isFinite(saved[key])) zoom[key] = clampZoom(saved[key]);
    }
  } catch {}
}

function applyZoom(target) {
  const wc = target === 'ui' ? mainWindow?.webContents : aiView?.webContents;
  if (!wc || wc.isDestroyed()) return;

  wc.setZoomFactor(zoom[target]);
  try { fs.writeFileSync(zoomFile(), JSON.stringify(zoom)); } catch {}

  mainWindow.webContents.send('circa:zoom-changed', {
    target,
    factor: zoom[target],
  });

  // Đo lại khung website vì tỉ lệ giao diện đã đổi.
  if (target === 'ui') setTimeout(updateViewBounds, 60);
}

// dir: 1 phóng to, -1 thu nhỏ, 0 đặt lại 100%
function stepZoom(target, dir) {
  const now = Date.now();
  if (dir !== 0 && now - lastZoomAt < 50) return; // chống cuộn quá nhanh
  lastZoomAt = now;

  zoom[target] = dir === 0 ? 1 : clampZoom(zoom[target] + dir * ZOOM.step);
  applyZoom(target);
}

function hookZoom(wc, target) {
  wc.on('did-finish-load', () => wc.setZoomFactor(zoom[target]));

  // Ctrl + con lăn
  wc.on('zoom-changed', (_event, direction) =>
    stepZoom(target, direction === 'in' ? 1 : -1));

  // Ctrl + / Ctrl - / Ctrl 0
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !(input.control || input.meta)) return;

    // Ctrl+Shift+F: bật/tắt chế độ tập trung web (kể cả khi con trỏ ở trong website)
    if (input.shift && input.key.toLowerCase() === 'f') {
      event.preventDefault();
      mainWindow?.webContents.send('circa:toggle-focus');
      return;
    }

    // Ctrl + / Ctrl - / Ctrl 0
    const map = { '+': 1, '=': 1, '-': -1, '_': -1, '0': 0 };
    if (!(input.key in map)) return;
    event.preventDefault();
    stepZoom(target, map[input.key]);
  });
}

// Nhận tọa độ thật của #ai-stage từ giao diện HTML.
ipcMain.on('circa:stage-bounds', (event, bounds) => {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    !aiView ||
    event.sender !== mainWindow.webContents ||
    !bounds ||
    ![bounds.x, bounds.y, bounds.width, bounds.height]
      .every(Number.isFinite)
  ) {
    return;
  }

  const [contentWidth, contentHeight] =
    mainWindow.getContentSize();

  // Tọa độ từ giao diện là CSS px; đổi sang DIP theo mức zoom giao diện.
  const z = mainWindow.webContents.getZoomFactor();

  // Giới hạn tọa độ trong vùng nội dung cửa sổ.
  const x = Math.max(0, Math.round(bounds.x * z));
  const y = Math.max(0, Math.round(bounds.y * z));
  const right = Math.min(
    contentWidth,
    Math.round((bounds.x + bounds.width) * z)
  );
  const bottom = Math.min(
    contentHeight,
    Math.round((bounds.y + bounds.height) * z)
  );

  const width = right - x;
  const height = bottom - y;

  if (width <= 0 || height <= 0) {
    aiView.setVisible(false);
    return;
  }

  aiView.setBounds({ x, y, width, height });
});

function applyViewVisibility() {
  if (!aiView || aiView.webContents.isDestroyed()) return;
  aiView.setVisible(aiReady && !stageSuppressed);
}

// Giao diện yêu cầu ẩn/hiện website (ví dụ khi kéo đổi kích thước panel).
ipcMain.on('circa:set-stage-visible', (event, visible) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;

  stageSuppressed = !visible;
  applyViewVisibility();
});

// Yêu cầu giao diện đo lại khung hiển thị.
function updateViewBounds() {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    mainWindow.webContents.isLoading()
  ) {
    return;
  }

  mainWindow.webContents
    .executeJavaScript(
      'window.circaReportStageBounds?.()'
    )
    .catch((error) => {
      console.error(
        '[CIRCA] Không đo được khung website:',
        error.message
      );
    });
}

// Mở website AI.
async function openProvider(providerId) {
  const url = PROVIDERS[providerId];

  if (!url || !mainWindow || !aiView) {
    throw new Error('Provider không hợp lệ hoặc chưa sẵn sàng.');
  }

  currentProvider = providerId;

  console.log('[CIRCA] Đang mở:', url);

  // Đo lại trước khi tải website.
  updateViewBounds();

  try {
    await aiView.webContents.loadURL(url);

    console.log(
      '[CIRCA] Đã tải:',
      aiView.webContents.getURL()
    );

    updateViewBounds();
    aiReady = true;
    applyViewVisibility();

    mainWindow.webContents.send(
      'circa:provider-changed',
      currentProvider
    );
  } catch (error) {
    console.error('[CIRCA] Lỗi tải website:', error);
    throw error;
  }
}

// API mở provider từ giao diện chính.
ipcMain.handle(
  'circa:open-provider',
  async (event, providerId) => {
    if (
      !mainWindow ||
      event.sender !== mainWindow.webContents
    ) {
      throw new Error('Nguồn yêu cầu không hợp lệ.');
    }

    if (!Object.hasOwn(PROVIDERS, providerId)) {
      throw new Error('Nhà cung cấp AI không hợp lệ.');
    }

    await openProvider(providerId);

    return {
      success: true,
      provider: currentProvider,
    };
  }
);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 650,
    title: 'C.I.R.C.A',
    backgroundColor: '#0f1629',

    icon: path.join(__dirname, '../assets/icon.ico'),

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  aiView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  aiView.setVisible(false);

  aiView.webContents.on(
    'did-fail-load',
    (_event, code, description, url, isMainFrame) => {
      if (!isMainFrame) return;

      console.error('[CIRCA] Lỗi tải website:', {
        code,
        description,
        url,
      });
    }
  );

  aiView.webContents.on(
    'render-process-gone',
    (_event, details) => {
      console.error(
        '[CIRCA] Tiến trình website bị dừng:',
        details
      );
    }
  );

  mainWindow.contentView.addChildView(aiView);

  hookZoom(mainWindow.webContents, 'ui');
  hookZoom(aiView.webContents, 'site');

  mainWindow.on('resize', updateViewBounds);

  // Chỉ khởi tạo observer một lần sau khi HTML tải xong.
  mainWindow.webContents.once('did-finish-load', async () => {
    console.log('[CIRCA] Giao diện chính đã tải.');

    try {
      await mainWindow.webContents.executeJavaScript(`
        (() => {
          const stage = document.getElementById('ai-stage');
          const appElement = document.querySelector('.app');

          if (!stage || !appElement || !window.circaDesktop) {
            console.error(
              '[CIRCA] Không tìm thấy #ai-stage hoặc API Electron.'
            );
            return;
          }

          let frameId = 0;

          window.circaReportStageBounds = () => {
            cancelAnimationFrame(frameId);

            frameId = requestAnimationFrame(() => {
              const rect = stage.getBoundingClientRect();

              window.circaDesktop.reportStageBounds({
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
              });
            });
          };

          // Theo dõi kích thước stage và bố cục ứng dụng.
          const resizeObserver = new ResizeObserver(() => {
            window.circaReportStageBounds();
          });

          resizeObserver.observe(stage);
          resizeObserver.observe(appElement);

          // Theo dõi thao tác thu gọn/mở rộng panel.
          const mutationObserver = new MutationObserver(() => {
            window.circaReportStageBounds();
          });

          mutationObserver.observe(appElement, {
            attributes: true,
            attributeFilter: ['class', 'style']
          });

          // Theo dõi thay đổi kích thước cửa sổ.
          window.addEventListener(
            'resize',
            window.circaReportStageBounds
          );

          // Đo khung ban đầu.
          window.circaReportStageBounds();
        })();
      `);

      await openProvider('claude');
    } catch (error) {
      console.error(
        '[CIRCA] Không thể khởi tạo website:',
        error
      );
    }
  });

  mainWindow.loadFile(
    path.join(__dirname, '..', 'index.html')
  );

  mainWindow.on('closed', () => {
    mainWindow = null;
    aiView = null;
  });
}

app.whenReady().then(() => {
  loadZoom();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});