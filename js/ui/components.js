// Componentes visuais reutilizáveis: bottom sheet, toast, confirmação, campo de valor.
import { escapeHtml, money } from '../utils.js';

// ---------------- Toast ----------------
export function toast(message, type = 'success', ms = 2600) {
  const host = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `<span>${escapeHtml(message)}</span>`;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, ms);
}

// ---------------- Bottom sheet ----------------
let sheetStack = [];

export function openSheet(html, { onMount, label = 'Painel', className = '' } = {}) {
  const host = document.getElementById('sheets');
  const wrap = document.createElement('div');
  wrap.className = 'sheet-wrap';
  wrap.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <section class="sheet ${className}" tabindex="-1" role="dialog" aria-modal="true" aria-label="${escapeHtml(label)}">
      <div class="sheet-handle" data-close aria-hidden="true"></div>
      <button class="sheet-x" data-close aria-label="Fechar">✕</button>
      <div class="sheet-body">${html}</div>
    </section>`;
  host.appendChild(wrap);
  document.body.classList.add('no-scroll');
  const prevFocus = document.activeElement;
  const close = () => {
    wrap.classList.remove('open');
    sheetStack = sheetStack.filter((s) => s !== close);
    if (!sheetStack.length) document.body.classList.remove('no-scroll');
    setTimeout(() => wrap.remove(), 260);
    prevFocus?.focus?.({ preventScroll: true });
  };
  wrap.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
  sheetStack.push(close);
  requestAnimationFrame(() => wrap.classList.add('open'));
  const body = wrap.querySelector('.sheet-body');
  wrap.querySelector('.sheet').focus({ preventScroll: true });
  onMount?.(body, close);
  return { close, body };
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sheetStack.length) sheetStack[sheetStack.length - 1](); });

export const closeAllSheets = () => [...sheetStack].forEach((c) => c());

// ---------------- Confirmação ----------------
export function confirmDialog(text, { ok = 'Confirmar', cancel = 'Cancelar', danger = false, emoji = '🤔' } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    const { close } = openSheet(`
      <div class="confirm">
        <div class="confirm-emoji">${emoji}</div>
        <p>${escapeHtml(text)}</p>
        <div class="btn-row">
          <button class="btn btn-ghost" data-ans="0">${escapeHtml(cancel)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-ans="1">${escapeHtml(ok)}</button>
        </div>
      </div>`, {
      label: 'Confirmação',
      className: 'sheet-small',
      onMount: (body, closeFn) => {
        body.addEventListener('click', (e) => {
          const b = e.target.closest('[data-ans]');
          if (!b) return;
          answered = true;
          resolve(b.dataset.ans === '1');
          closeFn();
        });
      },
    });
    // se fechar pelo X/fundo, conta como "não"
    const obs = new MutationObserver(() => { if (!answered && !document.querySelector('.confirm')) { resolve(false); obs.disconnect(); } });
    obs.observe(document.getElementById('sheets'), { childList: true });
    void close;
  });
}

// ---------------- Campo de valor (digitação em centavos, estilo app de banco) ----------------
export function moneyField({ id = 'amount', value = 0, label = 'Valor', autofocus = true } = {}) {
  const cents = Math.round((value || 0) * 100);
  return `
    <label class="money-field" for="${id}">
      <span class="money-label">${escapeHtml(label)}</span>
      <span class="money-input-wrap">
        <span class="money-prefix">R$</span>
        <input id="${id}" class="money-input" inputmode="numeric" autocomplete="off" enterkeyhint="done"
          value="${cents ? formatCents(cents) : ''}" placeholder="0,00" data-cents="${cents}" ${autofocus ? 'data-autofocus' : ''} />
      </span>
    </label>`;
}

export function formatCents(cents) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Liga o comportamento de máscara; retorna getter do valor em reais. */
export function bindMoneyField(input, onChange) {
  const update = () => {
    const digits = input.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
    const cents = Number(digits || 0);
    input.dataset.cents = String(cents);
    input.value = cents ? formatCents(cents) : '';
    onChange?.(cents / 100);
  };
  input.addEventListener('input', update);
  if (input.hasAttribute('data-autofocus')) setTimeout(() => input.focus({ preventScroll: true }), 280);
  return () => Number(input.dataset.cents || 0) / 100;
}

// ---------------- Pequenas peças ----------------
export function emptyState(emoji, title, text = '') {
  return `<div class="empty"><div class="empty-emoji">${emoji}</div><strong>${escapeHtml(title)}</strong>${text ? `<p>${escapeHtml(text)}</p>` : ''}</div>`;
}

export function progressBar(pct, color = 'var(--brand)') {
  return `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="progress-fill" style="--w:${pct}%;background:${color}"></div></div>`;
}

export function celebrate() {
  const host = document.createElement('div');
  host.className = 'confetti';
  const emojis = ['🎉', '✨', '💖', '⭐', '🪙'];
  host.innerHTML = Array.from({ length: 18 }, (_, i) => `<span style="--x:${Math.random() * 100}vw;--d:${0.6 + Math.random() * 0.8}s;--r:${Math.random() * 360}deg;animation-delay:${i * 0.03}s">${emojis[i % emojis.length]}</span>`).join('');
  document.body.appendChild(host);
  setTimeout(() => host.remove(), 2200);
}

export const amountSigned = (t) => `${t.type === 'receita' ? '+' : '−'} ${money(t.amount)}`;
