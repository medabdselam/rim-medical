/* =========================================================
   واجهة السلة — مشتركة بين الواجهة الكاملة والكتالوج
   ---------------------------------------------------------
   الصفحتان تحملان العنصرين نفسيهما:
       <div class="orderbar" id="cartBar">
       <dialog class="modal sheet" id="cart">
   وتستدعيان mountCart() مرة واحدة عند الإقلاع. كل ما يخصّ عرض السلة
   وتعديل الكميات وإرسال الطلب يعيش هنا، فرسالة واتساب واحدة لا اثنتان.
   ========================================================= */

import {
  BASE, state, $, t, L, esc,
  cartLines, cartCount, cartTotals, setQty, clearCart, setNote, waLink,
  onCartChange, ICON_WA,
} from './core.js';

/** الشريط الثابت أسفل الشاشة. عندما تكون السلة فارغة لا يفتح واتساب
    إطلاقاً — بل يوجّه الزبون إلى اختيار طبق أولاً. */
export function renderCartBar() {
  const ui = t();
  const n = cartCount();
  const { total, onRequest } = cartTotals();
  const bar = $('#cartBar');
  if (!bar) return;

  bar.classList.toggle('is-empty', n === 0);
  if (n === 0) {
    bar.innerHTML = `<button type="button" class="btn btn--ghost" id="cartCta">
      <span>${esc(ui.pickDishFirst)}</span></button>`;
  } else {
    const amount = total > 0 ? `${total} ${ui.currencyShort}` : '';
    const extra  = onRequest > 0 ? ` + ${ui.onRequestNote(onRequest)}` : '';
    bar.innerHTML = `<button type="button" class="btn btn--gold cartbar__btn" id="cartCta">
      <span class="cartbar__count">${n}</span>
      <span class="cartbar__label">${esc(ui.viewCart)}</span>
      <span class="cartbar__total">${esc(amount + extra)}</span>
    </button>`;
  }
}

export function renderCartSheet() {
  const dlg = $('#cart');
  if (!dlg || !dlg.open) return;
  const ui = t();
  const lines = cartLines();
  const { total, onRequest } = cartTotals();

  dlg.innerHTML = `
    <div class="modal__scroll">
      <div class="sheet__head">
        <h3>${esc(ui.cart)}</h3>
        <button type="button" class="modal__close sheet__close" id="cartClose"
                aria-label="${esc(ui.close)}">&times;</button>
      </div>
      ${lines.length === 0 ? `
        <div class="sheet__empty">
          <p><strong>${esc(ui.cartEmpty)}</strong></p>
          <p>${esc(ui.cartEmptyHint)}</p>
          <button type="button" class="btn btn--gold" id="cartBrowse">${esc(ui.browseMenu)}</button>
        </div>` : `
        <ul class="cartlist">
          ${lines.map(({ dish, qty }) => `
            <li class="cartlist__row">
              ${dish.image ? `<img src="${BASE}assets/dishes/${dish.image}-400.webp" alt=""
                    loading="lazy" width="64" height="64">` : '<span class="cartlist__ph"></span>'}
              <div class="cartlist__txt">
                <span class="cartlist__name">${esc(L(dish.name))}</span>
                <span class="cartlist__price">${dish.price != null
                  ? `${dish.price * qty} ${esc(ui.currencyShort)}`
                  : esc(L(dish.priceNote) || ui.priceOnRequest)}</span>
              </div>
              <div class="stepper" role="group" aria-label="${esc(ui.qty)}">
                <button type="button" data-cartstep="-1" data-id="${dish.id}"
                        aria-label="${esc(ui.decrease)}">−</button>
                <output>${qty}</output>
                <button type="button" data-cartstep="1" data-id="${dish.id}"
                        aria-label="${esc(ui.increase)}">+</button>
              </div>
            </li>`).join('')}
        </ul>

        <label class="cartnote">
          <span>${esc(ui.noteLabel)}</span>
          <textarea id="cartNote" rows="2" placeholder="${esc(ui.notePlaceholder)}">${esc(state.note)}</textarea>
        </label>

        <div class="carttotal">
          <span>${esc(ui.total)}</span>
          <strong>${total > 0 ? `${total} ${esc(ui.currencyShort)}` : '—'}</strong>
        </div>
        ${onRequest > 0 ? `<p class="carttotal__note">+ ${esc(ui.onRequestNote(onRequest))}</p>` : ''}

        <p class="sheet__hint">${esc(ui.waFillHint)}</p>

        <div class="sheet__actions">
          <a class="btn btn--wa" id="cartSend" href="${waLink()}" target="_blank" rel="noopener">
            ${ICON_WA}<span>${esc(ui.sendOrder)}</span></a>
          <button type="button" class="btn btn--ghost" id="cartClear">${esc(ui.clearCart)}</button>
        </div>`}
    </div>`;
}

export function openCart() {
  const dlg = $('#cart');
  if (!dlg.open) dlg.showModal();
  renderCartSheet();
  $('#cartClose')?.focus();
}

/**
 * يربط كل تفاعلات السلة مرة واحدة.
 * @param {() => void} onBrowse  ما يحدث عند «تصفَّح الأطباق» من سلة فارغة
 *                               — الواجهتان تتعاملان معه بشكل مختلف.
 */
export function mountCart({ onBrowse }) {
  const bar = $('#cartBar');
  const dlg = $('#cart');

  bar.addEventListener('click', e => {
    if (e.target.closest('#cartCta')) cartCount() ? openCart() : onBrowse();
  });

  dlg.addEventListener('click', e => {
    const step = e.target.closest('[data-cartstep]');
    if (step) {
      const id = step.dataset.id;
      setQty(id, (state.cart[id] || 0) + Number(step.dataset.cartstep));
      return;
    }
    // النقر على الخلفية خارج الورقة يغلقها
    if (e.target.closest('#cartClose') || e.target === dlg) { dlg.close(); return; }
    if (e.target.closest('#cartClear')) { clearCart(); return; }
    if (e.target.closest('#cartBrowse')) { dlg.close(); onBrowse(); return; }
    // الرابط يُحدَّث لحظة الضغط: قد تكون اللغة أو الكميات تغيّرت بعد الرسم
    const send = e.target.closest('#cartSend');
    if (send) send.href = waLink();
  });

  dlg.addEventListener('input', e => {
    if (e.target.id !== 'cartNote') return;
    setNote(e.target.value);
    const send = $('#cartSend');   // أبقِ الرابط مطابقاً للملاحظة لحظةً بلحظة
    if (send) send.href = waLink();
  });

  onCartChange(() => { renderCartBar(); renderCartSheet(); });
  renderCartBar();
}
