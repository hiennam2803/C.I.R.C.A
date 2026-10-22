'use strict';

/**
 * ProviderRegistry: nạp và cung cấp danh sách nhà cung cấp AI
 * từ plugins/providers.json. Chỉ giữ provider hợp lệ và đang bật.
 */
const ProviderRegistry = (() => {
  const CONFIG_URL = 'plugins/providers.json';
  let providers = [];
  let loaded = false;

  function isValid(p) {
    if (!p || typeof p !== 'object') return false;
    if (typeof p.id !== 'string' || !p.id.trim()) return false;
    if (typeof p.name !== 'string' || !p.name.trim()) return false;
    try {
      return new URL(p.url).protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function load() {
    const response = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Không đọc được ${CONFIG_URL} (HTTP ${response.status})`);
    }

    const config = await response.json();
    if (!config || !Array.isArray(config.providers)) {
      throw new Error('providers.json sai cấu trúc: thiếu mảng "providers".');
    }

    const seen = new Set();
    providers = config.providers.filter(p => {
      if (!isValid(p) || p.enabled === false || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });

    if (!providers.length) {
      throw new Error('Không có nhà cung cấp AI hợp lệ nào đang bật.');
    }

    loaded = true;
    return getAll();
  }

  function getAll() {
    return loaded ? providers.map(p => ({ ...p })) : [];
  }

  function getById(id) {
    const found = providers.find(p => p.id === id);
    return found ? { ...found } : null;
  }

  return { load, getAll, getById };
})();