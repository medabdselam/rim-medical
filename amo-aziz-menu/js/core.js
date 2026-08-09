/* =========================================================
   النواة المشتركة بين الواجهتين
   ---------------------------------------------------------
   الموقع له واجهتان تعرضان القائمة نفسها:
     index.html   — الواجهة الكاملة: صورة الواجهة، الشيف، بحث، تفاصيل الطبق
     catalog/     — كتالوج مختصر سريع، مخصّص لمن يفتح الرابط من واتساب

   كل ما يمسّ البيانات أو الأسعار أو السلة أو رسالة الطلب موجود هنا،
   ويُستورَد في الاثنتين. الفرق بينهما في العرض فقط — فيستحيل أن يرى
   زبون سعراً في واجهة ويرى غيره في الأخرى.
   ========================================================= */

import { LANGS, DEFAULT_LANG, UI } from './i18n.js';

export const LANG_KEY = 'amoaziz.lang';
export const CART_KEY = 'amoaziz.cart';
export const SIZES = [400, 800, 1200];

/** المسار إلى جذر الموقع من الصفحة الحالية. الكتالوج في مجلد فرعي،
    فيحتاج '../' للوصول إلى assets و data. */
export let BASE = '';
export const setBase = (b) => { BASE = b; };

export const state = {
  lang: DEFAULT_LANG,
  menu: null,
  lqip: {},
  cart: {},        // { dishId: quantity }
  note: '',
};

export const $  = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const t = () => UI[state.lang];
export const L = (obj) => (obj && (obj[state.lang] ?? obj.ar)) || '';

export const esc = (s) => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* تطبيع النص قبل البحث: يوحّد صور الألف والهمزة والتاء المربوطة والألف
   المقصورة، ويحذف التشكيل والتطويل. بدونه لا يجد من كتب «منقوشه» شيئاً. */
const AR_MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
export function norm(s) {
  return String(s).toLowerCase()
    .replace(AR_MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/[ئى]/g, 'ي')
    .replace(/ة/g, 'ه')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // لكنات الفرنسية: é → e
    .replace(/\s+/g, ' ')
    .trim();
}

/* العربية هي اللغة الافتراضية دائماً. لا نستشعر لغة المتصفح: زبائن المطعم
   عرب، ولغة الجهاز قد تكون فرنسية أو إنجليزية دون أن تكون هي المطلوبة.
   نحترم فقط اختياراً صريحاً سبق أن حفظه المستخدم — والاختيار مشترك بين
   الواجهتين، فمن اختار الفرنسية في إحداهما يجدها في الأخرى. */
export function readLang() {
  const saved = localStorage.getItem(LANG_KEY);
  return (saved && LANGS[saved]) ? saved : DEFAULT_LANG;
}

export function storeLang(code) {
  localStorage.setItem(LANG_KEY, code);
}

export function applyLangAttrs() {
  const { code, dir } = LANGS[state.lang];
  document.documentElement.lang = code;
  document.documentElement.dir = dir;
}

/** يجلب القائمة وبصمات الصور المضبّبة. */
export async function loadMenu() {
  const [menu, lqip] = await Promise.all([
    fetch(`${BASE}data/menu.json`).then(r => r.json()),
    fetch(`${BASE}assets/dishes/manifest.json`).then(r => r.json()).catch(() => ({})),
  ]);
  state.menu = menu;
  // المانيفست يحمل حقولاً أخرى؛ لا نحتاج سوى الصورة المصغّرة المضبّبة
  state.lqip = Object.fromEntries(Object.entries(lqip).map(([k, v]) => [k, v.lqip]));
  return menu;
}

/** يبني srcset لصورة طبق. يعيد null إذا لم تكن هناك صورة. */
export function imageAttrs(slug, sizesAttr) {
  if (!slug) return null;
  return {
    src: `${BASE}assets/dishes/${slug}-800.webp`,
    srcset: SIZES.map(w => `${BASE}assets/dishes/${slug}-${w}.webp ${w}w`).join(', '),
    sizes: sizesAttr,
  };
}

export function priceLabel(dish) {
  if (dish.price == null) return L(dish.priceNote) || t().priceOnRequest;
  const unit = dish.priceNote ? ` ${L(dish.priceNote)}` : '';
  return `${dish.price} ${t().currencyShort}${unit}`;
}

/* ------------------------------------------------------------------ السلة */

/* السلة محفوظة تحت مفتاح واحد، فمن أضاف أطباقاً في الكتالوج يجدها
   في الواجهة الكاملة والعكس. */

const listeners = new Set();
/** يسجّل دالة تُستدعى بعد كل تغيير في السلة. تعيد دالة إلغاء التسجيل. */
export function onCartChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach(fn => fn());

export function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '{}');
    state.cart = raw.items && typeof raw.items === 'object' ? raw.items : {};
    state.note = typeof raw.note === 'string' ? raw.note : '';
  } catch { state.cart = {}; state.note = ''; }
}

export function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify({ items: state.cart, note: state.note }));
}

export const dishById = (id) => state.menu.dishes.find(d => d.id === id);

/** أسطر السلة، متجاهلةً أي معرّف لم يعد موجوداً في القائمة. */
export function cartLines() {
  return Object.entries(state.cart)
    .map(([id, qty]) => ({ dish: dishById(id), qty }))
    .filter(l => l.dish && l.qty > 0);
}

export const cartCount = () => cartLines().reduce((n, l) => n + l.qty, 0);

export function cartTotals() {
  let total = 0, onRequest = 0;
  for (const { dish, qty } of cartLines()) {
    if (dish.price == null) onRequest += qty;
    else total += dish.price * qty;
  }
  return { total, onRequest };
}

export function setQty(id, qty) {
  if (qty > 0) state.cart[id] = Math.min(qty, 99);
  else delete state.cart[id];
  saveCart();
  emit();
}

export const addToCart = (id, n = 1) => setQty(id, (state.cart[id] || 0) + n);

export function clearCart() {
  state.cart = {};
  state.note = '';
  saveCart();
  emit();
}

export function setNote(text) {
  state.note = text;
  saveCart();
}

/** رسالة واتساب واحدة تحمل الطلب كاملاً. */
export function orderMessage() {
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
export function waLink() {
  const r = state.menu.restaurant;
  return `https://wa.me/${r.countryCode}${r.whatsapp}?text=${encodeURIComponent(orderMessage())}`;
}

/* ------------------------------------------------------------------ رموز */

export const ICON_WA = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.1-.7.2s-.7 1-.9 1.2c-.2.2-.3.2-.6.1-1.7-.9-2.9-1.6-4-3.5-.3-.5.3-.5.8-1.5.1-.2 0-.4 0-.5s-.7-1.6-.9-2.2c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6 1.9.8 2.7.9 3.6.8.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.2-.6-.4zM12 2A10 10 0 0 0 3.5 17.3L2 22l4.9-1.5A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-2.9.9.9-2.8-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>`;
export const ICON_SEARCH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5" stroke-linecap="round"/></svg>`;
export const ICON_SHARE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5 15.4 6.6M8.6 13.5l6.8 3.9"/></svg>`;

/* ------------------------------------------------------------- المشاركة */

/** يشارك رابط الصفحة عبر ورقة المشاركة الأصلية للنظام، ويسقط إلى نسخ
    الرابط عندما لا تتوفر (أغلب متصفحات سطح المكتب). */
export async function shareLink(url, onToast) {
  const ui = t();
  if (navigator.share) {
    try {
      await navigator.share({ title: ui.shareTitle, text: ui.shareText, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;   // ألغى المستخدم المشاركة
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    onToast(ui.linkCopied);
  } catch {
    onToast(ui.linkCopyFailed);
  }
}
