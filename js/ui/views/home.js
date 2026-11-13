// Início: "Quanto eu tenho?" — a resposta principal é o "Livre para gastar".
import { summary, monthlySeries, recent, upcoming } from '../../finance.js';
import { money, escapeHtml, shortDate, monthLongLabel, monthKey, today } from '../../utils.js';
import { incomeExpenseBars, balanceLine } from '../charts.js';
import { emptyState } from '../components.js';
import { txRow, sectionHead, categoryOf } from './shared.js';

export function renderHome(state) {
  const { data } = state;
  const s = summary(data);
  const series = monthlySeries(data, 6);
  const last = recent(data, 5);
  const next = upcoming(data, 4);
  const name = escapeHtml(data.settings.name || 'você');
  const freeNegative = s.free < 0;

  return `
  <div class="view view-home">
    <header class="hello">
      <p class="hello-sub">${monthLongLabel(monthKey(today()))}</p>
      <h1>Olá, ${name} 👋</h1>
    </header>

    <div class="home-grid">
      <section class="hero card-hero" aria-labelledby="free-label">
        <p class="hero-q">Quanto eu tenho?</p>
        <p id="free-label" class="hero-label">Livre para gastar</p>
        <p class="hero-value ${freeNegative ? 'neg' : ''}" data-testid="free">${money(s.free)}</p>
        <div class="equation" aria-label="Como o valor livre é calculado">
          <div class="eq-item"><span>Saldo</span><strong>${money(s.balance)}</strong></div>
          <span class="eq-op">−</span>
          <div class="eq-item"><span>Parcelas</span><strong>${money(s.committed)}</strong></div>
          <span class="eq-op">−</span>
          <div class="eq-item"><span>Metas</span><strong>${money(s.reserved)}</strong></div>
        </div>
        ${freeNegative ? `<p class="hero-hint">Seus compromissos estão maiores que o saldo. Segura os gastos por um tempinho 💛</p>` : ''}
        <div class="hero-actions">
          <button class="quick quick-in" data-action="register" data-type="receita"><span>💰</span>Recebi</button>
          <button class="quick quick-out" data-action="register" data-type="despesa"><span>💸</span>Gastei</button>
        </div>
      </section>

      <div class="mini-grid">
        <div class="mini"><span class="mini-ico in">↓</span><span class="mini-label">Recebi no mês</span><strong>${money(s.monthIncome)}</strong></div>
        <div class="mini"><span class="mini-ico out">↑</span><span class="mini-label">Gastei no mês</span><strong>${money(s.monthExpense)}</strong></div>
        <button class="mini" data-nav="extrato" data-period="futuro"><span class="mini-ico lock">🗓️</span><span class="mini-label">Comprometido</span><strong>${money(s.committed)}</strong></button>
        <button class="mini" data-nav="metas"><span class="mini-ico goal">🎯</span><span class="mini-label">Guardado em metas</span><strong>${money(s.reserved)}</strong></button>
      </div>

      <section class="card">
        ${sectionHead('Recebi x Gastei')}
        ${incomeExpenseBars(series)}
      </section>

      <section class="card">
        ${sectionHead('Minha evolução', '<span class="muted small">saldo no fim de cada mês</span>')}
        ${balanceLine(series)}
      </section>

      <section class="card">
        ${sectionHead('Últimas movimentações', '<button class="link" data-nav="extrato">Ver tudo</button>')}
        <div class="tx-list">${last.length ? last.map((t) => txRow(t, data.categories, { showDate: true })).join('') : emptyState('🪴', 'Nada por aqui ainda', 'Toque em Registrar para começar.')}</div>
      </section>

      <section class="card">
        ${sectionHead('Próximas parcelas', next.length ? '<button class="link" data-nav="extrato" data-period="futuro">Ver todas</button>' : '')}
        ${next.length ? `<div class="upcoming">${next.map((t) => {
          const c = categoryOf(data.categories, t.category);
          return `<button class="up" data-action="tx-open" data-id="${t.id}">
            <span class="up-date">${shortDate(t.date)}</span>
            <span class="up-name">${c.emoji} ${escapeHtml(t.description || c.nome)}${t.installments ? ` <em>${t.installment}/${t.installments}</em>` : ''}</span>
            <strong>${money(t.amount)}</strong></button>`;
        }).join('')}</div>` : emptyState('✅', 'Nenhuma parcela pela frente', 'Seu dinheiro está todo livre.')}
      </section>
    </div>
  </div>`;
}
