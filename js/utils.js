// Utilitários puros (sem DOM, sem rede).

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const BRL_SHORT = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

export const money = (v) => BRL.format(round2(v || 0));
export const moneyShort = (v) => {
  const n = Math.abs(v || 0);
  const s = n >= 10000 ? `${BRL_SHORT.format(Math.round(n / 100) / 10)} mil` : BRL_SHORT.format(Math.round(n));
  return `${v < 0 ? '−' : ''}R$ ${s}`;
};
export const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
export const toCents = (v) => Math.round(Number(v) * 100);
export const fromCents = (c) => c / 100;

export function uid(prefix = '') {
  const rnd = crypto.getRandomValues(new Uint32Array(2));
  return `${prefix}${Date.now().toString(36)}${rnd[0].toString(36)}${rnd[1].toString(36)}`.slice(0, 28);
}

// ---------- Datas (sempre "YYYY-MM-DD" no fuso local; evita surpresas com UTC) ----------
export const pad = (n) => String(n).padStart(2, '0');
export const toISODate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());
export function parseISODate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
export function addMonths(iso, n) {
  const d = parseISODate(iso);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISODate(target);
}
export const addDays = (iso, n) => { const d = parseISODate(iso); d.setDate(d.getDate() + n); return toISODate(d); };
export const monthKey = (iso) => String(iso).slice(0, 7);
export const startOfMonth = (iso) => `${monthKey(iso)}-01`;
export const endOfMonth = (iso) => { const d = parseISODate(startOfMonth(iso)); return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); };
export const isValidISODate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseISODate(s));

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export const monthLabel = (key) => MONTHS[Number(key.slice(5, 7)) - 1];
export const monthLongLabel = (key) => `${MONTHS_LONG[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
export function friendlyDate(iso) {
  const t = today();
  if (iso === t) return 'Hoje';
  if (iso === addDays(t, -1)) return 'Ontem';
  if (iso === addDays(t, 1)) return 'Amanhã';
  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}
export const shortDate = (iso) => { const d = parseISODate(iso); return `${pad(d.getDate())} ${MONTHS[d.getMonth()]}`; };

// ---------- Texto ----------
export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const normalize = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const slug = (s) => normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24);

/** Divide um total em N parcelas em centavos; a diferença de arredondamento vai na 1ª parcela. */
export function splitInstallments(total, n) {
  const cents = toCents(total);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => fromCents(base + (i === 0 ? rest : 0)));
}

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const sum = (arr, f = (x) => x) => arr.reduce((acc, x) => acc + (Number(f(x)) || 0), 0);
