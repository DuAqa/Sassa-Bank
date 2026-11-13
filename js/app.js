// Ponto de entrada: inicializa dados, roteia telas e liga eventos.
import { Store } from './state.js';
import { DataService } from './data/dataService.js';
import { Auth } from './data/auth.js';
import { RemoteError, createRemoteApi } from './data/remoteApi.js';
import { renderHome } from './ui/views/home.js';
import { renderExtrato, renderExtratoList, defaultFilters } from './ui/views/extrato.js';
import { renderAnalise } from './ui/views/analise.js';
import { renderMetas } from './ui/views/metas.js';
import { renderAjustes, SYNC_LABEL } from './ui/views/ajustes.js';
import { openRegister, openTransaction, openGoal, openGoalForm, openGoalMoney, openNewCategory } from './ui/flows.js';
import { toast, confirmDialog, closeAllSheets } from './ui/components.js';

const VIEWS = ['inicio', 'extrato', 'analise', 'metas', 'ajustes'];
const ui = { filters: defaultFilters(), analisePeriod: 'mes', catTab: 'despesa' };
const $ = (s, r = document) => r.querySelector(s);

// ---------------- Render ----------------
function currentView() {
  const v = location.hash.replace('#/', '');
  return VIEWS.includes(v) ? v : 'inicio';
}

function render() {
  const state = Store.get();
  const view = currentView();
  const root = $('#view');
  const html = {
    inicio: () => renderHome(state),
    extrato: () => renderExtrato(state, ui.filters),
    analise: () => renderAnalise(state, ui.analisePeriod),
    metas: () => renderMetas(state),
    ajustes: () => renderAjustes(state, { cfg: DataService.getConfig(), catTab: ui.catTab, auth: Auth.session() }),
  }[view]();
  root.innerHTML = html;
  root.dataset.view = view;
  document.querySelectorAll('[data-tab]').forEach((a) => {
    const on = a.dataset.tab === view;
    a.classList.toggle('on', on);
    a.setAttribute('aria-current', on ? 'page' : 'false');
  });
  renderChrome();
  if (view === 'ajustes') mountAjustes();
}

function renderChrome() {
  const { sync, data } = Store.get();
  const st = SYNC_LABEL[sync.status] || SYNC_LABEL.local;
  const pill = $('#sync-pill');
  pill.className = `sync-pill sync-${sync.status} ${sync.syncing ? 'spinning' : ''}`;
  pill.innerHTML = `<span>${st.dot}</span><span class="sync-text">${sync.syncing ? 'Sincronizando…' : st.text}</span>`;
  pill.title = sync.message || st.text;
  $('#demo-banner').hidden = !data.meta.demo;
  $('#offline-bar').hidden = navigator.onLine;
}

function navigate(view, extra = {}) {
  if (extra.period) ui.filters = { ...defaultFilters(), period: extra.period };
  if (location.hash !== `#/${view}`) location.hash = `#/${view}`;
  else render();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

// ---------------- Ajustes (efeitos específicos) ----------------
function mountAjustes() {
  const cfg = DataService.getConfig();
  const gsi = $('#gsi-button');
  if (gsi && cfg.googleClientId) Auth.renderButton(gsi, cfg.googleClientId).catch((e) => toast(e.message, 'error'));
}

async function testConnection(form) {
  const f = new FormData(form);
  const api = createRemoteApi({ url: f.get('apiUrl'), apiKey: f.get('apiKey'), getIdToken: f.get('googleClientId') ? Auth.getIdToken : null });
  try {
    const r = await api.ping();
    toast(`🟢 Conectado! Planilha: ${r.sheetName || 'ok'}`);
    return true;
  } catch (err) {
    toast(`🔴 ${err instanceof RemoteError ? err.message : 'Falha na conexão'}`, 'error', 4000);
    return false;
  }
}

// ---------------- Eventos (delegação) ----------------
function wireEvents() {
  window.addEventListener('hashchange', () => { closeAllSheets(); render(); });

  document.addEventListener('click', async (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) { e.preventDefault(); navigate(nav.dataset.nav, { period: nav.dataset.period }); return; }

    const el = e.target.closest('[data-action], [data-filter]');
    if (!el) return;

    if (el.dataset.filter) {
      ui.filters = { ...ui.filters, [el.dataset.filter]: el.dataset.value };
      render();
      return;
    }

    const id = el.dataset.id;
    switch (el.dataset.action) {
      case 'register': openRegister(el.dataset.type); break;
      case 'tx-open': openTransaction(id); break;
      case 'goal-new': openGoalForm(); break;
      case 'goal-open': if (!e.target.closest('[data-action="goal-deposit"]')) openGoal(id); break;
      case 'goal-deposit': e.stopPropagation(); openGoalMoney(id, 1); break;
      case 'analise-period': ui.analisePeriod = el.dataset.value; render(); break;
      case 'cat-tab': ui.catTab = el.dataset.value; render(); break;
      case 'cat-new': openNewCategory(el.dataset.tipo); break;
      case 'sync-now':
        try { const r = await DataService.sync(); if (r?.ok) toast('🟢 Tudo sincronizado'); }
        catch (err) { toast(err.message, 'error', 4000); }
        break;
      case 'cfg-test': await testConnection(el.closest('form')); break;
      case 'cfg-clear':
        if (await confirmDialog('Desconectar a planilha? Os dados continuam neste aparelho.', { ok: 'Desconectar' })) {
          DataService.setConfig({ apiUrl: '', apiKey: '', googleClientId: '' }); Auth.signOut(); render(); toast('Planilha desconectada');
        }
        break;
      case 'auth-signout': Auth.signOut(); render(); break;
      case 'data-export': downloadBackup(); break;
      case 'data-demo':
        if (await confirmDialog('Trocar seus dados pelos de demonstração neste aparelho? Baixe um backup antes, se precisar.', { ok: 'Ver demonstração', emoji: '🧪' })) {
          DataService.loadDemo(); toast('🧪 Dados de demonstração carregados'); navigate('inicio');
        }
        break;
      case 'data-fresh':
        if (await confirmDialog('Apagar os dados de demonstração e começar do zero?', { ok: 'Começar 🚀', emoji: '✨' })) {
          DataService.startFresh(); toast('✨ Tudo pronto! Registre sua primeira movimentação.'); navigate('inicio');
        }
        break;
      case 'data-reset':
        if (await confirmDialog('Apagar TODOS os dados deste aparelho? O que já está na planilha não é afetado.', { ok: 'Apagar', danger: true, emoji: '⚠️' })) {
          DataService.startFresh(); toast('Dados do aparelho apagados'); navigate('inicio');
        }
        break;
    }
  });

  // Teclado: cartões de meta são role=button
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-action]')) { e.preventDefault(); e.target.click(); }
  });

  document.addEventListener('input', (e) => {
    if (e.target.id === 'extrato-q') {
      ui.filters.q = e.target.value;
      $('#extrato-list').innerHTML = renderExtratoList(Store.get().data, ui.filters);
    }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.id === 'extrato-cat') { ui.filters.category = t.value; render(); }
    if (t.id === 'set-name') { DataService.setSettings({ name: t.value.trim() || 'Sabrina' }); toast('👋 Nome atualizado'); }
    if (t.dataset.action === 'cat-toggle') DataService.toggleCategory(t.dataset.id, t.checked);
    if (t.id === 'import-file' && t.files[0]) {
      try {
        const text = await t.files[0].text();
        if (await confirmDialog('Restaurar este backup? Os dados atuais do aparelho serão substituídos.', { ok: 'Restaurar' })) {
          DataService.importJSON(text); toast('✅ Backup restaurado');
        }
      } catch (err) { toast(err.message || 'Arquivo inválido', 'error'); }
      t.value = '';
    }
  });

  document.addEventListener('submit', async (e) => {
    if (e.target.id !== 'cfg-form') return;
    e.preventDefault();
    const f = new FormData(e.target);
    const url = String(f.get('apiUrl') || '').trim();
    if (url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)) { toast('A URL precisa ser do Google Apps Script (https://script.google.com/…)', 'error', 4000); return; }
    const wasDemo = DataService.isDemo();
    DataService.setConfig({ apiUrl: url, apiKey: String(f.get('apiKey') || '').trim(), googleClientId: String(f.get('googleClientId') || '').trim() });
    toast('💾 Conexão salva');
    if (url && wasDemo) DataService.startFresh(); // demonstração nunca vai para a planilha
    render();
    if (url) DataService.sync().then((r) => r?.ok && toast('🟢 Sincronizado com a planilha')).catch((err) => toast(err.message, 'error', 4000));
  });

  window.addEventListener('online', () => { renderChrome(); toast('🟢 Internet de volta! Sincronizando…'); });
  window.addEventListener('offline', () => { renderChrome(); toast('🔴 Sem internet — pode continuar usando, eu guardo tudo aqui.', 'warn', 3500); });
}

function downloadBackup() {
  const blob = new Blob([DataService.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sassa-bank-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('⬇️ Backup baixado');
}

// ---------------- PWA ----------------
function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker.register('./service-worker.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('✨ Nova versão do Sassa Bank! Feche e abra o app para atualizar.', 'success', 5000);
        }
      });
    });
  }).catch((err) => console.warn('SW não registrado', err));
}

let deferredInstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  const btn = $('#install-btn');
  if (btn) btn.hidden = false;
});

// ---------------- Boot ----------------
function boot() {
  try {
    DataService.init();
  } catch (err) {
    console.error(err);
    $('#view').innerHTML = `<div class="card"><p>😕 Não consegui abrir seus dados neste aparelho.</p><p class="muted small">${err.message}</p></div>`;
    return;
  }
  Store.subscribe((kind) => { if (kind === 'data') render(); else if (kind === 'sync') { renderChrome(); if (currentView() === 'ajustes' && !document.activeElement?.closest('#cfg-form')) render(); } });
  wireEvents();
  $('#fab').addEventListener('click', () => openRegister());
  $('#install-btn')?.addEventListener('click', async () => { if (!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $('#install-btn').hidden = true; });
  if (!location.hash) history.replaceState(null, '', '#/inicio');
  render();
  registerServiceWorker();
  DataService.sync({ quiet: true });
}

boot();
