// Camada de armazenamento local (fallback offline + cache).
// Isolada aqui para que trocar localStorage por IndexedDB no futuro não afete o resto.
import { STORAGE_KEYS } from '../config.js';

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn('[localStore] leitura falhou', key, err);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // Quota cheia ou modo privado: avisamos quem chamou para mostrar erro na UI.
    console.error('[localStore] gravação falhou', key, err);
    return false;
  }
}

export const LocalStore = {
  loadData: () => read(STORAGE_KEYS.data, null),
  saveData: (data) => write(STORAGE_KEYS.data, data),
  loadOutbox: () => read(STORAGE_KEYS.outbox, []),
  saveOutbox: (ops) => write(STORAGE_KEYS.outbox, ops),
  loadConfig: () => read(STORAGE_KEYS.config, {}),
  saveConfig: (cfg) => write(STORAGE_KEYS.config, cfg),
  loadAuth: () => read(STORAGE_KEYS.auth, null),
  saveAuth: (a) => (a ? write(STORAGE_KEYS.auth, a) : localStorage.removeItem(STORAGE_KEYS.auth)),
  clearAll() {
    Object.values(STORAGE_KEYS).forEach((k) => {
      if (k !== STORAGE_KEYS.config) localStorage.removeItem(k);
    });
  },
};
