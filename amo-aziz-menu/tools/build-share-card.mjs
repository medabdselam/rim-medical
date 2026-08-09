/* =========================================================
   مولّد صورة معاينة المشاركة — assets/brand/share-card-1200x630.jpg
   ---------------------------------------------------------
       node tools/build-share-card.mjs        (يتطلب playwright)

   يركّب البطاقة من صور المطعم وخطوطه الحقيقية داخل متصفح ثم
   يلتقطها بصيغة JPEG. سبب JPEG: واتساب لا يعرض WebP بثبات في
   معاينة الروابط، وPNG بهذا الحجم يتجاوز الحد الذي تقبله بعض
   التطبيقات. النص كبير عمداً لأنه يُعرَض مصغَّراً في المحادثة.

   لا تحتاج إعادة تشغيله إلا إذا تغيّر الاسم أو الشعار أو صورة
   الواجهة — الناتج ملف ثابت مرفوع مع المشروع.
   ========================================================= */

import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const menu = JSON.parse(await readFile(join(root, 'data/menu.json'), 'utf8'));
const r = menu.restaurant;

const b64 = async (p, mime) =>
  `data:${mime};base64,${(await readFile(join(root, p))).toString('base64')}`;

/* ثلاثة أطباق تمثّل الأقسام الثلاثة — أفضل من صورة الواجهة لأن
   لوحة المطعم تحمل الاسم والشعار مكتوبين، فتتكرّر مع نص البطاقة. */
const HERO_DISHES = ['mansaf-mashawi', 'pizza-stuffed-crust', 'manakish-lahm'];
const dishes = await Promise.all(
  HERO_DISHES.map((slug) => b64(`assets/dishes/${slug}-800.webp`, 'image/webp'))
);
const logo = await b64('assets/brand/logo-mark-light-512.png', 'image/png');
const font400 = await b64('assets/fonts/plexar-arabic-400.woff2', 'font/woff2');
const font700 = await b64('assets/fonts/plexar-arabic-700.woff2', 'font/woff2');

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face { font-family: PlexAr; src: url(${font400}) format('woff2'); font-weight: 400; }
@font-face { font-family: PlexAr; src: url(${font700}) format('woff2'); font-weight: 700; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; font-family: PlexAr, sans-serif; background: #101215; }

.card { position: relative; width: 1200px; height: 630px; overflow: hidden; background: #101215; }

/* شريط الصور يملأ الأعلى، والنص يجلس على قاعدة داكنة صلبة أسفله
   حتى يبقى مقروءاً مهما كانت ألوان الصور. */
.strip-imgs { position: absolute; inset: 0 0 auto; height: 340px; display: flex; }
.strip-imgs img { width: 33.334%; height: 100%; object-fit: cover; }
.strip-imgs::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(16,18,21,.10) 0%, rgba(16,18,21,.30) 55%, #101215 100%);
}
/* خط ذهبي رفيع يفصل الصور عن قاعدة النص */
.rule {
  position: absolute; inset-block-start: 338px; inset-inline: 0; height: 3px; z-index: 2;
  background: linear-gradient(90deg, transparent, #CBA95F 22%, #B8801F 78%, transparent);
}

.body {
  position: absolute; inset: 300px 0 26px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; text-align: center; padding: 0 64px;
  background: linear-gradient(180deg, transparent 0%, #101215 14%);
}
.logo { width: 132px; margin-bottom: 14px; filter: drop-shadow(0 6px 22px rgba(0,0,0,.7)); }
h1 {
  font-size: 76px; font-weight: 700; line-height: 1.05; color: #F4EDE1;
  letter-spacing: -.5px;
}
.tag { margin-top: 12px; font-size: 34px; font-weight: 400; color: #CFC7BA; }
.strip {
  margin-top: 26px; display: flex; align-items: center; gap: 18px;
  background: linear-gradient(180deg, #CBA95F, #B8801F);
  color: #1A1408; font-weight: 700; font-size: 33px;
  padding: 15px 44px; border-radius: 999px;
  box-shadow: 0 10px 34px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.4);
}
.strip .dot { width: 10px; height: 10px; border-radius: 50%; background: #1A1408; opacity: .5; }
</style></head><body>
<div class="card">
  <div class="strip-imgs">${dishes.map((src) => `<img src="${src}">`).join('')}</div>
  <div class="rule"></div>
  <div class="body">
    <img class="logo" src="${logo}">
    <h1>${r.name.ar}</h1>
    <div class="tag">${r.tagline.ar}</div>
    <div class="strip"><span>قائمة الطعام</span><span class="dot"></span><span>Menu</span></div>
  </div>
</div>
</body></html>`;

/* CHROMIUM_PATH يفيد في البيئات التي فيها متصفح مثبَّت مسبقاً
   بإصدار مختلف عن الذي يتوقّعه playwright. اتركه فارغاً محلياً. */
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const buf = await page.screenshot({ type: 'jpeg', quality: 88 });
await browser.close();

const out = 'assets/brand/share-card-1200x630.jpg';
await writeFile(join(root, out), buf);
console.log(`✔ ${out} — ${(buf.length / 1024).toFixed(0)} KB`);
