'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('circaDesktop', {
  isElectron: true,
  platform: process.platform,
  onToggleFocus: (cb) =>
    ipcRenderer.on('circa:toggle-focus', () => cb()),

  openProvider: (providerId) =>
    ipcRenderer.invoke('circa:open-provider', providerId),

  reportStageBounds: (bounds) =>
    ipcRenderer.send('circa:stage-bounds', bounds),
  setStageVisible: (visible) =>
    ipcRenderer.send('circa:set-stage-visible', Boolean(visible)),

  // Nhận thông báo mức thu phóng từ tiến trình chính.
  onZoom: (cb) =>
    ipcRenderer.on('circa:zoom-changed', (_event, data) => cb(data)),
});