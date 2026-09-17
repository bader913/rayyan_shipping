#!/usr/bin/env node
/**
 * extract-client-closure.mjs
 * ---------------------------------------------------------------
 * ينسخ الإغلاق الأدنى لتبعيات الواجهة: يبدأ من صفحات الشحن
 * ويمشي على شجرة الاستيرادات، فينسخ ما هو مطلوب فعلاً فقط.
 *
 * لماذا؟
 *   نسخ مجلد utils/ كاملاً يجرّ عشرات الملفات خارج النطاق
 *   (طباعة مطاعم، مخزون، نقطة بيع...) وكل واحد يجرّ تبعياته.
 *   المشي على الشجرة ينسخ الإغلاق الدقيق فقط.
 *
 * قراءة فقط من المصدر — لا يكتب ولا يعدّل شيئاً في Rayyan Pro.
 *
 * الاستخدام:
 *   node scripts/extract-client-closure.mjs --src D:\rayyan-pro --dry-run
 *   node scripts/extract-client-closure.mjs --src D:\rayyan-pro
 * ---------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const srcIdx = argv.indexOf('--src');
const SRC = srcIdx >= 0 ? argv.at(srcIdx + 1) : null;
const DRY = argv.includes('--dry-run');

if (!SRC) {
  console.error('\n✖ مطلوب: --src <مسار Rayyan Pro>\n');
  process.exit(1);
}

const SRC_CLIENT = path.join(path.resolve(SRC), 'client', 'src');
const DEST_CLIENT = path.join(ROOT, 'client', 'src');

if (!fs.existsSync(SRC_CLIENT)) {
  console.error(`\n✖ غير موجود: ${SRC_CLIENT}\n`);
  process.exit(1);
}

// ─── نقاط البداية: صفحات الشحن فقط ───────────────────────────────
const ROOTS = [
  'pages/ShippingPage.tsx',
  'pages/ShippingPortalPage.tsx',
  'pages/ShippingSupervisorDashboard.tsx',
  'pages/RepresentativeShippingPortalPage.tsx',
  'pages/RepresentativeSupervisorDashboard.tsx',
];

// امتدادات نحاولها عند غياب اللاحقة
const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];

// أصول ثنائية تُنسخ كما هي دون تتبّع
const ASSET_RE = /\.(wav|mp3|ogg|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|css)$/i;

const visited = new Set();
const copied = [];
const missing = [];
const externals = new Set();

/** يحوّل استيراداً نسبياً إلى مسار ملف حقيقي داخل client/src */
function resolveImport(fromRel, spec) {
  if (!spec.startsWith('.')) return null; // حزمة خارجية
  const fromDir = path.dirname(fromRel);
  const guess = path.normalize(path.join(fromDir, spec)).replace(/\\/g, '/');

  for (const ext of EXTS) {
    const candidate = guess + ext;
    const abs = path.join(SRC_CLIENT, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return candidate;
  }
  return null;
}

/** يستخرج كل محددات الاستيراد/التصدير من ملف */
function extractSpecifiers(code) {
  const specs = [];
  const patterns = [
    /\bimport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g, // import x from 'y'
    /\bimport\s*['"]([^'"]+)['"]/g,                  // import 'y'
    /\bexport\s+[^'"]*?\bfrom\s*['"]([^'"]+)['"]/g,  // export ... from 'y'
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,        // import('y')
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) {
      const g = m.at(1);
      if (g) specs.push(g);
    }
  }
  return specs;
}

/** المشي التعاودي على شجرة الاستيرادات */
function walk(rel) {
  const key = rel.replace(/\\/g, '/');
  if (visited.has(key)) return;
  visited.add(key);

  const abs = path.join(SRC_CLIENT, key);
  if (!fs.existsSync(abs)) {
    missing.push(key);
    return;
  }

  const dest = path.join(DEST_CLIENT, key);

  // أصل ثنائي: انسخ وتوقّف عن التتبّع
  if (ASSET_RE.test(key)) {
    if (!DRY) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(abs, dest);
    }
    copied.push(key);
    return;
  }

  const code = fs.readFileSync(abs, 'utf8');

  if (!DRY) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, code, 'utf8');
  }
  copied.push(key);

  for (const spec of extractSpecifiers(code)) {
    if (!spec.startsWith('.')) {
      // حزمة خارجية — سجّل اسم الجذر فقط
      const pkg = spec.startsWith('@')
        ? spec.split('/').slice(0, 2).join('/')
        : spec.split('/').at(0);
      externals.add(pkg);
      continue;
    }
    const resolved = resolveImport(key, spec);
    if (resolved) walk(resolved);
    else missing.push(`${spec}  (من ${key})`);
  }
}

// ─── التنفيذ ─────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   إغلاق تبعيات الواجهة                              ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`  المصدر : ${SRC_CLIENT}`);
console.log(`  الوضع  : ${DRY ? 'معاينة' : 'نسخ فعلي'}\n`);

for (const r of ROOTS) {
  if (fs.existsSync(path.join(SRC_CLIENT, r))) walk(r);
  else missing.push(`ROOT: ${r}`);
}

// ─── التقرير ─────────────────────────────────────────────────────
const byDir = new Map();
for (const f of copied) {
  const d = path.dirname(f);
  byDir.set(d, (byDir.get(d) || 0) + 1);
}

console.log(`  ✔ ملفات في الإغلاق: ${copied.length}\n`);
for (const [d, n] of [...byDir].sort()) {
  console.log(`     ${d.padEnd(34)} ${n}`);
}

if (externals.size) {
  const list = [...externals].sort();
  console.log(`\n  📦 حزم خارجية مطلوبة (${list.length}):`);
  console.log('     ' + list.join('  '));
  console.log('\n     npm install ' + list.join(' ') + ' --workspace client');
}

if (missing.length) {
  console.log(`\n  ⚠ غير محلولة (${missing.length}):`);
  [...new Set(missing)].slice(0, 40).forEach((m) => console.log('     - ' + m));
}

if (DRY) console.log('\n  معاينة فقط — لم يُكتب شيء.');
console.log('');
