// Minhas metas 🎯
import { goalProgress, goalMonthly } from '../../finance.js';
import { money, escapeHtml, shortDate, sum } from '../../utils.js';
import { emptyState, progressBar } from '../components.js';

export function goalCard(g) {
  const pct = goalProgress(g);
  const monthly = goalMonthly(g);
  const done = g.status === 'concluida';
  return `
    <article class="goal ${done ? 'done' : ''}" data-action="goal-open" data-id="${g.id}" tabindex="0" role="button" aria-label="Meta ${escapeHtml(g.name)}, ${pct}%">
      <div class="goal-top">
        <span class="goal-emoji">${g.emoji}</span>
        <div class="goal-name"><strong>${escapeHtml(g.name)}</strong><span>${money(g.target)}</span></div>
        <span class="goal-pct">${done ? '🏆' : `${pct}%`}</span>
      </div>
      ${progressBar(pct, done ? 'var(--income)' : 'linear-gradient(90deg,var(--brand),var(--brand-2))')}
      <div class="goal-bottom">
        <span><strong>${money(g.saved)}</strong> guardados</span>
        ${done ? '<span class="tag tag-good">Conquistada!</span>' : g.targetDate ? `<span class="muted">até ${shortDate(g.targetDate)}</span>` : ''}
      </div>
      ${monthly ? `<p class="goal-tip">Guardando ${money(monthly)} por mês você chega lá 🚀</p>` : ''}
      ${done ? '' : `<button class="btn btn-soft btn-sm" data-action="goal-deposit" data-id="${g.id}">+ Guardar</button>`}
    </article>`;
}

export function renderMetas(state) {
  const goals = [...state.data.goals].sort((a, b) => (a.status === 'concluida') - (b.status === 'concluida') || b.createdAt.localeCompare(a.createdAt));
  const total = sum(goals, (g) => g.saved);
  return `
  <div class="view view-metas">
    <header class="page-head">
      <h1>Minhas metas 🎯</h1>
      <button class="btn btn-primary btn-sm" data-action="goal-new">+ Nova meta</button>
    </header>
    ${goals.length ? `<p class="lead">Você já guardou <strong>${money(total)}</strong> para seus sonhos.</p>` : ''}
    <div class="goals">
      ${goals.length ? goals.map(goalCard).join('') : `<div class="card">${emptyState('🌟', 'Qual é o seu próximo sonho?', 'Crie uma meta e acompanhe cada real guardado.')}<button class="btn btn-primary btn-block" data-action="goal-new">Criar minha primeira meta</button></div>`}
    </div>
  </div>`;
}
