import { escapeHtml, money, shortDate } from '../../utils.js';

export function categoryOf(categories, id) {
  return categories.find((c) => c.id === id) || { id, nome: 'Outros', emoji: '📦', cor: '#9A8FA6' };
}

export function txRow(t, categories, { showDate = false, future = false } = {}) {
  const c = categoryOf(categories, t.category);
  const title = t.description || c.nome;
  const parcel = t.installments ? `<span class="tag">Parcela ${t.installment}/${t.installments}</span>` : '';
  const sub = [showDate ? shortDate(t.date) : '', c.nome].filter(Boolean).join(' · ');
  return `
    <button class="tx ${t.type} ${future ? 'tx-future' : ''}" data-action="tx-open" data-id="${t.id}">
      <span class="tx-icon" style="--c:${c.cor}">${c.emoji}</span>
      <span class="tx-main">
        <span class="tx-title">${escapeHtml(title)}</span>
        <span class="tx-sub">${escapeHtml(sub)} ${parcel}</span>
      </span>
      <span class="tx-amount">${t.type === 'receita' ? '+' : '−'} ${money(t.amount)}</span>
    </button>`;
}

export function sectionHead(title, action = '') {
  return `<div class="section-head"><h2>${title}</h2>${action}</div>`;
}
