#!/usr/bin/env node
/**
 * apply-brand.mjs
 * ---------------------------------------------------------------
 * ينشر هوية التطبيق من brand.config.json إلى كل نقاط الاستهلاك.
 *
 * مبدأ التصميم:
 *   brand.config.json هو مصدر الحقيقة الوحيد.
 *   لا يُكتب اسم التطبيق حرفياً في أي ملف مصدري إطلاقاً.
 *
 * الاستخدام:
 *   node scripts/apply-brand.mjs
 *   node scripts/apply-brand.mjs --check    (تحقق فقط، للـ CI)
 * ---------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CHECK = process.argv.includes('--check');

const brandPath = path.join(ROOT, 'brand.config.json');
if (!fs.existsSync(brandPath)) {
  console.error('✖ brand.config.json غير موجود');
  process.exit(1);
}

const brand = JSON.parse(fs.readFileSync(brandPath, 'utf8'));

// ─── تحقق من الصحة ────────────────────────────────────────────────
const errors = [];
if (!brand.appKey || !/^[a-z][a-z0-9-]*$/.test(brand.appKey)) {
  errors.push('appKey يجب أن يكون أحرفاً صغيرة/أرقام/شرطات ويبدأ بحرف');
}
if (!brand.appId || !/^[a-zA-Z0-9.-]+$/.test(brand.appId)) {
  errors.push('appId غير صالح (مثال صحيح: com.company.shipping)');
}
if (!brand.name?.ar || !brand.name?.en) errors.push('name.ar و name.en مطلوبان');
for (const [k, v] of Object.entries(brand.theme || {})) {
  if (k.startsWith('logo') || k.startsWith('icon')) continue;
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) errors.push(`theme.${k} ليس لوناً صالحاً: ${v}`);
}
if (errors.length) {
  console.error('\n✖ brand.config.json فيه أخطاء:');
  errors.forEach((e) => console.error('   - ' + e));
  process.exit(1);
}

const written = [];
function write(rel, content) {
  const abs = path.join(ROOT, rel);
  if (CHECK) {
    const cur = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
    if (cur !== content) {
      console.error(`✖ غير متزامن: ${rel}`);
      process.exitCode = 1;
    }
    return;
  }
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  written.push(rel);
}

const banner = '// مُولَّد آلياً من brand.config.json — لا تعدّله يدوياً.\n// شغّل: node scripts/apply-brand.mjs\n\n';

// ─── 1) هوية الواجهة ──────────────────────────────────────────────
write(
  'client/src/config/brand.ts',
  banner +
    `export const BRAND = ${JSON.stringify(brand, null, 2)} as const;

export type Locale = 'ar' | 'en';

export function appName(locale: Locale = BRAND.locale.default as Locale): string {
  return BRAND.name[locale] ?? BRAND.name.ar;
}

export function shortName(locale: Locale = BRAND.locale.default as Locale): string {
  return BRAND.shortName[locale] ?? BRAND.shortName.ar;
}

export function tagline(locale: Locale = BRAND.locale.default as Locale): string {
  return BRAND.tagline[locale] ?? BRAND.tagline.ar;
}

export function pageTitle(section?: string, locale: Locale = BRAND.locale.default as Locale): string {
  const base = appName(locale);
  return section ? \`\${section} — \${base}\` : base;
}

export const isRTL = BRAND.locale.direction === 'rtl';
export const FEATURES = BRAND.features;
`
);

// ─── 2) هوية الخادم ───────────────────────────────────────────────
write(
  'server/src/shared/branding/brand.ts',
  banner +
    `export const BRAND = ${JSON.stringify(brand, null, 2)} as const;

export function appName(locale: 'ar' | 'en' = 'ar'): string {
  return BRAND.name[locale] ?? BRAND.name.ar;
}

/** يُستخدم في ترويسات الطباعة وتذييل التقارير */
export function documentHeader(locale: 'ar' | 'en' = 'ar') {
  return {
    title: appName(locale),
    company: BRAND.company[locale] ?? BRAND.company.ar,
    website: BRAND.support.website,
    phone: BRAND.support.phone,
  };
}

export const FEATURES = BRAND.features;
`
);

// ─── 3) متغيرات CSS ───────────────────────────────────────────────
write(
  'client/src/styles/brand.css',
  `/* مُولَّد آلياً من brand.config.json — لا تعدّله يدوياً. */
:root {
  --brand-primary: ${brand.theme.primary};
  --brand-accent: ${brand.theme.accent};
  --brand-danger: ${brand.theme.danger};
}
html[dir='rtl'] body { text-align: right; }
`
);

// ─── 4) عنوان صفحة الويب ──────────────────────────────────────────
write(
  'client/index.html',
  `<!doctype html>
<html lang="${brand.locale.default}" dir="${brand.locale.direction}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="${brand.theme.primary}" />
    <meta name="description" content="${brand.tagline[brand.locale.default]}" />
    <title>${brand.name[brand.locale.default]}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
);

// ─── 5) بيان تطبيق الويب (PWA) ────────────────────────────────────
write(
  'client/public/manifest.webmanifest',
  JSON.stringify(
    {
      name: brand.name[brand.locale.default],
      short_name: brand.shortName[brand.locale.default],
      description: brand.tagline[brand.locale.default],
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: brand.theme.primary,
      dir: brand.locale.direction,
      lang: brand.locale.default,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
    null,
    2
  ) + '\n'
);

// ─── 6) هوية Electron ─────────────────────────────────────────────
write(
  'electron/brand.json',
  JSON.stringify(
    {
      appId: brand.appId,
      productName: brand.name[brand.locale.default],
      shortName: brand.shortName[brand.locale.default],
      primary: brand.theme.primary,
      icon: brand.theme.icon,
      iconIco: brand.theme.iconIco,
      defaultWebPort: brand.deployment.defaultWebPort,
      defaultApiPort: brand.deployment.defaultApiPort,
    },
    null,
    2
  ) + '\n'
);

// ─── 7) تحديث package.json الجذري ─────────────────────────────────
const pkgPath = path.join(ROOT, 'package.json');
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const nextName = brand.appKey;
  const nextProduct = brand.name[brand.locale.default];
  if (CHECK) {
    if (pkg.name !== nextName || pkg.productName !== nextProduct) {
      console.error('✖ غير متزامن: package.json');
      process.exitCode = 1;
    }
  } else if (pkg.name !== nextName || pkg.productName !== nextProduct) {
    pkg.name = nextName;
    pkg.productName = nextProduct;
    pkg.description = brand.tagline[brand.locale.default];
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    written.push('package.json');
  }
}

// ─── التقرير ──────────────────────────────────────────────────────
if (CHECK) {
  if (process.exitCode) {
    console.error('\n✖ الهوية غير متزامنة. شغّل: node scripts/apply-brand.mjs\n');
  } else {
    console.log('✔ الهوية متزامنة.');
  }
} else {
  console.log(`\n✔ تم تطبيق الهوية: \x1b[1m${brand.name.ar}\x1b[0m  (${brand.appId})\n`);
  written.forEach((w) => console.log('   • ' + w));
  console.log('\n  لتغيير اسم البرنامج: عدّل brand.config.json ثم أعد تشغيل هذا الأمر.\n');
}
