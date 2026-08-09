/* =========================================================
   Service Worker — قائمة عمو عزيز
   ---------------------------------------------------------
   الهدف: أن تفتح القائمة فوراً في الزيارة الثانية، وأن تعمل
   داخل المطعم حيث الشبكة ضعيفة أو منقطعة.

   الاستراتيجية:
     • هيكل الصفحة والكود والخطوط → cache-first (لا تتغيّر إلا مع إصدار جديد)
     • الصور                     → cache-first (ثابتة، ولها بصمة في اسمها)
     • data/menu.json            → stale-while-revalidate (الأسعار قد تتغيّر:
                                    نعرض المحفوظ فوراً ونحدّثه في الخلفية)
     • التنقّل بلا إنترنت        → نُرجع index.html المحفوظة

   لتحديث الزوار بعد أي تعديل: زِد cacheVersion في js/config.js
   ثم انسخ القيمة نفسها إلى VERSION أدناه.
   ========================================================= */

const VERSION = 'v2';
const SHELL = `amoaziz-shell-${VERSION}`;
const MEDIA = `amoaziz-media-${VERSION}`;
const DATA  = `amoaziz-data-${VERSION}`;

/* ما يُحمَّل مسبقاً عند أول زيارة: ما تحتاجه الصفحة لترسم نفسها.
   الصور غير مذكورة عمداً — تُحفَظ عند أول عرض فعلي حتى لا نستهلك
   بيانات الزائر في تنزيل 60 صورة قد لا يراها. */
const SHELL_URLS = [
  './',
  'index.html',
  'catalog/',
  'catalog/index.html',
  'catalog/catalog.css',
  'catalog/catalog.js',
  'css/styles.css',
  'css/fonts.css',
  'js/app.js',
  'js/core.js',
  'js/cart-ui.js',
  'js/i18n.js',
  'js/config.js',
  'manifest.webmanifest',
  'assets/fonts/plexar-arabic-400.woff2',
  'assets/fonts/plexar-arabic-700.woff2',
  'assets/brand/logo-mark-light-256.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  const keep = new Set([SHELL, MEDIA, DATA]);
  e.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => !keep.has(n)).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

/** يحفظ نسخة ناجحة ويُرجع الرد كما هو. */
async function cachePut(cacheName, request, response) {
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function cacheFirst(request, cacheName) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  return cachePut(cacheName, request, res);
}

/** يعرض المحفوظ فوراً ويحدّثه في الخلفية للزيارة القادمة. */
async function staleWhileRevalidate(request, cacheName) {
  const hit = await caches.match(request);
  const network = fetch(request)
    .then((res) => cachePut(cacheName, request, res))
    .catch(() => null);
  return hit || network.then((res) => res || Response.error());
}

self.addEventListener('fetch', (e) => {
  const { request } = e;

  // نتعامل مع طلبات GET من نفس الأصل فقط — واتساب والخرائط تمرّ كما هي
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    // بلا إنترنت: نُرجع الصفحة المطلوبة نفسها لا الرئيسية دائماً،
    // وإلا وجد من حفظ رابط الكتالوج الواجهة الكاملة مكانه.
    const fallback = url.pathname.includes('/catalog') ? 'catalog/index.html' : 'index.html';
    e.respondWith(
      fetch(request)
        .then((res) => cachePut(SHELL, request, res))
        .catch(() => caches.match(fallback).then((r) => r || caches.match('./')))
    );
    return;
  }

  if (url.pathname.endsWith('/data/menu.json') || url.pathname.endsWith('/manifest.json')) {
    e.respondWith(staleWhileRevalidate(request, DATA));
    return;
  }

  if (/\.(?:webp|png|jpg|jpeg|svg|woff2)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(request, MEDIA));
    return;
  }

  if (/\.(?:css|js|webmanifest)$/.test(url.pathname)) {
    e.respondWith(cacheFirst(request, SHELL));
  }
});
