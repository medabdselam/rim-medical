import { LANGS, DEFAULT_LANG, UI } from './i18n.js';
import { CONFIG } from './config.js';

const STORE_KEY = 'amoaziz.lang';
const CART_KEY  = 'amoaziz.cart';
const SIZES = [400, 800, 1200];

/* رمز الدولة يأتي من data/menu.json مع بقية بيانات المطعم،
   حتى تبقى كل أرقام التواصل في ملف واحد يعدّله صاحب المطعم. */
const cc = () => state.menu.restaurant.countryCode;

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  lang: DEFAULT_LANG,
  category: 'all',
  query: '',
  menu: null,
  lqip: {},
  openDish: null,
  cart: {},        // { dishId: quantity }
  note: '',
};

/* ------------------------------------------------------------------ أدوات */

const t = () => UI[state.lang];
const L = (obj) => (obj && (obj[state.lang] ?? obj.ar)) || '';

/* تطبيع النص قبل البحث: يوحّد صور الألف والهمزة والتاء المربوطة والألف
   المقصورة، ويحذف التشكيل والتطويل. بدونه لا يجد من كتب «منقوشه» شيئاً. */
const AR_DIACRITICS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
function norm(s) {
  return String(s).toLowerCase()
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // يزيل لكنات الفرنسية: é → e
    .replace(/\s+/g, ' ')
    .trim();
}

/* العربية هي اللغة الافتراضية دائماً. لا نستشعر لغة المتصفح: زبائن المطعم
   عرب، ولغة الجهاز قد تكون فرنسية أو إنجليزية دون أن تكون هي المطلوبة.
   نحترم فقط اختياراً صريحاً سبق أن حفظه المستخدم. */
function readLang() {
  const saved = localStorage.getItem(STORE_KEY);
  return (saved && LANGS[saved]) ? saved : DEFAULT_LANG;
}

function applyLangAttrs() {
  const { code, dir } = LANGS[state.lang];
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
}

/** يبني srcset لصورة طبق. يعيد null إذا لم تكن هناك صورة. */
function imageAttrs(slug, sizesAttr) {
  if (!slug) return null;
  return {
    src: `assets/dishes/${slug}-800.webp`,
    srcset: SIZES.map(w => `assets/dishes/${slug}-${w}.webp ${w}w`).join(', '),
    sizes: sizesAttr,
  };
}

function priceLabel(dish) {
  if (dish.price == null) return L(dish.priceNote) || t().priceOnRequest;
  const unit = dish.priceNote ? ` ${L(dish.priceNote)}` : '';
  return `${dish.price} ${t().currencyShort}${unit}`;
}

/* ------------------------------------------------------------------ السلة */

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    state.cart = raw.items && typeof raw.items === 'object' ? raw.items : {};
    state.note = typeof raw.note === 'string' ? raw.note : '';
  } catch { state.cart = {}; state.note = ''; }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify({ items: state.cart, note: state.note }));
}

const dishById = (id) => state.menu.dishes.find(d => d.id === id);

/** أسطر السلة، متجاهلةً أي معرّف لم يعد موجوداً في القائمة. */
function cartLines() {
  return Object.entries(state.cart)
    .map(([id, qty]) => ({ dish: dishById(id), qty }))
    .filter(l => l.dish && l.qty > 0);
}

const cartCount = () => cartLines().reduce((n, l) => n + l.qty, 0);

function cartTotals() {
  let total = 0, onRequest = 0;
  for (const { dish, qty } of cartLines()) {
    if (dish.price == null) onRequest += qty;
    else total += dish.price * qty;
  }
  return { total, onRequest };
}

function setQty(id, qty) {
  if (qty > 0) state.cart[id] = Math.min(qty, 99);
  else delete state.cart[id];
  saveCart();
  renderCartBar();
  renderCartSheet();
  syncCardBadges();
}

const addToCart = (id, n = 1) => setQty(id, (state.cart[id] || 0) + n);

/** رسالة واتساب واحدة تحمل الطلب كاملاً. */
function orderMessage() {
  const ui = t();
  const lines = [ui.waIntro, ''];
  for (const { dish, qty } of cartLines()) {
    const price = dish.price == null
      ? ui.waOnRequest
      : `${dish.price * qty} ${ui.currencyShort}`;
    lines.push(`${qty} × ${L(dish.name)} — ${price}`);
  }
  const { total, onRequest } = cartTotals();
  lines.push('');
  if (total > 0) lines.push(`${ui.waTotal} ${total} ${ui.currencyShort}`);
  if (onRequest > 0) lines.push(`+ ${ui.onRequestNote(onRequest)}`);
  if (state.note.trim()) lines.push(`${ui.waNote} ${state.note.trim()}`);
  // حقول يتركها الزبون فارغة ليملأها بنفسه في واتساب قبل الإرسال
  lines.push('', ui.waName, ui.waAddress);
  lines.push('', `(${ui.waFrom})`);
  return lines.join('\n');
}

/** رابط واتساب. الرقم دولي بلا + ولا مسافات: رمز الدولة + الرقم المحلي. */
function waLink() {
  const num = `${cc()}${state.menu.restaurant.whatsapp}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(orderMessage())}`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON_WA = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.2s-.7 1-.9 1.2c-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.5-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 1.9.8 2.7.9 3.6.8.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2A10 10 0 0 0 3.5 17.3L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.9.9-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>`;
const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5 15.4 6.6M8.6 13.5l6.8 3.9"/></svg>`;

/* ------------------------------------------------------------------ العرض */

function renderChrome() {
  const r = state.menu.restaurant;
  const ui = t();

  $('#skip').textContent = ui.skipToMenu;
  $('#brandName').textContent = L(r.shortName) || L(r.name);
  $('#brandSub').textContent = L(r.tagline);
  $('#heroName').textContent = L(r.name);
  // السطر الثانوي: الاسم اللاتيني تحت العربية، والاسم العربي تحت اللاتينية.
  // هكذا لا يتكرر الاسم نفسه مرتين في الفرنسية والإنجليزية.
  $('#heroLatin').textContent = state.lang === 'ar' ? 'Restaurant Amo Aziz' : r.name.ar;
  $('#heroLatin').lang = state.lang === 'ar' ? 'en' : 'ar';
  $('#heroLatin').dir = state.lang === 'ar' ? 'ltr' : 'rtl';
  $('#heroLatin').classList.toggle('hero__latin--ar', state.lang !== 'ar');
  $('#heroTag').textContent = L(r.tagline);
  $('#heroPromise').textContent = L(r.promise);

  $('#ctaMenu').textContent = ui.viewMenu;

  $('#searchIcon').innerHTML = ICON_SEARCH;
  const input = $('#search');
  input.placeholder = ui.searchPlaceholder;
  input.setAttribute('aria-label', ui.searchLabel);
  $('#searchClear').setAttribute('aria-label', ui.clearSearch);
  $('#langLabel').textContent = ui.langLabel;

  $('#chefTitle').textContent = ui.chefTitle;
  $('#chefBody').textContent = ui.chefBody;
  $('#infoTitle').textContent = ui.infoTitle;
  $('#addrLabel').textContent = ui.addressLabel;
  $('#addrValue').textContent = L(r.address);
  $('#ordersLabel').textContent = ui.ordersLabel;
  $('#feedbackLabel').textContent = ui.feedbackLabel;
  $('#payLabel').textContent = ui.paymentsLabel;

  $('#ordersValue').innerHTML =
    `<a href="tel:+${cc()}${r.whatsapp}" dir="ltr">+${cc()} ${esc(r.whatsapp)}</a>`;
  $('#feedbackValue').innerHTML =
    `<a href="tel:+${cc()}${r.feedbackPhone}" dir="ltr">+${cc()} ${esc(r.feedbackPhone)}</a>`;
  $('#shareBtn').innerHTML = `${ICON_SHARE}<span>${esc(ui.share)}</span>`;
  $('#payValue').innerHTML = r.payments.map(p => `<span>${esc(p)}</span>`).join('');
  $('#footName').textContent = L(r.name);

  // أزرار اللغة
  $('#langs').innerHTML = Object.values(LANGS).map(l =>
    `<button type="button" data-lang="${l.code}" lang="${l.code}"
       aria-pressed="${l.code === state.lang}" title="${esc(l.label)}">${esc(l.short)}</button>`).join('');

  // تبويبات الأقسام
  const cats = [{ id: 'all', name: { ar: ui.all, fr: ui.all, en: ui.all } }, ...state.menu.categories];
  $('#tabs').innerHTML = cats.map(c =>
    `<button type="button" data-cat="${c.id}" aria-pressed="${c.id === state.category}">${esc(L(c.name))}</button>`).join('');
}

function visibleDishes() {
  const q = norm(state.query);
  return state.menu.dishes.filter(d => {
    if (state.category !== 'all' && d.category !== state.category) return false;
    if (!q) return true;
    // يُبنى مرة واحدة لكل طبق ويُخزَّن عليه — البحث يُستدعى مع كل ضغطة حرف
    d._hay ??= norm([d.name.ar, d.name.fr, d.name.en, d.desc?.ar, d.desc?.fr, d.desc?.en]
      .filter(Boolean).join(' '));
    return d._hay.includes(q);
  });
}

/* بطاقة كلاسيكية على نسق القائمة المطبوعة: صورة، ثم الاسم، ثم شريط السعر —
   وزر إضافة صغير فوق الصورة للطلب السريع بلا فتح النافذة. */
function cardHTML(d) {
  const img = imageAttrs(d.image, '(min-width:900px) 300px, 46vw');
  const lq = state.lqip[d.image];
  const qty = state.cart[d.id] || 0;
  const media = img
    ? `<img src="${img.src}" srcset="${img.srcset}" sizes="${img.sizes}"
           alt="${esc(L(d.name))}" loading="lazy" decoding="async" width="800" height="800">`
    : `<span class="card__noimg">${esc(t().noImage)}</span>`;

  return `<article class="card${qty ? ' card--in' : ''}" data-id="${d.id}">
    <button type="button" class="card__open" data-open="${d.id}">
      <span class="card__media"${lq ? ` style="--lqip:url(${lq})"` : ''}>${media}</span>
      <span class="card__name">${esc(L(d.name))}</span>
      <span class="card__price">${esc(priceLabel(d))}</span>
    </button>
    <button type="button" class="card__add" data-add="${d.id}"
            aria-label="${esc(t().addToCart)} — ${esc(L(d.name))}">
      <span class="card__addIcon" aria-hidden="true">+</span>
      <span class="card__qty" data-qty="${d.id}">${qty || ''}</span>
    </button>
  </article>`;
}

/** يحدّث عدّادات البطاقات بعد كل تغيير في السلة دون إعادة بناء الشبكة. */
function syncCardBadges() {
  $$('.card').forEach(card => {
    const qty = state.cart[card.dataset.id] || 0;
    card.classList.toggle('card--in', qty > 0);
    const badge = card.querySelector('[data-qty]');
    if (badge) badge.textContent = qty || '';
  });
}

function renderGrid() {
  const list = visibleDishes();
  const host = $('#menu');

  if (!list.length) {
    host.innerHTML = `<p class="empty">${esc(t().noResults)}<br>
      <button type="button" class="btn btn--ghost" id="resetBtn">${esc(t().clearSearch)}</button></p>`;
    return;
  }

  // مجموعة لكل قسم، بترتيب الأقسام في ملف البيانات
  const order = state.menu.categories.map(c => c.id);
  const groups = order
    .map(id => ({ cat: state.menu.categories.find(c => c.id === id), items: list.filter(d => d.category === id) }))
    .filter(g => g.items.length);

  host.innerHTML = groups.map(g => `
    <section class="cat" aria-labelledby="h-${g.cat.id}">
      <div class="section-head">
        <h2 id="h-${g.cat.id}">${esc(L(g.cat.name))}</h2>
        <span>${esc(t().dishCount(g.items.length))}</span>
      </div>
      <div class="grid">${g.items.map(cardHTML).join('')}</div>
    </section>`).join('');
}

/* ------------------------------------------------------- نافذة الطبق */

function openDish(id) {
  const d = state.menu.dishes.find(x => x.id === id);
  if (!d) return;
  state.openDish = id;

  const dlg = $('#dish');
  const img = imageAttrs(d.image, '(min-width:620px) 560px, 100vw');
  const cat = state.menu.categories.find(c => c.id === d.category);
  const related = state.menu.dishes.filter(x => x.category === d.category && x.id !== d.id).slice(0, 6);

  dlg.innerHTML = `
    <div class="modal__scroll">
      <div class="modal__media">
        <button type="button" class="modal__close" id="dishClose" aria-label="${esc(t().close)}">&times;</button>
        <nav class="modal__langs langs" aria-label="${esc(t().langLabel)}">${
          Object.values(LANGS).map(l => `<button type="button" data-lang="${l.code}" lang="${l.code}"
            aria-pressed="${l.code === state.lang}" title="${esc(l.label)}">${esc(l.short)}</button>`).join('')
        }</nav>
        ${img
          ? `<img src="${img.src}" srcset="${img.srcset}" sizes="${img.sizes}"
                alt="${esc(L(d.name))}" width="800" height="800">`
          : `<span class="card__noimg">${esc(t().noImage)}</span>`}
      </div>
      <div class="modal__body">
        <p class="modal__cat">${esc(L(cat?.name))}</p>
        <h3 class="modal__name">${esc(L(d.name))}</h3>
        <p class="modal__desc">${esc(L(d.desc))}</p>
        <div class="modal__row">
          <span class="modal__price">${d.price != null
            ? `${d.price} <small>${esc(t().currencyShort)}${d.priceNote ? ' · ' + esc(L(d.priceNote)) : ''}</small>`
            : `<small>${esc(L(d.priceNote) || t().priceOnRequest)}</small>`}</span>
          <div class="stepper" role="group" aria-label="${esc(t().qty)}">
            <button type="button" data-step="-1" aria-label="${esc(t().decrease)}">−</button>
            <output data-modalqty>${state.cart[d.id] || 0}</output>
            <button type="button" data-step="1" aria-label="${esc(t().increase)}">+</button>
          </div>
        </div>
        <button type="button" class="btn btn--gold modal__addBtn" data-add="${d.id}">
          ${esc(t().addToCart)}
        </button>
        ${related.length ? `<div class="related">
          <h4>${esc(t().alsoInCategory)}</h4>
          <div class="related__list">${related.map(r => `
            <button type="button" class="related__item" data-id="${r.id}">
              ${r.image ? `<img src="assets/dishes/${r.image}-400.webp" alt="" loading="lazy" width="108" height="108">` : ''}
              <span>${esc(L(r.name))}</span>
              <b>${esc(priceLabel(r))}</b>
            </button>`).join('')}</div>
        </div>` : ''}
      </div>
    </div>`;

  if (!dlg.open) dlg.showModal();
  $('#dishClose').focus();
}

/* ------------------------------------------------------- شريط السلة */

/** الشريط الثابت أسفل الشاشة. عندما تكون السلة فارغة لا يفتح واتساب
    إطلاقاً — بل يوجّه الزبون إلى اختيار طبق أولاً. */
function renderCartBar() {
  const ui = t();
  const n = cartCount();
  const { total, onRequest } = cartTotals();
  const bar = $('#cartBar');

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

function renderCartSheet() {
  const dlg = $('#cart');
  if (!dlg.open) return;
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
              ${dish.image ? `<img src="assets/dishes/${dish.image}-400.webp" alt=""
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

function openCart() {
  const dlg = $('#cart');
  if (!dlg.open) dlg.showModal();
  renderCartSheet();
  $('#cartClose')?.focus();
}

function closeDish() {
  state.openDish = null;
  const dlg = $('#dish');
  if (dlg.open) dlg.close();
}

/* ------------------------------------------------------------- التحكم */

function setLang(code) {
  if (!LANGS[code] || code === state.lang) return;
  const y = window.scrollY;
  state.lang = code;
  localStorage.setItem(STORE_KEY, code);
  applyLangAttrs();
  renderChrome();
  renderGrid();
  renderCartBar();
  renderCartSheet();
  // القسم الحالي والبحث محفوظان في state، والطبق المفتوح يُعاد فتحه باللغة الجديدة
  if (state.openDish) openDish(state.openDish);
  window.scrollTo({ top: y, behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' });
}

function bind() {
  $('#langs').addEventListener('click', e => {
    const b = e.target.closest('[data-lang]');
    if (b) setLang(b.dataset.lang);
  });

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    state.category = b.dataset.cat;
    $$('#tabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderGrid();
  });

  const input = $('#search');
  input.addEventListener('input', () => {
    state.query = input.value;
    $('#searchClear').hidden = !state.query;
    renderGrid();
  });

  $('#searchClear').addEventListener('click', () => {
    input.value = ''; state.query = '';
    $('#searchClear').hidden = true;
    renderGrid(); input.focus();
  });

  $('#menu').addEventListener('click', e => {
    if (e.target.closest('#resetBtn')) {
      input.value = ''; state.query = ''; state.category = 'all';
      $('#searchClear').hidden = true;
      $$('#tabs button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.cat === 'all')));
      renderGrid();
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) { addToCart(add.dataset.add); flash(add); return; }
    const open = e.target.closest('[data-open]');
    if (open) openDish(open.dataset.open);
  });

  const dlg = $('#dish');
  dlg.addEventListener('click', e => {
    if (e.target.closest('#dishClose')) return closeDish();
    const lang = e.target.closest('[data-lang]');
    if (lang) return setLang(lang.dataset.lang);
    const step = e.target.closest('[data-step]');
    if (step && state.openDish) {
      const cur = state.cart[state.openDish] || 0;
      setQty(state.openDish, Math.max(0, cur + Number(step.dataset.step)));
      const out = dlg.querySelector('[data-modalqty]');
      if (out) out.textContent = state.cart[state.openDish] || 0;
      return;
    }
    const add = e.target.closest('[data-add]');
    if (add) {
      if (!state.cart[add.dataset.add]) addToCart(add.dataset.add);
      const out = dlg.querySelector('[data-modalqty]');
      if (out) out.textContent = state.cart[add.dataset.add] || 0;
      flash(add); closeDish(); openCart();
      return;
    }
    const rel = e.target.closest('.related__item');
    if (rel) return openDish(rel.dataset.id);
    // النقر على الخلفية خارج الورقة يغلقها
    if (e.target === dlg) closeDish();
  });
  dlg.addEventListener('close', () => { state.openDish = null; });

  // شريط السلة الثابت
  $('#cartBar').addEventListener('click', e => {
    if (!e.target.closest('#cartCta')) return;
    if (cartCount() === 0) {
      // السلة فارغة: لا نفتح واتساب. نأخذه إلى الأطباق ونشرح السبب.
      document.getElementById('menu').scrollIntoView({ block: 'start' });
      toast(t().cartEmptyHint);
      return;
    }
    openCart();
  });

  const cart = $('#cart');
  cart.addEventListener('click', e => {
    if (e.target.closest('#cartClose') || e.target === cart) return cart.close();
    if (e.target.closest('#cartBrowse')) {
      cart.close();
      document.getElementById('menu').scrollIntoView({ block: 'start' });
      return;
    }
    if (e.target.closest('#cartClear')) {
      state.cart = {}; state.note = ''; saveCart();
      renderCartBar(); renderCartSheet(); syncCardBadges();
      return;
    }
    const step = e.target.closest('[data-cartstep]');
    if (step) {
      const id = step.dataset.id;
      setQty(id, (state.cart[id] || 0) + Number(step.dataset.cartstep));
      return;
    }
    // زر الإرسال: نحدّث الرابط لحظة النقر حتى يحمل آخر حالة للسلة والملاحظة
    const send = e.target.closest('#cartSend');
    if (send) send.href = waLink();
  });
  $('#shareBtn').addEventListener('click', shareMenu);

  cart.addEventListener('input', e => {
    if (e.target.id === 'cartNote') {
      state.note = e.target.value; saveCart();
      const send = $('#cartSend');            // أبقِ الرابط مطابقاً للملاحظة لحظةً بلحظة
      if (send) send.href = waLink();
    }
  });

}

/* ------------------------------------------------------------ المشاركة */

/** يشارك رابط القائمة عبر ورقة المشاركة الأصلية للنظام، ويسقط إلى
    نسخ الرابط عندما لا تتوفر (أغلب متصفحات سطح المكتب).
    الرابط المُشارَك هو العنوان الرسمي دائماً لا عنوان التبويب الحالي،
    حتى لا تُشارَك روابط تحمل معاملات بحث أو مرساة قسم. */
async function shareMenu() {
  const ui = t();
  const url = CONFIG.siteUrl + '/';

  if (navigator.share) {
    try {
      await navigator.share({ title: ui.shareTitle, text: ui.shareText, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;   // ألغى المستخدم المشاركة
      /* غير ذلك: نكمل إلى النسخ */
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    toast(ui.linkCopied);
  } catch {
    toast(ui.linkCopyFailed);
  }
}

/** وميض قصير يؤكد الإضافة بصرياً. */
function flash(el) {
  el.classList.remove('is-flash');
  void el.offsetWidth;
  el.classList.add('is-flash');
}

let toastTimer;
function toast(msg) {
  let el = $('#toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

/* --------------------------------------------------------------- الإقلاع */

async function boot() {
  state.lang = readLang();
  applyLangAttrs();

  const [menu, lqip] = await Promise.all([
    fetch('data/menu.json').then(r => r.json()),
    fetch('assets/dishes/manifest.json').then(r => r.json()).catch(() => ({})),
  ]);

  state.menu = menu;
  state.lqip = Object.fromEntries(Object.entries(lqip).map(([k, v]) => [k, v.lqip]));

  loadCart();
  renderChrome();
  renderGrid();
  renderCartBar();
  bind();
}

/* التخزين المؤقت للعمل بلا إنترنت. يُسجَّل بعد اكتمال التحميل حتى لا
   ينافس عرض الصفحة الأول، ويُتجاهل بصمت إذا رُفض (فتح الملف محلياً
   عبر file:// مثلاً) — الموقع يعمل كاملاً بدونه. */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const go = () => navigator.serviceWorker.register('sw.js').catch(() => {});
  // boot() غير متزامنة، وقد يكون حدث load قد مضى قبل أن تنتهي —
  // عندها لن يُستدعى المستمع أبداً، فنسجّل فوراً.
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}

boot().then(registerSW).catch(err => {
  console.error(err);
  document.getElementById('menu').innerHTML =
    '<p class="empty">تعذّر تحميل القائمة. حدِّث الصفحة.<br>Impossible de charger le menu.<br>Could not load the menu.</p>';
});
