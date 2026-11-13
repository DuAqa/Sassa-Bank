// Data Service: única porta de entrada para ler/gravar dados.
// Estratégia "local-first": toda alteração é aplicada no aparelho na hora,
// gravada no localStorage e enfileirada numa "outbox". O sync envia a fila ao
// backend quando houver internet e depois baixa o estado oficial da planilha.
// Assim nada se perde offline e a UI nunca espera a rede.
import { APP, DEFAULT_CATEGORIES } from '../config.js';
import { Store } from '../state.js';
import { LocalStore } from './localStore.js';
import { createRemoteApi, RemoteError } from './remoteApi.js';
import { Auth } from './auth.js';
import { buildDemoData } from './demo.js';
import { uid, today, addMonths, splitInstallments, round2, isValidISODate } from '../utils.js';

const COLLECTION = { transacao: 'transactions', meta: 'goals', categoria: 'categories' };

let data = null;
let outbox = [];
let syncing = null;
let syncTimer = null;

// ---------------- helpers internos ----------------
function emptyData() {
  return {
    transactions: [],
    goals: [],
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    settings: { name: APP.defaultUserName },
    meta: { demo: false, createdAt: new Date().toISOString() },
  };
}

function commit() {
  const ok = LocalStore.saveData(data) && LocalStore.saveOutbox(outbox);
  Store.setData(structuredClone(data));
  Store.setSync({ pending: outbox.length, status: computeStatus() });
  if (!ok) throw new Error('Não consegui salvar no aparelho. Libere espaço e tente de novo.');
}

function enqueue(action, entity, record) {
  if (data.meta.demo) return; // dados de demonstração nunca vão para a planilha
  // Compacta: se já existe op para o mesmo registro, mantém só a mais recente.
  outbox = outbox.filter((op) => !(op.entity === entity && op.record.id === record.id));
  outbox.push({ opId: uid('op_'), action, entity, record, at: new Date().toISOString() });
}

function upsertLocal(entity, record) {
  const list = data[COLLECTION[entity]];
  const i = list.findIndex((x) => x.id === record.id);
  if (i >= 0) list[i] = record; else list.push(record);
  enqueue('upsert', entity, record);
}

function removeLocal(entity, id) {
  const key = COLLECTION[entity];
  const rec = data[key].find((x) => x.id === id);
  data[key] = data[key].filter((x) => x.id !== id);
  if (rec) enqueue('delete', entity, { id });
}

function config() { return LocalStore.loadConfig(); }
function isConfigured() { return Boolean(config().apiUrl); }

function computeStatus() {
  if (!isConfigured()) return 'local';
  if (!navigator.onLine) return 'offline';
  if (outbox.length > 0) return 'pending';
  return 'synced';
}

function remote() {
  const cfg = config();
  return createRemoteApi({
    url: cfg.apiUrl,
    apiKey: cfg.apiKey,
    getIdToken: cfg.googleClientId ? Auth.getIdToken : null,
  });
}

// ---------------- validação (espelhada no backend) ----------------
function assertAmount(v) {
  const n = round2(v);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Digite um valor maior que zero.');
  if (n > 1_000_000) throw new Error('Esse valor parece alto demais. Confere?');
  return n;
}

// ---------------- API pública ----------------
export const DataService = {
  init() {
    data = LocalStore.loadData();
    outbox = LocalStore.loadOutbox();
    if (!data) {
      data = isConfigured() ? emptyData() : buildDemoData(emptyData());
      LocalStore.saveData(data);
    }
    // Garante categorias padrão caso a base seja antiga/incompleta.
    if (!data.categories?.length) data.categories = DEFAULT_CATEGORIES.map((c) => ({ ...c }));
    data.settings = { name: APP.defaultUserName, ...data.settings };
    Store.setData(structuredClone(data));
    Store.setSync({ pending: outbox.length, status: computeStatus(), lastSync: data.meta.lastSync || null });

    window.addEventListener('online', () => { Store.setSync({ status: computeStatus() }); DataService.sync(); });
    window.addEventListener('offline', () => Store.setSync({ status: 'offline' }));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) DataService.sync(); });
    clearInterval(syncTimer);
    syncTimer = setInterval(() => { if (!document.hidden) DataService.sync({ quiet: true }); }, APP.syncIntervalMs);
    Auth.onChange(() => DataService.sync());
  },

  isConfigured,
  getConfig: config,
  setConfig(patch) {
    const next = { ...config(), ...patch };
    Object.keys(next).forEach((k) => { if (next[k] === '' || next[k] == null) delete next[k]; });
    LocalStore.saveConfig(next);
    Store.setSync({ status: computeStatus(), message: '' });
  },

  // ---------- Transações ----------
  /**
   * Cria uma movimentação. Para despesas parceladas, gera N transações
   * (uma por mês) ligadas pelo mesmo purchaseId: as futuras viram "comprometido".
   */
  addTransaction({ type, amount, category, description = '', date = today(), payment = '', installments = 1 }) {
    if (!['receita', 'despesa'].includes(type)) throw new Error('Tipo inválido.');
    const total = assertAmount(amount);
    if (!category) throw new Error('Escolha uma categoria.');
    if (!isValidISODate(date)) throw new Error('Data inválida.');
    const n = type === 'despesa' ? Math.max(1, Math.min(APP.maxInstallments, Math.floor(installments) || 1)) : 1;
    const now = new Date().toISOString();
    const purchaseId = n > 1 ? uid('cp_') : '';
    const parts = splitInstallments(total, n);
    const created = parts.map((value, i) => ({
      id: uid('tx_'),
      date: addMonths(date, i),
      type,
      category,
      description: String(description).trim().slice(0, 80),
      amount: value,
      payment: payment || '',
      installment: n > 1 ? i + 1 : '',
      installments: n > 1 ? n : '',
      purchaseId,
      purchaseTotal: n > 1 ? total : '',
      createdAt: now,
      updatedAt: now,
    }));
    created.forEach((t) => upsertLocal('transacao', t));
    commit();
    DataService.sync({ quiet: true });
    return created;
  },

  updateTransaction(id, patch) {
    const t = data.transactions.find((x) => x.id === id);
    if (!t) throw new Error('Movimentação não encontrada.');
    const next = { ...t, ...patch, updatedAt: new Date().toISOString() };
    if (patch.amount != null) next.amount = assertAmount(patch.amount);
    upsertLocal('transacao', next);
    commit();
    DataService.sync({ quiet: true });
  },

  deleteTransaction(id) {
    removeLocal('transacao', id);
    commit();
    DataService.sync({ quiet: true });
  },

  /** Exclui todas as parcelas de uma compra parcelada. */
  deletePurchase(purchaseId) {
    data.transactions.filter((t) => t.purchaseId === purchaseId).forEach((t) => removeLocal('transacao', t.id));
    commit();
    DataService.sync({ quiet: true });
  },

  // ---------- Metas ----------
  addGoal({ name, emoji = '🎯', target, saved = 0, targetDate = '' }) {
    if (!String(name || '').trim()) throw new Error('Dê um nome para a meta.');
    const now = new Date().toISOString();
    const g = {
      id: uid('mt_'), name: String(name).trim().slice(0, 40), emoji,
      target: assertAmount(target), saved: Math.max(0, round2(saved || 0)),
      targetDate: targetDate && isValidISODate(targetDate) ? targetDate : '',
      status: 'ativa', createdAt: now, updatedAt: now,
    };
    if (g.saved >= g.target) g.status = 'concluida';
    upsertLocal('meta', g);
    commit();
    DataService.sync({ quiet: true });
    return g;
  },

  updateGoal(id, patch) {
    const g = data.goals.find((x) => x.id === id);
    if (!g) throw new Error('Meta não encontrada.');
    const next = { ...g, ...patch, updatedAt: new Date().toISOString() };
    if (patch.target != null) next.target = assertAmount(patch.target);
    next.status = next.saved >= next.target ? 'concluida' : 'ativa';
    upsertLocal('meta', next);
    commit();
    DataService.sync({ quiet: true });
    return next;
  },

  /** Guarda (valor > 0) ou retira (valor < 0) dinheiro de uma meta. */
  moveGoalMoney(id, delta) {
    const g = data.goals.find((x) => x.id === id);
    if (!g) throw new Error('Meta não encontrada.');
    const value = round2(delta);
    if (!value) throw new Error('Digite um valor.');
    if (g.saved + value < 0) throw new Error('Não dá para tirar mais do que está guardado.');
    return DataService.updateGoal(id, { saved: round2(g.saved + value) });
  },

  deleteGoal(id) {
    removeLocal('meta', id);
    commit();
    DataService.sync({ quiet: true });
  },

  // ---------- Categorias ----------
  addCategory({ tipo, nome, emoji }) {
    const name = String(nome || '').trim().slice(0, 20);
    if (!name) throw new Error('Dê um nome para a categoria.');
    if (data.categories.some((c) => c.tipo === tipo && c.ativa && c.nome.toLowerCase() === name.toLowerCase())) {
      throw new Error('Essa categoria já existe.');
    }
    const c = { id: uid('ct_'), tipo, nome: name, emoji: emoji || '🏷️', cor: tipo === 'receita' ? '#14B37D' : '#7A6CF0', ativa: true, ordem: data.categories.length };
    upsertLocal('categoria', c);
    commit();
    DataService.sync({ quiet: true });
    return c;
  },

  /** Categorias não são apagadas (o histórico depende delas): são desativadas. */
  toggleCategory(id, ativa) {
    const c = data.categories.find((x) => x.id === id);
    if (!c) return;
    upsertLocal('categoria', { ...c, ativa });
    commit();
    DataService.sync({ quiet: true });
  },

  // ---------- Preferências locais ----------
  setSettings(patch) {
    data.settings = { ...data.settings, ...patch };
    commit();
  },

  // ---------- Dados ----------
  isDemo: () => Boolean(data?.meta?.demo),

  startFresh() {
    const name = data?.settings?.name;
    data = emptyData();
    if (name) data.settings.name = name;
    outbox = [];
    commit();
    DataService.sync();
  },

  loadDemo() {
    data = buildDemoData(emptyData());
    outbox = [];
    commit();
  },

  exportJSON() {
    return JSON.stringify({ app: 'sassa-bank', version: APP.version, exportedAt: new Date().toISOString(), data }, null, 2);
  },

  importJSON(text) {
    const parsed = JSON.parse(text);
    const incoming = parsed?.data;
    if (parsed?.app !== 'sassa-bank' || !Array.isArray(incoming?.transactions) || !Array.isArray(incoming?.goals)) {
      throw new Error('Arquivo não reconhecido como backup do Sassa Bank.');
    }
    data = { ...emptyData(), ...incoming, meta: { ...incoming.meta, demo: false } };
    outbox = [];
    data.transactions.forEach((t) => enqueue('upsert', 'transacao', t));
    data.goals.forEach((g) => enqueue('upsert', 'meta', g));
    data.categories.forEach((c) => enqueue('upsert', 'categoria', c));
    commit();
    DataService.sync();
  },

  // ---------- Sincronização ----------
  /**
   * 1) envia a outbox; 2) baixa o estado oficial; 3) reaplica o que foi criado
   * durante o sync. Seguro para chamar várias vezes (só roda um por vez).
   */
  async sync({ quiet = false } = {}) {
    if (!isConfigured() || data.meta.demo) { Store.setSync({ status: computeStatus() }); return { skipped: true }; }
    if (!navigator.onLine) { Store.setSync({ status: 'offline' }); return { skipped: true }; }
    if (syncing) return syncing;
    if (config().googleClientId && !(await Auth.getIdToken())) {
      Store.setSync({ status: 'pending', message: 'Entre com Google em Ajustes para sincronizar.' });
      return { skipped: true };
    }

    Store.setSync({ syncing: true });
    syncing = (async () => {
      const api = remote();
      try {
        const sent = outbox.slice(0, 400);
        let rejectedMsg = '';
        if (sent.length) {
          const pushed = await api.push(sent);
          if (pushed.rejected?.length) {
            rejectedMsg = `${pushed.rejected.length} alteração(ões) recusada(s) pelo servidor: ${pushed.rejected[0].error}`;
            console.warn('[sync] recusadas', pushed.rejected);
          }
          const sentIds = new Set(sent.map((o) => o.opId));
          outbox = outbox.filter((o) => !sentIds.has(o.opId));
          LocalStore.saveOutbox(outbox);
        }
        const res = await api.pull();
        mergeServerState(res.data);
        data.meta.lastSync = new Date().toISOString();
        commit();
        Store.setSync({ status: rejectedMsg ? 'error' : computeStatus(), lastSync: data.meta.lastSync, message: rejectedMsg, syncing: false });
        if (outbox.length) return DataService.sync({ quiet }); // havia mais de 400 ops
        return { ok: true };
      } catch (err) {
        const msg = err instanceof RemoteError ? err.message : 'Falha inesperada ao sincronizar.';
        const status = err.code === 'NETWORK' || err.code === 'TIMEOUT' ? 'pending' : 'error';
        Store.setSync({ status, message: msg, syncing: false });
        if (!quiet) throw err;
        return { ok: false, error: msg };
      } finally {
        syncing = null;
      }
    })();
    return syncing;
  },
};

/** O servidor é a fonte oficial; alterações locais ainda na outbox têm prioridade. */
function mergeServerState(server) {
  if (!server) return;
  const pending = new Map(outbox.map((o) => [`${o.entity}:${o.record.id}`, o]));
  for (const [entity, key] of Object.entries(COLLECTION)) {
    const incoming = Array.isArray(server[key]) ? server[key] : [];
    const merged = incoming.filter((r) => !pending.has(`${entity}:${r.id}`));
    for (const op of outbox) {
      if (op.entity === entity && op.action === 'upsert') merged.push(op.record);
    }
    if (entity === 'categoria') {
      // Garante as categorias padrão mesmo se a planilha ainda estiver vazia.
      DEFAULT_CATEGORIES.forEach((c) => { if (!merged.some((m) => m.id === c.id)) merged.push({ ...c }); });
    }
    data[key] = merged;
  }
}
