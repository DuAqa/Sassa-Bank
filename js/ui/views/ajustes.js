// Ajustes: perfil, sincronização, categorias, dados e sobre.
import { APP } from '../../config.js';
import { escapeHtml } from '../../utils.js';

export const SYNC_LABEL = {
  synced: { dot: '🟢', text: 'Sincronizado' },
  pending: { dot: '🟡', text: 'Sincronização pendente' },
  offline: { dot: '🔴', text: 'Offline' },
  error: { dot: '🔴', text: 'Erro ao sincronizar' },
  local: { dot: '⚪', text: 'Só neste aparelho' },
};

function lastSyncText(iso) {
  if (!iso) return 'Ainda não sincronizou';
  const d = new Date(iso);
  return `Última vez: ${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
}

export function renderAjustes(state, { cfg, catTab = 'despesa', auth }) {
  const { data, sync } = state;
  const st = SYNC_LABEL[sync.status] || SYNC_LABEL.local;
  const cats = data.categories.filter((c) => c.tipo === catTab).sort((a, b) => (b.ativa - a.ativa) || a.ordem - b.ordem);
  const demo = data.meta.demo;

  return `
  <div class="view view-ajustes">
    <header class="page-head"><h1>Ajustes</h1></header>
    <div class="settings-grid">

      <section class="card">
        <h2 class="card-title">👤 Perfil</h2>
        <label class="field"><span>Como devo te chamar?</span>
          <input id="set-name" class="input" value="${escapeHtml(data.settings.name || '')}" maxlength="20" autocomplete="given-name" />
        </label>
      </section>

      <section class="card" id="sync-card">
        <h2 class="card-title">🔄 Sincronização</h2>
        <div class="sync-status sync-${sync.status}">
          <span class="sync-dot">${st.dot}</span>
          <div><strong>${st.text}</strong><span>${sync.status === 'local' ? 'Os dados estão salvos neste aparelho.' : lastSyncText(sync.lastSync)}</span></div>
        </div>
        ${sync.pending ? `<p class="muted small">${sync.pending} ${sync.pending === 1 ? 'alteração esperando' : 'alterações esperando'} para enviar.</p>` : ''}
        ${sync.message ? `<p class="alert">${escapeHtml(sync.message)}</p>` : ''}
        ${sync.status !== 'local' ? `<button class="btn btn-soft btn-block" data-action="sync-now" ${sync.syncing ? 'disabled' : ''}>${sync.syncing ? 'Sincronizando…' : 'Sincronizar agora'}</button>` : ''}

        ${cfg.googleClientId ? `
          <div class="auth-box">
            ${auth && !auth.expired
              ? `<p>Conectada como <strong>${escapeHtml(auth.email)}</strong></p><button class="btn btn-ghost btn-sm" data-action="auth-signout">Sair</button>`
              : `<p class="muted small">Entre com sua conta Google para sincronizar.</p><div id="gsi-button"></div>`}
          </div>` : ''}

        <details class="details" ${!cfg.apiUrl && !demo ? 'open' : ''}>
          <summary>Conectar à planilha <span class="muted small">(para o responsável)</span></summary>
          <form id="cfg-form" class="stack">
            <label class="field"><span>URL do Apps Script (termina em /exec)</span>
              <input name="apiUrl" class="input" type="url" inputmode="url" placeholder="https://script.google.com/macros/s/…/exec" value="${escapeHtml(cfg.apiUrl || '')}" autocomplete="off" />
            </label>
            <label class="field"><span>Chave de acesso</span>
              <input name="apiKey" class="input" type="password" placeholder="Gerada pela função gerarChave()" value="${escapeHtml(cfg.apiKey || '')}" autocomplete="off" />
            </label>
            <label class="field"><span>Google Client ID <em class="muted">(opcional — V2.2)</em></span>
              <input name="googleClientId" class="input" placeholder="xxxx.apps.googleusercontent.com" value="${escapeHtml(cfg.googleClientId || '')}" autocomplete="off" />
            </label>
            <div class="btn-row">
              <button type="button" class="btn btn-ghost" data-action="cfg-test">Testar conexão</button>
              <button type="submit" class="btn btn-primary">Salvar</button>
            </div>
            ${cfg.apiUrl ? '<button type="button" class="link danger" data-action="cfg-clear">Desconectar planilha</button>' : ''}
          </form>
        </details>
      </section>

      <section class="card">
        <h2 class="card-title">🏷️ Categorias</h2>
        <div class="seg" role="group" aria-label="Tipo de categoria">
          <button class="${catTab === 'despesa' ? 'on' : ''}" data-action="cat-tab" data-value="despesa">💸 Gastos</button>
          <button class="${catTab === 'receita' ? 'on' : ''}" data-action="cat-tab" data-value="receita">💰 Entradas</button>
        </div>
        <ul class="cat-list">
          ${cats.map((c) => `
            <li class="${c.ativa ? '' : 'off'}">
              <span class="cat-emoji" style="--c:${c.cor}">${c.emoji}</span>
              <span>${escapeHtml(c.nome)}</span>
              <label class="switch" aria-label="${c.ativa ? 'Esconder' : 'Mostrar'} ${escapeHtml(c.nome)}">
                <input type="checkbox" data-action="cat-toggle" data-id="${c.id}" ${c.ativa ? 'checked' : ''}/><span></span>
              </label>
            </li>`).join('')}
        </ul>
        <button class="btn btn-soft btn-block" data-action="cat-new" data-tipo="${catTab}">+ Nova categoria</button>
      </section>

      <section class="card">
        <h2 class="card-title">🎯 Metas</h2>
        <p class="muted small">Crie, edite e acompanhe seus objetivos.</p>
        <button class="btn btn-soft btn-block" data-nav="metas">Abrir minhas metas</button>
      </section>

      <section class="card">
        <h2 class="card-title">💾 Dados</h2>
        <div class="stack">
          <button class="btn btn-ghost btn-block" data-action="data-export">⬇️ Baixar backup</button>
          <label class="btn btn-ghost btn-block file-btn">⬆️ Restaurar backup<input type="file" accept="application/json,.json" id="import-file" hidden /></label>
          ${demo
            ? '<button class="btn btn-primary btn-block" data-action="data-fresh">✨ Começar de verdade (apagar demonstração)</button>'
            : '<button class="btn btn-ghost btn-block" data-action="data-demo">🧪 Ver dados de demonstração</button>'}
          <button class="link danger" data-action="data-reset">Apagar tudo neste aparelho</button>
        </div>
      </section>

      <section class="card about">
        <h2 class="card-title">💖 Sobre</h2>
        <div class="about-logo"><img src="icons/icon.svg" alt="" width="48" height="48" /><div><strong>${APP.name}</strong><span>versão ${APP.version}</span></div></div>
        <p class="muted small">Feito especialmente para a ${escapeHtml(data.settings.name || 'Sabrina')}. Seus dados ficam na planilha da família, não em empresas de terceiros.</p>
      </section>
    </div>
  </div>`;
}
