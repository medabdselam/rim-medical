/* =========================================================
   مولّد بيانات SEO — يُشغَّل يدوياً بعد أي تعديل على القائمة:

       node tools/build-seo.mjs

   يقرأ data/menu.json و js/config.js ثم يكتب:
     • كتلة Schema.org داخل index.html (بين علامتَي SEO:START و SEO:END)
     • sitemap.xml

   لماذا مولِّد بدل التوليد لحظة التشغيل؟ لأن الزاحفات ومعاينات
   واتساب لا تنفّذ JavaScript، ولأن المشروع بلا خطوة بناء: الملفات
   المُولَّدة تُرفَع كما هي وتُقرأ فوراً بلا أي تكلفة على الزائر.
   ========================================================= */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const menu = JSON.parse(await readFile(join(root, 'data/menu.json'), 'utf8'));
const { CONFIG } = await import(join(root, 'js/config.js'));

const base = CONFIG.siteUrl.replace(/\/+$/, '');
const r = menu.restaurant;

/* ---------------------------------------------- Schema.org ---- */

const menuItem = (d) => {
  const item = {
    '@type': 'MenuItem',
    name: d.name.ar,
    ...(d.desc ? { description: d.desc.ar } : {}),
    ...(d.image ? { image: `${base}/assets/dishes/${d.image}-1200.webp` } : {}),
  };
  /* الأصناف بلا سعر ثابت (المنسف مثلاً) تُترك بلا offers بدل
     اختراع رقم — بيانات مهيكلة كاذبة أسوأ من غيابها. */
  if (d.price != null) {
    item.offers = {
      '@type': 'Offer',
      price: String(d.price),
      priceCurrency: 'MRU',
      availability: 'https://schema.org/InStock',
    };
  }
  return item;
};

const schema = {
  '@context': 'https://schema.org',
  '@type': 'Restaurant',
  '@id': `${base}/#restaurant`,
  name: r.name.ar,
  alternateName: [r.name.fr, r.name.en],
  description: r.tagline.ar,
  url: `${base}/`,
  image: `${base}/${CONFIG.shareImage}`,
  telephone: `+${r.countryCode}${r.whatsapp}`,
  address: {
    '@type': 'PostalAddress',
    streetAddress: r.address.ar,
    addressCountry: 'MR',
  },
  servesCuisine: ['Syrian', 'Levantine', 'Pizza'],
  priceRange: (() => {
    const p = menu.dishes.map((d) => d.price).filter((n) => n != null);
    return `${Math.min(...p)}–${Math.max(...p)} MRU`;
  })(),
  paymentAccepted: r.payments.join(', '),
  hasMenu: {
    '@type': 'Menu',
    '@id': `${base}/#menu`,
    name: 'قائمة الطعام',
    inLanguage: ['ar', 'fr', 'en'],
    hasMenuSection: menu.categories.map((c) => ({
      '@type': 'MenuSection',
      name: c.name.ar,
      hasMenuItem: menu.dishes.filter((d) => d.category === c.id).map(menuItem),
    })),
  },
};

const block = `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;

const htmlPath = join(root, 'index.html');
const html = await readFile(htmlPath, 'utf8');
const START = '<!-- SEO:START';
const END = '<!-- SEO:END -->';
const i = html.indexOf(START);
const j = html.indexOf(END);
if (i === -1 || j === -1) throw new Error('علامتا SEO:START / SEO:END غير موجودتين في index.html');

const head = html.slice(0, i);
const startTagEnd = html.indexOf('-->', i) + 3;
const marker = html.slice(i, startTagEnd);
await writeFile(htmlPath, `${head}${marker}\n${block}\n${html.slice(j)}`);

/* ---------------------------------------------- sitemap.xml ---- */

const today = new Date().toISOString().slice(0, 10);

/* صفحة واحدة فقط — القائمة كلها تُعرض في مستند واحد */
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`;
await writeFile(join(root, 'sitemap.xml'), xml);

console.log(`✔ index.html — كتلة Schema.org (${menu.dishes.length} صنفاً في ${menu.categories.length} أقسام)`);
console.log('✔ sitemap.xml');
