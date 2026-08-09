import { LANGS, DEFAULT_LANG, UI } from './i18n.js';

const STORE_KEY = 'amoaziz.lang';
const COUNTRY_CODE = '222';           // موريتانيا — انظر SOURCES.md
const SIZES = [400, 800, 1200];

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const state = {
  lang: DEFAULT_LANG,
  category: 'all',
  query: '',
  menu: null,
  lqip: {},
  openDish: null,
};

/* ------------------------------------------------------------------ أدوات */

const t = () => UI[state.lang];
const L = (obj) => (obj && (obj[state.lang] ?? obj.ar)) || '';

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

function waLink(dish) {
  const lines = [t().waIntro];
  if (dish) lines.push(`• ${L(dish.name)}${dish.price != null ? ` — ${dish.price} ${t().currencyShort}` : ''}`);
  lines.push(`(${t().waFrom})`);
  const num = `${COUNTRY_CODE}${state.menu.restaurant.whatsapp}`;
  return `https://wa.me/${num}?text=${encodeURIComponent(lines.join('\n'))}`;
}

const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICON_WA = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.2s-.7 1-.9 1.2c-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.5-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 1.9.8 2.7.9 3.6.8.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2A10 10 0 0 0 3.5 17.3L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.9.9-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>`;

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

  $('#ctaOrder').innerHTML = `${ICON_WA}<span>${esc(ui.orderWhatsapp)}</span>`;
  $('#ctaOrder').href = waLink(null);
  $('#ctaMenu').textContent = ui.viewMenu;
  $('#barOrder').innerHTML = `${ICON_WA}<span>${esc(ui.orderWhatsapp)}</span>`;
  $('#barOrder').href = waLink(null);

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
  $('#printBtn').textContent = ui.print;

  $('#ordersValue').innerHTML = `<a href="${waLink(null)}" dir="ltr">${esc(r.whatsapp)}</a>`;
  $('#feedbackValue').innerHTML = `<a href="tel:+${COUNTRY_CODE}${r.feedbackPhone}" dir="ltr">${esc(r.feedbackPhone)}</a>`;
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
  const q = state.query.trim().toLowerCase();
  return state.menu.dishes.filter(d => {
    if (state.category !== 'all' && d.category !== state.category) return false;
    if (!q) return true;
    const hay = [d.name.ar, d.name.fr, d.name.en, d.desc?.ar, d.desc?.fr, d.desc?.en]
      .filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  });
}

function cardHTML(d) {
  const img = imageAttrs(d.image, '(min-width:900px) 33vw, (min-width:560px) 50vw, 100vw');
  const lq = state.lqip[d.image];
  const media = img
    ? `<img src="${img.src}" srcset="${img.srcset}" sizes="${img.sizes}"
           alt="${esc(L(d.name))}" loading="lazy" decoding="async" width="800" height="800">`
    : `<span class="card__noimg">${esc(t().noImage)}</span>`;

  return `<button type="button" class="card" data-id="${d.id}">
    <span class="card__media"${lq ? ` style="--lqip:url(${lq})"` : ''}>
      ${media}
      <span class="card__price">${esc(priceLabel(d))}</span>
    </span>
    <span class="card__body">
      <h3 class="card__name">${esc(L(d.name))}</h3>
      <p class="card__desc">${esc(L(d.desc))}</p>
    </span>
  </button>`;
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
          <a class="btn btn--wa" href="${waLink(d)}" target="_blank" rel="noopener">
            ${ICON_WA}<span>${esc(t().orderThis)}</span></a>
        </div>
        ${related.length ? `<div class="related">
          <h4>${esc(t().alsoInCategory)}</h4>
          <div class="related__list">${related.map(r => {
            const ri = imageAttrs(r.image, '108px');
            return `<button type="button" class="related__item" data-id="${r.id}">
              ${ri ? `<img src="assets/dishes/${r.image}-400.webp" alt="" loading="lazy" width="108" height="108">` : ''}
              <span>${esc(L(r.name))}</span>
              <b>${esc(priceLabel(r))}</b>
            </button>`; }).join('')}</div>
        </div>` : ''}
      </div>
    </div>`;

  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
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
  localStorage.setItem(STORE_KEY, code);
  applyLangAttrs();
  renderChrome();
  renderGrid();
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
    const card = e.target.closest('.card');
    if (card) openDish(card.dataset.id);
  });

  const dlg = $('#dish');
  dlg.addEventListener('click', e => {
    if (e.target.closest('#dishClose')) return closeDish();
    const lang = e.target.closest('[data-lang]');
    if (lang) return setLang(lang.dataset.lang);
    const rel = e.target.closest('.related__item');
    if (rel) return openDish(rel.dataset.id);
    // النقر على الخلفية خارج الورقة يغلقها
    if (e.target === dlg) closeDish();
  });
  dlg.addEventListener('close', () => { state.openDish = null; });

  $('#printBtn').addEventListener('click', () => window.print());
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

  renderChrome();
  renderGrid();
  bind();
  document.body.classList.add('ready');
}

boot().catch(err => {
  console.error(err);
  document.getElementById('menu').innerHTML =
    '<p class="empty">تعذّر تحميل القائمة. حدِّث الصفحة.<br>Impossible de charger le menu.<br>Could not load the menu.</p>';
});
