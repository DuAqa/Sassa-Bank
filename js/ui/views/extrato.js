// Extrato com filtros: período, entrada/saída, categoria e busca.
import { today, startOfMonth, addMonths, endOfMonth, friendlyDate, normalize, money, escapeHtml, sum, round2 } from '../../utils.js';
import { emptyState } from '../components.js';
import { txRow } from './shared.js';

export const PERIODS = [
  { id: 'mes', label: 'Este mês' },
  { id: 'passado', label: 'Mês passado' },
  { id: '3m', label: '3 meses' },
  { id: 'ano', label: '12 meses' },
  { id: 'tudo', label: 'Tudo' },
  { id: 'futuro', label: '🗓️ Futuras' },
];

export const defaultFilters = () => ({ period: 'mes', kind: 'todos', category: '', q: '' });

function range(period) {
  const t = today();
  switch (period) {
    case 'passado': { const m = addMonths(startOfMonth(t), -1); return [m, endOfMonth(m)]; }
    case '3m': return [startOfMonth(addMonths(t, -2)), t];
    case 'ano': return [startOfMonth(addMonths(t, -11)), t];
    case 'tudo': return ['0000-01-01', '9999-12-31'];
    case 'futuro': return [t, '9999-12-31']; // filtrado como "data > hoje" abaixo
    default: return [startOfMonth(t), t];
  }
}

export function filterTransactions(data, f) {
  const [from, to] = range(f.period);
  const q = normalize(f.q);
  return data.transactions
    .filter((t) => (f.period === 'futuro' ? t.date > today() : t.date >= from && t.date <= to))
    .filter((t) => f.kind === 'todos' || (f.kind === 'entradas' ? t.type === 'receita' : t.type === 'despesa'))
    .filter((t) => !f.category || t.category === f.category)
    .filter((t) => !q || normalize(`${t.description} ${(data.categories.find((c) => c.id === t.category) || {}).nome || ''}`).includes(q))
    .sort((a, b) => (f.period === 'futuro' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) || b.createdAt.localeCompare(a.createdAt));
}

export function renderExtratoList(data, f) {
  const list = filterTransactions(data, f);
  if (!list.length) {
    return f.period === 'futuro'
      ? emptyState('✅', 'Nada agendado', 'Compras parceladas aparecem aqui.')
      : emptyState('🔍', 'Nenhuma movimentação', 'Tente outro período ou filtro.');
  }
  const income = round2(sum(list.filter((t) => t.type === 'receita'), (t) => t.amount));
  const expense = round2(sum(list.filter((t) => t.type === 'despesa'), (t) => t.amount));
  const groups = new Map();
  list.forEach((t) => { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); });
  const future = f.period === 'futuro';
  return `
    <div class="totals">
      ${future ? '' : `<span class="in">+ ${money(income)}</span>`}
      <span class="out">− ${money(expense)}</span>
      <span class="muted">${list.length} ${list.length === 1 ? 'item' : 'itens'}</span>
    </div>
    ${[...groups.entries()].map(([date, items]) => `
      <div class="day">
        <h3 class="day-title">${friendlyDate(date)}</h3>
        <div class="tx-list">${items.map((t) => txRow(t, data.categories, { future })).join('')}</div>
      </div>`).join('')}`;
}

export function renderExtrato(state, f) {
  const { data } = state;
  const cats = data.categories.filter((c) => c.ativa || data.transactions.some((t) => t.category === c.id));
  return `
  <div class="view view-extrato">
    <header class="page-head"><h1>Extrato</h1></header>
    <div class="filters">
      <label class="search">
        <span aria-hidden="true">🔎</span>
        <input id="extrato-q" type="search" placeholder="Buscar (ex.: lanche)" value="${escapeHtml(f.q)}" autocomplete="off" aria-label="Buscar por descrição" />
      </label>
      <div class="chips scroll-x" role="group" aria-label="Período">
        ${PERIODS.map((p) => `<button class="chip ${f.period === p.id ? 'on' : ''}" data-filter="period" data-value="${p.id}">${p.label}</button>`).join('')}
      </div>
      <div class="filter-row">
        <div class="seg" role="group" aria-label="Tipo">
          ${[['todos', 'Tudo'], ['entradas', 'Entradas'], ['saidas', 'Saídas']].map(([v, l]) => `<button class="${f.kind === v ? 'on' : ''}" data-filter="kind" data-value="${v}">${l}</button>`).join('')}
        </div>
        <select id="extrato-cat" class="select" aria-label="Categoria">
          <option value="">Todas categorias</option>
          ${['despesa', 'receita'].map((tipo) => `<optgroup label="${tipo === 'despesa' ? 'Gastos' : 'Entradas'}">${cats.filter((c) => c.tipo === tipo).map((c) => `<option value="${c.id}" ${f.category === c.id ? 'selected' : ''}>${c.emoji} ${escapeHtml(c.nome)}</option>`).join('')}</optgroup>`).join('')}
        </select>
      </div>
    </div>
    <div id="extrato-list" class="card card-flat">${renderExtratoList(data, f)}</div>
  </div>`;
}
