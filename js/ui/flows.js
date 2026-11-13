// Fluxos em bottom sheet: registrar, detalhes, metas, categorias.
// Os fluxos só falam com o DataService — nunca com o backend diretamente.
import { DataService } from '../data/dataService.js';
import { Store } from '../state.js';
import { APP, PAYMENT_METHODS, GOAL_EMOJIS, CATEGORY_EMOJIS } from '../config.js';
import { summary, goalProgress } from '../finance.js';
import { money, escapeHtml, today, addDays, friendlyDate, splitInstallments, shortDate } from '../utils.js';
import { openSheet, toast, confirmDialog, moneyField, bindMoneyField, celebrate, progressBar } from './components.js';
import { categoryOf } from './views/shared.js';

const data = () => Store.get().data;

// ======================= REGISTRAR =======================
export function openRegister(presetType) {
  if (presetType) return openRegisterForm({ type: presetType });
  openSheet(`
    <h2 class="sheet-title">O que aconteceu?</h2>
    <div class="choice">
      <button class="choice-btn choice-in" data-type="receita"><span>💰</span>Recebi</button>
      <button class="choice-btn choice-out" data-type="despesa"><span>💸</span>Gastei</button>
    </div>`, {
    label: 'Registrar',
    onMount(body, close) {
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-type]');
        if (!b) return;
        close();
        setTimeout(() => openRegisterForm({ type: b.dataset.type }), 120);
      });
    },
  });
}

/** Formulário de movimentação. `tx` presente = modo edição (só itens não parcelados). */
export function openRegisterForm({ type, tx = null }) {
  const st = {
    type: tx?.type || type,
    amount: tx?.amount || 0,
    category: tx?.category || '',
    description: tx?.description || '',
    date: tx?.date || today(),
    payment: tx?.payment || '',
    installments: 1,
  };
  const editing = Boolean(tx);

  const html = () => {
    const isOut = st.type === 'despesa';
    const cats = data().categories.filter((c) => c.tipo === st.type && (c.ativa || c.id === st.category)).sort((a, b) => a.ordem - b.ordem);
    const dateChoice = st.date === today() ? 'hoje' : st.date === addDays(today(), -1) ? 'ontem' : 'outra';
    const parts = st.installments > 1 && st.amount > 0 ? splitInstallments(st.amount, st.installments) : null;
    return `
      <div class="reg reg-${st.type}">
        <div class="reg-head">
          <span class="reg-badge">${isOut ? '💸 Gastei' : '💰 Recebi'}</span>
          ${editing ? '' : `<button class="link" data-act="swap">Trocar para ${isOut ? 'Recebi' : 'Gastei'}</button>`}
        </div>
        ${moneyField({ value: st.amount, label: isOut ? 'Quanto gastei?' : 'Quanto recebi?' })}

        <p class="field-label">Categoria</p>
        <div class="chips chips-wrap" role="radiogroup" aria-label="Categoria">
          ${cats.map((c) => `<button type="button" role="radio" aria-checked="${st.category === c.id}" class="chip chip-cat ${st.category === c.id ? 'on' : ''}" data-cat="${c.id}" style="--c:${c.cor}">${c.emoji} ${escapeHtml(c.nome)}</button>`).join('')}
          <button type="button" class="chip chip-add" data-act="newcat">＋ Nova</button>
        </div>

        <label class="field"><span class="field-label">Descrição <em>(opcional)</em></span>
          <input id="reg-desc" class="input" maxlength="80" placeholder="${isOut ? 'Ex.: lanche, cinema…' : 'Ex.: mesada de junho'}" value="${escapeHtml(st.description)}" autocomplete="off" enterkeyhint="done" />
        </label>

        <p class="field-label">Quando?</p>
        <div class="chips">
          <button type="button" class="chip ${dateChoice === 'hoje' ? 'on' : ''}" data-date="hoje">Hoje</button>
          <button type="button" class="chip ${dateChoice === 'ontem' ? 'on' : ''}" data-date="ontem">Ontem</button>
          <label class="chip chip-date ${dateChoice === 'outra' ? 'on' : ''}">📅 ${dateChoice === 'outra' ? friendlyDate(st.date) : 'Outra data'}
            <input type="date" id="reg-date" value="${st.date}" aria-label="Escolher data" />
          </label>
        </div>

        ${isOut ? `
          <details class="details reg-more" ${st.payment || st.installments > 1 ? 'open' : ''}>
            <summary>Forma de pagamento e parcelas</summary>
            <p class="field-label">Como paguei? <em>(opcional)</em></p>
            <div class="chips">
              ${PAYMENT_METHODS.map((p) => `<button type="button" class="chip ${st.payment === p.id ? 'on' : ''}" data-pay="${p.id}">${p.emoji} ${p.nome}</button>`).join('')}
            </div>
            ${editing ? '' : `
            <p class="field-label">Parcelado?</p>
            <div class="stepper">
              <button type="button" data-inst="-1" aria-label="Menos parcelas">−</button>
              <output>${st.installments === 1 ? 'À vista' : `${st.installments}x`}</output>
              <button type="button" data-inst="1" aria-label="Mais parcelas">+</button>
            </div>
            ${parts ? `<p class="inst-preview">${st.installments}x de <strong>${money(parts[parts.length - 1])}</strong> · a 1ª entra ${friendlyDate(st.date).toLowerCase()} e as outras ficam como <em>comprometido</em> 🗓️</p>` : ''}`}
          </details>` : ''}

        <button class="btn btn-primary btn-block btn-lg" data-act="save" ${st.amount > 0 && st.category ? '' : 'disabled'}>${editing ? 'Salvar alterações' : 'Salvar'}</button>
        ${editing ? '<button class="link danger center-block" data-act="delete">Excluir movimentação</button>' : ''}
      </div>`;
  };

  openSheet(html(), {
    label: 'Registrar movimentação',
    onMount(body, close) {
      const rerender = (keepFocus = false) => {
        const scroll = body.parentElement.scrollTop;
        body.innerHTML = html();
        wire(keepFocus);
        body.parentElement.scrollTop = scroll;
      };
      const wire = (focusAmount = true) => {
        const amountInput = body.querySelector('.money-input');
        if (!focusAmount) amountInput.removeAttribute('data-autofocus');
        bindMoneyField(amountInput, (v) => {
          st.amount = v;
          body.querySelector('[data-act="save"]').disabled = !(st.amount > 0 && st.category);
          const prev = body.querySelector('.inst-preview');
          if (prev && st.installments > 1) { const p = splitInstallments(Math.max(st.amount, 0.01), st.installments); prev.querySelector('strong').textContent = money(p[p.length - 1]); }
        });
        body.querySelector('#reg-desc').addEventListener('input', (e) => { st.description = e.target.value; });
        body.querySelector('#reg-date').addEventListener('change', (e) => { if (e.target.value) { st.date = e.target.value; rerender(false); } });
      };
      wire(!editing);

      body.addEventListener('click', async (e) => {
        const t = e.target.closest('button, [data-date]');
        if (!t) return;
        if (t.dataset.cat) { st.category = t.dataset.cat; rerender(false); return; }
        if (t.dataset.pay) { st.payment = st.payment === t.dataset.pay ? '' : t.dataset.pay; rerender(false); return; }
        if (t.dataset.date === 'hoje') { st.date = today(); rerender(false); return; }
        if (t.dataset.date === 'ontem') { st.date = addDays(today(), -1); rerender(false); return; }
        if (t.dataset.inst) {
          st.installments = Math.max(1, Math.min(APP.maxInstallments, st.installments + Number(t.dataset.inst)));
          if (st.installments > 1 && st.payment === '') st.payment = 'credito';
          rerender(false); return;
        }
        const act = t.dataset.act;
        if (act === 'swap') { st.type = st.type === 'despesa' ? 'receita' : 'despesa'; st.category = ''; st.installments = 1; st.payment = ''; rerender(false); }
        if (act === 'newcat') openNewCategory(st.type, (c) => { st.category = c.id; rerender(false); });
        if (act === 'delete') {
          if (await confirmDialog('Excluir esta movimentação?', { ok: 'Excluir', danger: true, emoji: '🗑️' })) {
            DataService.deleteTransaction(tx.id); close(); toast('Movimentação excluída');
          }
        }
        if (act === 'save') {
          try {
            if (editing) {
              DataService.updateTransaction(tx.id, { amount: st.amount, category: st.category, description: st.description, date: st.date, payment: st.payment });
              toast('✅ Alterações salvas');
            } else {
              DataService.addTransaction({ ...st });
              const free = summary(data()).free;
              if (st.type === 'receita') toast(`💰 Oba! ${money(st.amount)} na conta`);
              else if (st.installments > 1) toast(`🗓️ Compra em ${st.installments}x registrada`);
              else toast(free >= 0 ? `💸 Gasto registrado · livre: ${money(free)}` : '💸 Gasto registrado — atenção ao saldo 💛', free >= 0 ? 'success' : 'warn');
            }
            close();
          } catch (err) {
            toast(err.message, 'error');
          }
        }
      });
    },
  });
}

// ======================= DETALHE DA MOVIMENTAÇÃO =======================
export function openTransaction(id) {
  const t = data().transactions.find((x) => x.id === id);
  if (!t) return;
  if (!t.installments) return openRegisterForm({ tx: t });
  const c = categoryOf(data().categories, t.category);
  const siblings = data().transactions.filter((x) => x.purchaseId === t.purchaseId).sort((a, b) => a.installment - b.installment);
  const paid = siblings.filter((x) => x.date <= today()).length;
  openSheet(`
    <div class="detail">
      <span class="detail-icon" style="--c:${c.cor}">${c.emoji}</span>
      <h2>${escapeHtml(t.description || c.nome)}</h2>
      <p class="detail-amount out">− ${money(t.amount)}</p>
      <p class="muted">Parcela ${t.installment} de ${t.installments} · ${friendlyDate(t.date)}</p>
      <div class="card card-soft">
        <div class="kv"><span>Valor total</span><strong>${money(t.purchaseTotal || siblings.reduce((a, x) => a + x.amount, 0))}</strong></div>
        <div class="kv"><span>Parcelas pagas</span><strong>${paid} de ${t.installments}</strong></div>
        ${progressBar(Math.round((paid / t.installments) * 100), 'var(--expense)')}
        <div class="kv"><span>Ainda comprometido</span><strong>${money(siblings.filter((x) => x.date > today()).reduce((a, x) => a + x.amount, 0))}</strong></div>
      </div>
      <div class="inst-list">${siblings.map((x) => `<div class="inst ${x.date <= today() ? 'paid' : ''} ${x.id === t.id ? 'current' : ''}"><span>${x.installment}/${x.installments}</span><span>${shortDate(x.date)}</span><strong>${money(x.amount)}</strong></div>`).join('')}</div>
      <button class="btn btn-ghost btn-block" data-act="del-all">🗑️ Excluir compra (todas as parcelas)</button>
    </div>`, {
    label: 'Detalhes da compra parcelada',
    onMount(body, close) {
      body.querySelector('[data-act="del-all"]').addEventListener('click', async () => {
        if (await confirmDialog(`Excluir as ${t.installments} parcelas desta compra?`, { ok: 'Excluir tudo', danger: true, emoji: '🗑️' })) {
          DataService.deletePurchase(t.purchaseId); close(); toast('Compra excluída');
        }
      });
    },
  });
}

// ======================= METAS =======================
export function openGoalForm(goal = null) {
  const st = { name: goal?.name || '', emoji: goal?.emoji || '🎯', target: goal?.target || 0, saved: goal?.saved || 0, targetDate: goal?.targetDate || '' };
  openSheet(`
    <h2 class="sheet-title">${goal ? 'Editar meta' : 'Nova meta 🎯'}</h2>
    <form class="stack" id="goal-form">
      <p class="field-label">Escolha um ícone</p>
      <div class="emoji-pick">${GOAL_EMOJIS.map((e) => `<button type="button" class="${e === st.emoji ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
      <label class="field"><span class="field-label">Qual é a meta?</span>
        <input class="input" name="name" maxlength="40" placeholder="Ex.: Celular novo" value="${escapeHtml(st.name)}" required /></label>
      ${moneyField({ id: 'goal-target', value: st.target, label: 'Quanto custa?', autofocus: false })}
      ${goal ? '' : moneyField({ id: 'goal-saved', value: 0, label: 'Já tenho guardado (opcional)', autofocus: false })}
      <label class="field"><span class="field-label">Até quando? <em>(opcional)</em></span>
        <input class="input" type="date" name="targetDate" value="${st.targetDate}" min="${today()}" /></label>
      <button class="btn btn-primary btn-block btn-lg" type="submit">${goal ? 'Salvar' : 'Criar meta'}</button>
      ${goal ? '<button type="button" class="link danger center-block" data-act="delete">Excluir meta</button>' : ''}
    </form>`, {
    label: goal ? 'Editar meta' : 'Nova meta',
    onMount(body, close) {
      const getTarget = bindMoneyField(body.querySelector('#goal-target'));
      const savedEl = body.querySelector('#goal-saved');
      const getSaved = savedEl ? bindMoneyField(savedEl) : () => 0;
      body.querySelector('[name="name"]').focus({ preventScroll: true });
      body.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-emoji]');
        if (b) { st.emoji = b.dataset.emoji; body.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('on', x === b)); }
        if (e.target.closest('[data-act="delete"]')) {
          const msg = goal.saved > 0 ? `Excluir a meta? Os ${money(goal.saved)} guardados voltam a ficar livres.` : 'Excluir esta meta?';
          if (await confirmDialog(msg, { ok: 'Excluir', danger: true, emoji: '🗑️' })) { DataService.deleteGoal(goal.id); close(); toast('Meta excluída'); }
        }
      });
      body.querySelector('#goal-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        try {
          const saved = getSaved();
          if (!goal && saved > 0) checkFree(saved);
          if (goal) DataService.updateGoal(goal.id, { name: f.get('name').trim(), emoji: st.emoji, target: getTarget(), targetDate: f.get('targetDate') || '' });
          else DataService.addGoal({ name: f.get('name'), emoji: st.emoji, target: getTarget(), saved, targetDate: f.get('targetDate') });
          close();
          toast(goal ? '✅ Meta atualizada' : '🎯 Meta criada! Bora guardar?');
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

function checkFree(value) {
  const free = summary(data()).free;
  if (value > free + 0.001) throw new Error(free > 0 ? `Você tem ${money(free)} livre agora. Guarde até esse valor 😉` : 'Você não tem dinheiro livre agora para guardar.');
}

export function openGoal(id) {
  const g = data().goals.find((x) => x.id === id);
  if (!g) return;
  const pct = goalProgress(g);
  openSheet(`
    <div class="detail">
      <span class="detail-icon big">${g.emoji}</span>
      <h2>${escapeHtml(g.name)}</h2>
      <p class="detail-amount">${money(g.saved)} <span class="muted">de ${money(g.target)}</span></p>
      ${progressBar(pct, 'linear-gradient(90deg,var(--brand),var(--brand-2))')}
      <p class="muted">${pct >= 100 ? 'Meta conquistada! 🏆' : `Faltam ${money(g.target - g.saved)} · ${pct}%`}</p>
      <div class="btn-row">
        <button class="btn btn-ghost" data-act="withdraw" ${g.saved > 0 ? '' : 'disabled'}>Retirar</button>
        <button class="btn btn-primary" data-act="deposit">+ Guardar</button>
      </div>
      <button class="link center-block" data-act="edit">Editar meta</button>
    </div>`, {
    label: `Meta ${g.name}`,
    onMount(body, close) {
      body.addEventListener('click', (e) => {
        const a = e.target.closest('[data-act]')?.dataset.act;
        if (!a) return;
        close();
        setTimeout(() => (a === 'edit' ? openGoalForm(g) : openGoalMoney(g.id, a === 'deposit' ? 1 : -1)), 120);
      });
    },
  });
}

export function openGoalMoney(id, direction = 1) {
  const g = data().goals.find((x) => x.id === id);
  if (!g) return;
  const free = summary(data()).free;
  const deposit = direction > 0;
  openSheet(`
    <h2 class="sheet-title">${deposit ? `Guardar para ${g.emoji} ${escapeHtml(g.name)}` : `Retirar de ${g.emoji} ${escapeHtml(g.name)}`}</h2>
    ${moneyField({ id: 'gm', label: deposit ? 'Quanto vou guardar?' : 'Quanto vou retirar?' })}
    <p class="muted small">${deposit ? `Livre para gastar agora: <strong>${money(Math.max(0, free))}</strong>` : `Guardado nesta meta: <strong>${money(g.saved)}</strong>`}</p>
    ${deposit ? `<div class="chips">${[10, 20, 50, 100].filter((v) => v <= free).map((v) => `<button class="chip" data-quick="${v}">${money(v)}</button>`).join('')}</div>` : ''}
    <button class="btn btn-primary btn-block btn-lg" data-act="ok">${deposit ? 'Guardar 💖' : 'Retirar'}</button>`, {
    label: deposit ? 'Guardar dinheiro na meta' : 'Retirar dinheiro da meta',
    className: 'sheet-small',
    onMount(body, close) {
      const input = body.querySelector('#gm');
      const get = bindMoneyField(input);
      body.addEventListener('click', (e) => {
        const q = e.target.closest('[data-quick]');
        if (q) { input.value = String(Number(q.dataset.quick) * 100); input.dispatchEvent(new Event('input')); return; }
        if (!e.target.closest('[data-act="ok"]')) return;
        try {
          const v = get();
          if (deposit) checkFree(v);
          const before = g.status;
          const updated = DataService.moveGoalMoney(id, deposit ? v : -v);
          close();
          if (deposit && before !== 'concluida' && updated.status === 'concluida') { celebrate(); toast(`🏆 Você conquistou: ${g.name}!`, 'success', 4000); }
          else toast(deposit ? `💖 ${money(v)} guardados para ${g.name}` : `${money(v)} voltaram para o livre`);
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}

// ======================= CATEGORIAS =======================
export function openNewCategory(tipo, onCreated) {
  let emoji = CATEGORY_EMOJIS[0];
  openSheet(`
    <h2 class="sheet-title">Nova categoria de ${tipo === 'despesa' ? 'gasto' : 'entrada'}</h2>
    <form class="stack" id="cat-form">
      <div class="emoji-pick">${CATEGORY_EMOJIS.map((e, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-emoji="${e}">${e}</button>`).join('')}</div>
      <label class="field"><span class="field-label">Nome</span><input class="input" name="nome" maxlength="20" placeholder="Ex.: Beleza" required /></label>
      <button class="btn btn-primary btn-block" type="submit">Criar categoria</button>
    </form>`, {
    label: 'Nova categoria',
    className: 'sheet-small',
    onMount(body, close) {
      body.querySelector('[name="nome"]').focus({ preventScroll: true });
      body.addEventListener('click', (e) => {
        const b = e.target.closest('[data-emoji]');
        if (b) { emoji = b.dataset.emoji; body.querySelectorAll('[data-emoji]').forEach((x) => x.classList.toggle('on', x === b)); }
      });
      body.querySelector('#cat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        try {
          const c = DataService.addCategory({ tipo, nome: new FormData(e.target).get('nome'), emoji });
          close(); toast(`${c.emoji} Categoria criada`); onCreated?.(c);
        } catch (err) { toast(err.message, 'error'); }
      });
    },
  });
}
