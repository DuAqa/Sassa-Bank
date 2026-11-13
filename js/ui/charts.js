// Gráficos leves em SVG puro (sem bibliotecas → funciona offline e carrega rápido).
import { monthLabel, moneyShort, money, escapeHtml } from '../utils.js';

const C = { income: 'var(--income)', expense: 'var(--expense)', grid: 'var(--line)', text: 'var(--muted)' };

/** Barras agrupadas Receitas x Despesas por mês. */
export function incomeExpenseBars(series, { height = 170 } = {}) {
  const W = 340, H = height, top = 14, bottom = 26, left = 4, right = 4;
  const max = Math.max(1, ...series.flatMap((s) => [s.income, s.expense]));
  const slot = (W - left - right) / series.length;
  const bw = Math.min(16, slot / 3.2);
  const y = (v) => top + (H - top - bottom) * (1 - v / max);
  const bars = series.map((s, i) => {
    const cx = left + slot * i + slot / 2;
    const yi = y(s.income), ye = y(s.expense);
    const base = H - bottom;
    return `
      <g class="bar-group">
        <title>${monthLabel(s.month)} — recebeu ${money(s.income)}, gastou ${money(s.expense)}</title>
        <rect x="${cx - bw - 1.5}" y="${yi}" width="${bw}" height="${Math.max(0, base - yi)}" rx="${Math.min(5, bw / 2)}" fill="${C.income}" class="grow"/>
        <rect x="${cx + 1.5}" y="${ye}" width="${bw}" height="${Math.max(0, base - ye)}" rx="${Math.min(5, bw / 2)}" fill="${C.expense}" class="grow"/>
        <text x="${cx}" y="${H - 8}" text-anchor="middle" class="chart-label">${monthLabel(s.month)}</text>
      </g>`;
  }).join('');
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de receitas e despesas por mês">
      <line x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}" stroke="${C.grid}" stroke-width="1"/>
      ${bars}
    </svg>
    <div class="legend"><span><i style="background:var(--income)"></i>Recebi</span><span><i style="background:var(--expense)"></i>Gastei</span></div>`;
}

/** Linha suave com área para a evolução do saldo. */
export function balanceLine(series, { height = 140 } = {}) {
  const W = 340, H = height, top = 22, bottom = 24, pad = 14;
  const vals = series.map((s) => s.balance);
  const min = Math.min(0, ...vals), max = Math.max(1, ...vals);
  const x = (i) => pad + ((W - pad * 2) * i) / Math.max(1, series.length - 1);
  const y = (v) => top + (H - top - bottom) * (1 - (v - min) / (max - min || 1));
  const pts = series.map((s, i) => [x(i), y(s.balance)]);
  const d = pts.map((p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const [px, py] = pts[i - 1];
    const cx = (px + p[0]) / 2;
    return `C${cx},${py} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }).join(' ');
  const area = `${d} L${pts.at(-1)[0]},${H - bottom} L${pts[0][0]},${H - bottom} Z`;
  const last = pts.at(-1);
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolução do saldo">
      <defs>
        <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--brand)" stop-opacity=".28"/>
          <stop offset="100%" stop-color="var(--brand)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#gradArea)"/>
      <path d="${d}" fill="none" stroke="var(--brand)" stroke-width="3" stroke-linecap="round" class="draw"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5 : 3}" fill="${i === pts.length - 1 ? 'var(--brand)' : 'var(--surface)'}" stroke="var(--brand)" stroke-width="2"><title>${monthLabel(series[i].month)}: ${money(series[i].balance)}</title></circle>`).join('')}
      <text x="${Math.min(last[0], W - 40)}" y="${Math.max(12, last[1] - 10)}" text-anchor="middle" class="chart-value">${escapeHtml(moneyShort(series.at(-1).balance))}</text>
      ${series.map((s, i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" class="chart-label">${monthLabel(s.month)}</text>`).join('')}
    </svg>`;
}

/** Duas barras horizontais grandes (usado no período "Mês"). */
export function compareBars(income, expense) {
  const max = Math.max(1, income, expense);
  const row = (label, v, color) => `
    <div class="hbar">
      <div class="hbar-top"><span>${label}</span><strong>${money(v)}</strong></div>
      <div class="hbar-track"><div class="hbar-fill" style="--w:${(v / max) * 100}%;background:${color}"></div></div>
    </div>`;
  return row('💰 Recebi', income, 'var(--income)') + row('💸 Gastei', expense, 'var(--expense)');
}

/** Anel de progresso (percentual economizado). */
export function ring(pct, { size = 72, stroke = 9, color = 'var(--income)' } = {}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ring" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})" class="ring-fill"/>
    </svg>`;
}
