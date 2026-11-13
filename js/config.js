// Sassa Bank — configuração estática do app.
// Nada aqui é segredo: a URL do backend e a chave são configuradas pela tela Ajustes
// e ficam somente no aparelho (localStorage).

export const APP = {
  name: 'Sassa Bank',
  version: '1.0.0',
  defaultUserName: 'Sabrina',
  syncIntervalMs: 60_000,
  requestTimeoutMs: 20_000,
  maxInstallments: 24,
};

export const STORAGE_KEYS = {
  data: 'sassa:data:v1',
  outbox: 'sassa:outbox:v1',
  config: 'sassa:config:v1',
  auth: 'sassa:auth:v1',
};

// Categorias iniciais. O "id" é estável e é o que vai para a planilha.
export const DEFAULT_CATEGORIES = [
  // Receitas
  { id: 'mesada',     tipo: 'receita', nome: 'Mesada',     emoji: '🪙', cor: '#14B37D' },
  { id: 'trabalho',   tipo: 'receita', nome: 'Trabalho',   emoji: '💼', cor: '#0EA5A4' },
  { id: 'presente-r', tipo: 'receita', nome: 'Presente',   emoji: '🎁', cor: '#22C3A6' },
  { id: 'venda',      tipo: 'receita', nome: 'Venda',      emoji: '🏷️', cor: '#3DBE8B' },
  { id: 'outros-r',   tipo: 'receita', nome: 'Outros',     emoji: '✨', cor: '#6CCB9F' },
  // Despesas
  { id: 'refeicao',   tipo: 'despesa', nome: 'Refeição',   emoji: '🍔', cor: '#F0643C' },
  { id: 'compra',     tipo: 'despesa', nome: 'Compra',     emoji: '🛍️', cor: '#E0457B' },
  { id: 'presente-d', tipo: 'despesa', nome: 'Presente',   emoji: '🎁', cor: '#B65BD6' },
  { id: 'lazer',      tipo: 'despesa', nome: 'Lazer',      emoji: '🎮', cor: '#5B6CF0' },
  { id: 'viagem',     tipo: 'despesa', nome: 'Viagem',     emoji: '✈️', cor: '#2F9BE0' },
  { id: 'transporte', tipo: 'despesa', nome: 'Transporte', emoji: '🚌', cor: '#F2A93B' },
  { id: 'escola',     tipo: 'despesa', nome: 'Escola',     emoji: '📚', cor: '#8E7CF0' },
  { id: 'assinatura', tipo: 'despesa', nome: 'Assinatura', emoji: '📺', cor: '#D9488F' },
  { id: 'outros-d',   tipo: 'despesa', nome: 'Outros',     emoji: '📦', cor: '#9A8FA6' },
].map((c, i) => ({ ...c, ativa: true, ordem: i }));

export const PAYMENT_METHODS = [
  { id: 'pix', nome: 'Pix', emoji: '⚡' },
  { id: 'dinheiro', nome: 'Dinheiro', emoji: '💵' },
  { id: 'debito', nome: 'Débito', emoji: '💳' },
  { id: 'credito', nome: 'Crédito', emoji: '💳' },
];

export const GOAL_EMOJIS = ['🎯', '📱', '✈️', '🚲', '🎁', '🛟', '🎧', '👟', '🎮', '📚', '🐶', '🎸'];
export const CATEGORY_EMOJIS = ['🍕', '☕', '🎬', '🎨', '💄', '👕', '🐾', '⚽', '🎵', '💡', '🧋', '💻', '🎤', '🌱', '🧸', '💰'];
