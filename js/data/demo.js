// Dados fictícios para testar a experiência enquanto o backend não está configurado.
// Gerados relativos à data de hoje para os gráficos sempre fazerem sentido.
import { uid, today, addMonths, startOfMonth, splitInstallments } from '../utils.js';

export function buildDemoData(base) {
  const now = new Date().toISOString();
  const thisMonth = startOfMonth(today());
  const tx = [];
  const add = (monthOffset, day, type, category, description, amount, extra = {}) => {
    const m = addMonths(thisMonth, monthOffset);
    const date = `${m.slice(0, 8)}${String(day).padStart(2, '0')}`;
    if (date > today() && !extra.future) return;
    tx.push({ id: uid('tx_'), date, type, category, description, amount, payment: extra.payment || '', installment: '', installments: '', purchaseId: '', purchaseTotal: '', createdAt: now, updatedAt: now });
  };

  // Histórico dos últimos 5 meses
  const history = [
    [-5, [['presente-r', 'Aniversário — vó', 400]], [['refeicao', 'Lanche com as amigas', 38], ['lazer', 'Cinema', 42], ['compra', 'Camiseta', 69]]],
    [-4, [['venda', 'Vendi livros usados', 85]], [['refeicao', 'Sorvete', 18], ['escola', 'Material de arte', 54], ['assinatura', 'Streaming de música', 12]]],
    [-3, [['trabalho', 'Ajudei na loja da tia', 150]], [['refeicao', 'Pizza', 46], ['transporte', 'Uber', 23], ['presente-d', 'Presente da Júlia', 60], ['assinatura', 'Streaming de música', 12]]],
    [-2, [], [['refeicao', 'Açaí', 22], ['lazer', 'Boliche', 55], ['compra', 'Capinha do celular', 39], ['assinatura', 'Streaming de música', 12]]],
    [-1, [['presente-r', 'Dinda', 100]], [['refeicao', 'Hambúrguer', 41], ['lazer', 'Show', 90], ['transporte', 'Ônibus', 20], ['assinatura', 'Streaming de música', 12]]],
  ];
  for (const [off, incomes, expenses] of history) {
    add(off, 5, 'receita', 'mesada', 'Mesada', 300, { payment: 'pix' });
    incomes.forEach(([c, d, v], i) => add(off, 12 + i * 5, 'receita', c, d, v, { payment: 'pix' }));
    expenses.forEach(([c, d, v], i) => add(off, 7 + i * 5, 'despesa', c, d, v, { payment: 'pix' }));
  }

  // Mês atual (exemplo pedido: mesada 300; refeição 45, lazer 60, compra 120)
  add(0, 1, 'receita', 'mesada', 'Mesada', 300, { payment: 'pix' });
  add(0, 1, 'despesa', 'refeicao', 'Lanche depois da aula', 45, { payment: 'debito' });
  add(0, 1, 'despesa', 'lazer', 'Parque com a turma', 60, { payment: 'pix' });
  add(0, 1, 'despesa', 'compra', 'Tênis (entrada)', 120, { payment: 'debito' });

  // Compra parcelada: fone de R$ 600 em 12x, começou há 2 meses → parcela 3/12 neste mês
  const purchaseId = uid('cp_');
  const start = `${addMonths(thisMonth, -2).slice(0, 8)}01`;
  splitInstallments(600, 12).forEach((v, i) => {
    tx.push({ id: uid('tx_'), date: addMonths(start, i), type: 'despesa', category: 'compra', description: 'Fone de ouvido', amount: v, payment: 'credito', installment: i + 1, installments: 12, purchaseId, purchaseTotal: 600, createdAt: now, updatedAt: now });
  });

  const goals = [
    { id: uid('mt_'), name: 'Viagem', emoji: '✈️', target: 2000, saved: 750, targetDate: addMonths(today(), 8), status: 'ativa', createdAt: now, updatedAt: now },
    { id: uid('mt_'), name: 'Bicicleta', emoji: '🚲', target: 2500, saved: 120, targetDate: '', status: 'ativa', createdAt: now, updatedAt: now },
  ];

  return { ...base, transactions: tx, goals, meta: { ...base.meta, demo: true } };
}
