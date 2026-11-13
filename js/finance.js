// Regras de negócio puras: cálculos de saldo, comprometido, metas e insights.
// Sem DOM e sem rede: fácil de testar e de reaproveitar.
import { today, monthKey, addMonths, startOfMonth, round2, sum, money } from './utils.js';

const signed = (t) => (t.type === 'receita' ? t.amount : -t.amount);

/**
 * Saldo atual           = entradas − saídas até hoje
 * Comprometido          = despesas com data futura (parcelas, agendadas)
 * Reservado para metas  = soma do que está guardado nas metas ativas
 * Livre para gastar     = saldo − comprometido − reservado
 */
export function summary(data, ref = today()) {
  const tx = data.transactions;
  const past = tx.filter((t) => t.date <= ref);
  const future = tx.filter((t) => t.date > ref);
  const month = monthKey(ref);
  const inMonth = past.filter((t) => monthKey(t.date) === month);

  const balance = round2(sum(past, signed));
  const committed = round2(sum(future.filter((t) => t.type === 'despesa'), (t) => t.amount));
  const reserved = round2(sum(data.goals.filter((g) => g.status !== 'arquivada'), (g) => g.saved));
  const monthIncome = round2(sum(inMonth.filter((t) => t.type === 'receita'), (t) => t.amount));
  const monthExpense = round2(sum(inMonth.filter((t) => t.type === 'despesa'), (t) => t.amount));
  return { balance, committed, reserved, free: round2(balance - committed - reserved), monthIncome, monthExpense };
}

/** Totais por mês para os últimos `n` meses (inclui o atual). */
export function monthlySeries(data, n = 6, ref = today()) {
  const start = startOfMonth(addMonths(ref, -(n - 1)));
  const months = Array.from({ length: n }, (_, i) => monthKey(addMonths(start, i)));
  let running = round2(sum(data.transactions.filter((t) => t.date < start), signed));
  return months.map((m) => {
    const list = data.transactions.filter((t) => monthKey(t.date) === m && t.date <= ref);
    const income = round2(sum(list.filter((t) => t.type === 'receita'), (t) => t.amount));
    const expense = round2(sum(list.filter((t) => t.type === 'despesa'), (t) => t.amount));
    running = round2(running + income - expense);
    return { month: m, income, expense, balance: running };
  });
}

/** Próximos compromissos agrupados por mês (parcelas e despesas futuras). */
export function upcomingByMonth(data, months = 6, ref = today()) {
  const future = data.transactions.filter((t) => t.type === 'despesa' && t.date > ref);
  const end = monthKey(addMonths(ref, months));
  const map = new Map();
  future.forEach((t) => {
    const m = monthKey(t.date);
    if (m > end) return;
    map.set(m, round2((map.get(m) || 0) + t.amount));
  });
  return [...map.entries()].sort().map(([month, total]) => ({ month, total }));
}

export function upcoming(data, limit = 4, ref = today()) {
  return data.transactions
    .filter((t) => t.type === 'despesa' && t.date > ref)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit);
}

export function recent(data, limit = 5, ref = today()) {
  return data.transactions
    .filter((t) => t.date <= ref)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

/** Período da Análise: 'mes' | '3m' | '6m' | 'ano'. */
export function periodRange(period, ref = today()) {
  const months = { mes: 1, '3m': 3, '6m': 6, ano: 12 }[period] || 1;
  return { from: startOfMonth(addMonths(ref, -(months - 1))), to: ref, months };
}

export function periodStats(data, period, ref = today()) {
  const { from, to, months } = periodRange(period, ref);
  const list = data.transactions.filter((t) => t.date >= from && t.date <= to);
  const income = round2(sum(list.filter((t) => t.type === 'receita'), (t) => t.amount));
  const expense = round2(sum(list.filter((t) => t.type === 'despesa'), (t) => t.amount));
  const saved = round2(income - expense);
  const pct = income > 0 ? Math.round((saved / income) * 100) : 0;
  return { from, to, months, income, expense, saved, pct, list };
}

export function byCategory(list, categories, type = 'despesa') {
  const map = new Map();
  list.filter((t) => t.type === type).forEach((t) => map.set(t.category, round2((map.get(t.category) || 0) + t.amount)));
  const total = sum([...map.values()]);
  return [...map.entries()]
    .map(([id, value]) => {
      const c = categories.find((x) => x.id === id) || { id, nome: 'Outros', emoji: '📦', cor: '#9A8FA6' };
      return { ...c, value, pct: total ? Math.round((value / total) * 100) : 0 };
    })
    .sort((a, b) => b.value - a.value);
}

/** Pequenas frases educativas, sempre positivas e sem julgamento. */
export function insights(data, period = 'mes', ref = today()) {
  const out = [];
  const s = periodStats(data, period, ref);
  const cats = byCategory(s.list, data.categories);
  const label = period === 'mes' ? 'este mês' : 'neste período';

  if (s.income === 0 && s.expense === 0) {
    out.push({ emoji: '🌱', text: 'Registre sua primeira movimentação para ver dicas aqui.' });
    return out;
  }
  if (s.pct >= 20) out.push({ emoji: '🎉', text: `Parabéns! Você guardou ${s.pct}% do que recebeu ${label}.`, tone: 'good' });
  else if (s.pct > 0) out.push({ emoji: '👏', text: `Você guardou ${s.pct}% do que recebeu. Que tal tentar chegar a 20%?`, tone: 'good' });
  else if (s.income > 0) out.push({ emoji: '🧭', text: `Você usou tudo o que recebeu ${label}. Guardar um pouquinho já faz diferença!`, tone: 'tip' });

  if (cats[0]) out.push({ emoji: cats[0].emoji, text: `Seu maior gasto ${label} foi com ${cats[0].nome.toLowerCase()} (${cats[0].pct}%).`, tone: 'info' });

  if (period === 'mes') {
    const prev = periodStats(data, 'mes', addMonths(startOfMonth(ref), -1).replace(/-\d{2}$/, '-28'));
    const prevCats = byCategory(prev.list, data.categories);
    const top = cats[0];
    const before = top && prevCats.find((c) => c.id === top.id);
    if (top && before && top.value > before.value * 1.3) {
      out.push({ emoji: '🔎', text: `Você gastou mais com ${top.nome.toLowerCase()} do que no mês passado.`, tone: 'tip' });
    } else if (prev.expense > 0 && s.expense < prev.expense) {
      out.push({ emoji: '📉', text: `Seus gastos estão ${money(prev.expense - s.expense)} menores que no mês passado.`, tone: 'good' });
    }
  }

  const committed = summary(data, ref).committed;
  if (committed > 0) out.push({ emoji: '🗓️', text: `Você já tem ${money(committed)} reservados para parcelas futuras.`, tone: 'info' });

  const nearGoal = data.goals.filter((g) => g.status === 'ativa' && g.target > 0).map((g) => ({ g, p: g.saved / g.target })).sort((a, b) => b.p - a.p)[0];
  if (nearGoal && nearGoal.p >= 0.5) out.push({ emoji: nearGoal.g.emoji, text: `Falta só ${money(nearGoal.g.target - nearGoal.g.saved)} para ${nearGoal.g.name}!`, tone: 'good' });
  return out.slice(0, 4);
}

export const goalProgress = (g) => (g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0);

/** Quanto guardar por mês para atingir a meta na data desejada. */
export function goalMonthly(g, ref = today()) {
  if (!g.targetDate || g.saved >= g.target) return null;
  const [y1, m1] = ref.split('-').map(Number);
  const [y2, m2] = g.targetDate.split('-').map(Number);
  const months = Math.max(1, (y2 - y1) * 12 + (m2 - m1));
  return round2((g.target - g.saved) / months);
}
