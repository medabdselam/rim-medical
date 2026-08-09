import { LANGS, DEFAULT_LANG, UI } from './i18n.js';
import { CONFIG } from './config.js';
import {
  state, setBase, $, $$, t, L, esc, norm, readLang, storeLang, applyLangAttrs,
  loadMenu, imageAttrs, priceLabel,
  loadCart, saveCart, cartLines, cartCount, cartTotals, setQty, addToCart,
  clearCart, setNote, orderMessage, waLink, onCartChange,
  ICON_WA, ICON_SEARCH, ICON_SHARE, shareLink,
} from './core.js';
import { renderCartBar, renderCartSheet, openCart, mountCart } from './cart-ui.js';

/* الواجهة الكاملة تعيش في جذر الموقع */
setBase('');

/* حالة خاصة بهذه الواجهة وحدها — البحث والقسم والطبق المفتوح.
   أما اللغة والقائمة والسلة فمشتركة في core.js */
Object.assign(state, { category: 'all', query: '', openDish: null });


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
    `<a href="tel:+${r.countryCode}${r.whatsapp}" dir="ltr">+${r.countryCode} ${esc(r.whatsapp)}</a>`;
  $('#feedbackValue').innerHTML =
    `<a href="tel:+${r.countryCode}${r.feedbackPhone}" dir="ltr">+${r.countryCode} ${esc(r.feedbackPhone)}</a>`;
  $('#shareBtn').innerHTML = `${ICON_SHARE}<span>${esc(ui.share)}</span>`;
  $('#quickLink').textContent = ui.quickCatalog;
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
  storeLang(code);
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

  $('#shareBtn').addEventListener('click', shareMenu);


}

/* ------------------------------------------------------------ المشاركة */

const shareMenu = () => shareLink(CONFIG.siteUrl + '/', toast);

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

  await loadMenu();

  loadCart();
  renderChrome();
  renderGrid();
  bind();

  // السلة الفارغة لا تفتح واتساب — تأخذ الزبون إلى الأطباق وتشرح السبب
  mountCart({ onBrowse: () => {
    $('#menu').scrollIntoView({ block: 'start' });
    toast(t().cartEmptyHint);
  }});
  // شارات البطاقات خاصة بهذه الواجهة، فتُحدَّث هنا لا في الوحدة المشتركة
  onCartChange(syncCardBadges);
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
