// Estado da aplicação: os dados atualmente carregados + status de sincronização.
// A UI só lê daqui e se inscreve para re-renderizar; quem escreve é o DataService.

const listeners = new Set();

const state = {
  data: { transactions: [], goals: [], categories: [], settings: {}, meta: {} },
  sync: { status: 'local', pending: 0, lastSync: null, message: '' },
  ui: { view: 'inicio' },
};

export const Store = {
  get: () => state,
  setData(data) { state.data = data; emit('data'); },
  setSync(patch) { state.sync = { ...state.sync, ...patch }; emit('sync'); },
  setUi(patch) { state.ui = { ...state.ui, ...patch }; emit('ui'); },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

function emit(kind) {
  listeners.forEach((fn) => {
    try { fn(kind, state); } catch (err) { console.error('[store] listener', err); }
  });
}
