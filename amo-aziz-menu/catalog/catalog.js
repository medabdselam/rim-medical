/* =========================================================
   الكتالوج — واجهة المشاركة
   ---------------------------------------------------------
   نفس البيانات ونفس السلة ونفس رسالة واتساب كالواجهة الكاملة،
   بعرض مختلف: صفوف مضغوطة، بلا صورة واجهة وبلا بحث وبلا نافذة طبق.

   لماذا واجهة ثانية بدل صفحة واحدة؟ لأن من يفتح الرابط من واتساب
   قرّر الطلب أصلاً — يريد الأسعار وزر الإضافة، لا جولة تعريفية.
   ولماذا لا تُنسَخ البيانات؟ لأن نسختين من الأسعار تتباعدان أول
   مرة يتغيّر سعر. كلتاهما تقرأ data/menu.json.
   ========================================================= */

import { LANGS } from '../js/i18n.js';
import { CONFIG } from '../js/config.js';
import {
  state, setBase, $, $$, t, L, esc, readLang, storeLang, applyLangAttrs,
  loadMenu, loadCart, imageAttrs, priceLabel, setQty, addToCart,
  onCartChange, ICON_SHARE, shareLink,
} from '../js/core.js';
import { mountCart } from '../js/cart-ui.js';

/* الكتالوج في مجلد فرعي، فكل المسارات تصعد درجة */
setBase('../');

const CATALOG_URL = `${CONFIG.siteUrl}/catalog/`;

/* ------------------------------------------------------------------ العرض */

function renderChrome() {
  const ui = t();
  const r = state.menu.restaurant;

  $('#brandName').textContent = L(r.shortName);
  $('#tagline').textContent = L(r.tagline);
  $('#fullSite').textContent = ui.fullSite;
  $('#shareBtn').innerHTML = `${ICON_SHARE}<span>${esc(ui.share)}</span>`;

  $('#langs').innerHTML = Object.values(LANGS).map(l => `
    <button type="button" data-lang="${l.code}" aria-pressed="${l.code === state.lang}"
            title="${esc(l.label)}">${esc(l.short)}</button>`).join('');

  $('#cats').innerHTML = state.menu.categories.map(c =>
    `<a href="#sec-${c.id}">${esc(L(c.name))}</a>`).join('');
}

function rowHTML(d) {
  const img = imageAttrs(d.image, '76px');
  const lq = state.lqip[d.image];
  const qty = state.cart[d.id] || 0;
  const desc = L(d.desc);

  return `
    <li class="crow" data-id="${d.id}">
      <div class="crow__media"${lq ? ` style="--lqip:url('${lq}')"` : ''}>
        ${img ? `<img src="${img.src}" srcset="${img.srcset}" sizes="${img.sizes}"
              alt="${esc(L(d.name))}" loading="lazy" decoding="async" width="76" height="76">`
              : `<span class="crow__noimg">${esc(t().noImage)}</span>`}
      </div>
      <div class="crow__txt">
        <h3 class="crow__name">${esc(L(d.name))}</h3>
        ${desc ? `<p class="crow__desc">${esc(desc)}</p>` : ''}
        <div class="crow__price">${esc(priceLabel(d))}</div>
      </div>
      <div class="crow__act">${stepperHTML(d.id, qty)}</div>
    </li>`;
}

/** زر إضافة واحد ما دامت الكمية صفراً، ثم عدّاد — أقل ضجيجاً بصرياً. */
function stepperHTML(id, qty) {
  const ui = t();
  if (qty === 0) {
    return `<button type="button" class="cadd" data-add="${id}"
                    aria-label="${esc(ui.addToCart)}">+</button>`;
  }
  return `<div class="cstep" role="group" aria-label="${esc(ui.qty)}">
      <button type="button" data-step="-1" data-id="${id}" aria-label="${esc(ui.decrease)}">−</button>
      <output data-qty="${id}">${qty}</output>
      <button type="button" data-step="1" data-id="${id}" aria-label="${esc(ui.increase)}">+</button>
    </div>`;
}

function renderList() {
  $('#list').innerHTML = state.menu.categories.map(c => {
    const dishes = state.menu.dishes.filter(d => d.category === c.id);
    if (!dishes.length) return '';
    return `
      <section class="csec" id="sec-${c.id}">
        <h2 class="csec__h">${esc(L(c.name))} <span>${esc(t().dishCount(dishes.length))}</span></h2>
        <ul class="csec__list">${dishes.map(rowHTML).join('')}</ul>
      </section>`;
  }).join('');
}

/** يحدّث عمود التحكم لصنف واحد بدل إعادة رسم القائمة كلها. */
function syncRow(id) {
  const row = $(`.crow[data-id="${CSS.escape(id)}"]`);
  if (!row) return;
  row.querySelector('.crow__act').innerHTML = stepperHTML(id, state.cart[id] || 0);
}

const syncAllRows = () => $$('.crow').forEach(r => syncRow(r.dataset.id));

/* ------------------------------------------------------------------ التحكم */

function setLang(code) {
  if (!LANGS[code] || code === state.lang) return;
  const y = window.scrollY;
  state.lang = code;
  storeLang(code);
  applyLangAttrs();
  renderChrome();
  renderList();
  window.scrollTo({ top: y });
}

let toastTimer;
function toast(msg) {
  let el = $('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2600);
}

function bind() {
  $('#langs').addEventListener('click', e => {
    const b = e.target.closest('[data-lang]');
    if (b) setLang(b.dataset.lang);
  });

  $('#list').addEventListener('click', e => {
    const add = e.target.closest('[data-add]');
    if (add) { addToCart(add.dataset.add); return; }
    const step = e.target.closest('[data-step]');
    if (step) {
      const id = step.dataset.id;
      setQty(id, Math.max(0, (state.cart[id] || 0) + Number(step.dataset.step)));
    }
  });

  $('#shareBtn').addEventListener('click', () => shareLink(CATALOG_URL, toast));
}

/* --------------------------------------------------------------- الإقلاع */

async function boot() {
  state.lang = readLang();
  applyLangAttrs();

  await loadMenu();

  loadCart();
  renderChrome();
  renderList();
  bind();

  mountCart({ onBrowse: () => {
    $('#cats').scrollIntoView({ block: 'start' });
    toast(t().cartEmptyHint);
  }});
  onCartChange(syncAllRows);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  // نطاق الخدمة هو جذر الموقع حتى تخدم الواجهتين بكاش واحد
  const go = () => navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
  if (document.readyState === 'complete') go();
  else addEventListener('load', go, { once: true });
}

boot().then(registerSW).catch(err => {
  console.error(err);
  $('#list').innerHTML =
    '<p class="empty">تعذّر تحميل القائمة. حدِّث الصفحة.<br>Impossible de charger le menu.<br>Could not load the menu.</p>';
});
