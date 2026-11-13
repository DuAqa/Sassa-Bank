// Análise: educação financeira pela experiência — números simples, gráficos e dicas.
import { periodStats, byCategory, insights, monthlySeries, upcomingByMonth } from '../../finance.js';
import { money, escapeHtml, monthLabel } from '../../utils.js';
import { incomeExpenseBars, compareBars, ring } from '../charts.js';
import { emptyState, progressBar } from '../components.js';
import { sectionHead } from './shared.js';

export const ANALISE_PERIODS = [['mes', 'Mês'], ['3m', '3 meses'], ['6m', '6 meses'], ['ano', 'Ano']];

export function renderAnalise(state, period = 'mes') {
  const { data } = state;
  const s = periodStats(data, period);
  const cats = byCategory(s.list, data.categories);
  const tips = insights(data, period);
  const series = monthlySeries(data, s.months);
  const future = upcomingByMonth(data, 6);
  const maxFuture = Math.max(1, ...future.map((f) => f.total));
  const title = period === 'mes' ? 'Este mês' : `Últimos ${s.months} meses`;

  return `
  <div class="view view-analise">
    <header class="page-head"><h1>Análise</h1></header>
    <div class="seg seg-wide" role="group" aria-label="Período">
      ${ANALISE_PERIODS.map(([v, l]) => `<button class="${period === v ? 'on' : ''}" data-action="analise-period" data-value="${v}">${l}</button>`).join('')}
    </div>

    <div class="analise-grid">
      <section class="card stats-card">
        <h2 class="card-title">${title}</h2>
        <div class="stats">
          <div class="stat"><span>Recebi</span><strong class="in">${money(s.income)}</strong></div>
          <div class="stat"><span>Gastei</span><strong class="out">${money(s.expense)}</strong></div>
          <div class="stat"><span>${s.saved >= 0 ? 'Economizei' : 'Usei a mais'}</span><strong>${money(Math.abs(s.saved))}</strong></div>
        </div>
        <div class="saved-ring">
          ${ring(s.pct, { color: s.pct >= 0 ? 'var(--income)' : 'var(--expense)' })}
          <div><strong class="ring-pct">${s.pct}%</strong><span>do que recebi ficou comigo</span></div>
        </div>
      </section>

      <section class="card">
        ${sectionHead('Recebi x Gastei')}
        ${s.months <= 1 ? compareBars(s.income, s.expense) : incomeExpenseBars(series)}
      </section>

      ${tips.length ? `<section class="card insights">
        ${sectionHead('Dicas da Sassa ✨')}
        ${tips.map((t) => `<div class="insight ${t.tone || ''}"><span>${t.emoji}</span><p>${escapeHtml(t.text)}</p></div>`).join('')}
      </section>` : ''}

      <section class="card">
        ${sectionHead('Para onde foi meu dinheiro')}
        ${cats.length ? `<div class="cats">${cats.map((c) => `
          <div class="cat-row">
            <span class="cat-emoji" style="--c:${c.cor}">${c.emoji}</span>
            <div class="cat-main">
              <div class="cat-top"><span>${escapeHtml(c.nome)}</span><strong>${money(c.value)}</strong></div>
              ${progressBar(c.pct, c.cor)}
            </div>
            <span class="cat-pct">${c.pct}%</span>
          </div>`).join('')}</div>` : emptyState('🧘', 'Nenhum gasto no período')}
      </section>

      <section class="card">
        ${sectionHead('Parcelas nos próximos meses')}
        ${future.length ? `<div class="future-bars">${future.map((f) => `
          <div class="fb"><div class="fb-bar" style="--h:${(f.total / maxFuture) * 100}%"><span>${money(f.total)}</span></div><em>${monthLabel(f.month)}</em></div>`).join('')}</div>
          <p class="muted small center">Esse dinheiro já tem destino 🗓️</p>` : emptyState('🕊️', 'Nada comprometido', 'Sem parcelas pela frente.')}
      </section>
    </div>
  </div>`;
}
