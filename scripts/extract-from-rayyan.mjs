#!/usr/bin/env node
/**
 * extract-from-rayyan.mjs
 * ---------------------------------------------------------------
 * ينسخ موديول الشحن + المندوب من مستودع Rayyan Pro إلى هذا المستودع.
 *
 * مبدأ السلامة:  قراءة فقط من المصدر.  لا يكتب، لا يعدّل، لا يحذف
 *                 أي شيء داخل Rayyan Pro إطلاقاً.
 *
 * الاستخدام:
 *   node scripts/extract-from-rayyan.mjs --src /path/to/Rayyan_pro_final
 *   node scripts/extract-from-rayyan.mjs --src ../Rayyan_pro_final --dry-run
 *   node scripts/extract-from-rayyan.mjs --src ../Rayyan_pro_final --with-gl
 *
 * الخيارات:
 *   --src <path>   مسار مستودع Rayyan Pro (إجباري)
 *   --dry-run      عرض ما سيحدث دون كتابة أي ملف
 *   --with-gl      تضمين مهاجرات دفتر الأستاذ العام 154/155 (غير موصى به)
 *   --force        الكتابة فوق ملفات موجودة
 * ---------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ─── تحليل الوسائط ────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argValue(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
}
const DRY = argv.includes('--dry-run');
const WITH_GL = argv.includes('--with-gl');
const FORCE = argv.includes('--force');
const SRC = argValue('--src');

if (!SRC) {
  console.error('\n✖  مطلوب: --src <مسار مستودع Rayyan Pro>');
  console.error('   مثال: node scripts/extract-from-rayyan.mjs --src ../Rayyan_pro_final\n');
  process.exit(1);
}

const SRC_ROOT = path.resolve(SRC);
if (!fs.existsSync(path.join(SRC_ROOT, 'server', 'src', 'modules', 'deliveryShipping'))) {
  console.error(`\n✖  لم يتم العثور على موديول الشحن في: ${SRC_ROOT}`);
  console.error('   تأكد أن المسار يشير إلى جذر مستودع Rayyan_pro_final\n');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
//  قوائم الملفات — مُتحقَّق منها مقابل
//  HEAD 82d33b6050bc888f06c072c539ad159d3b8f874c
//  branch integration/general-hotel-mainline
// ═══════════════════════════════════════════════════════════════

/** موديول الشحن الخادمي — 13 ملف (~277 KB) */
const SHIPPING_SERVER_FILES = [
  'deliveryShipping.router.ts',
  'deliveryShipping.supervisor.ts',
  'deliveryShippingCurrency.service.ts',
  'deliveryShippingExternalSupervisor.ts',
  'deliveryShippingMerchant.router.ts',
  'deliveryShippingMerchantAccess.ts',
  'deliveryShippingMerchantFinancial.service.ts',
  'deliveryShippingMerchantLedger.service.ts',
  'deliveryShippingProfitCenter.service.ts',
  'deliveryShippingRepresentative.router.ts',
  'deliveryShippingRepresentativeAccess.ts',
  'deliveryShippingRestoreIntegrity.ts',
  // deliveryShippingFeature.ts  ← مستبعد عمداً (بوابة ميزة خاصة بـ Rayyan Pro)
];

/** موديول المندوب المحمول — 7 ملفات (~245 KB) */
const REPRESENTATIVE_SERVER_FILES = [
  'representativeMobile.analytics.ts',
  'representativeMobile.auth.ts',
  'representativeMobile.router.ts',
  'representativeMobile.sales.ts',
  'representativeMobile.service.ts',
  'representativeRateQuote.ts',
  'representativeSaleAdmission.ts',
];

/** صفحات الواجهة */
const CLIENT_PAGES = [
  'ShippingPage.tsx',
  'ShippingPortalPage.tsx',
  'ShippingSupervisorDashboard.tsx',
  'RepresentativeShippingPortalPage.tsx',
  'RepresentativeSupervisorDashboard.tsx',
  'RepresentativePairingPage.tsx',
  'RepresentativeAnalyticsPage.tsx',
  'RepresentativeMobileManagementPage.tsx',
  'RepresentativeMobilePOSPage.tsx',
];

/** مجلدات مشتركة تُنقل كما هي (سلطات قائمة — لا تُعاد كتابتها) */
const SHARED_DIRS = [
  'currency',
  'db',
  'middleware',
  'permissions',
  'utils',
  'services',
  'performance',
];

/**
 * مهاجرات الشحن.
 * 154 و 155 = ربط دفتر الأستاذ العام — مستبعدة افتراضياً (المسار أ).
 */
const SHIPPING_MIGRATIONS = [
  '143_delivery_shipping_phase1.sql',
  '144_delivery_shipping_merchant_foundation.sql',
  '145_delivery_shipping_merchant_ledger_authority.sql',
  '146_delivery_shipping_representative_cost_authority.sql',
  '147_delivery_shipping_post_delivery_edit_authority.sql',
  '148_delivery_shipping_cash_settlement_authority.sql',
  '149_delivery_shipping_merchant_currency_identity.sql',
  '150_delivery_shipping_multicurrency_snapshot_authority.sql',
  '151_delivery_shipping_status_history_authority.sql',
  '152_delivery_shipping_representative_cost_currency_authority.sql',
  '153_delivery_shipping_expense_link_authority.sql',
  '158_delivery_shipping_million_scale_listing.sql',
  '159_delivery_shipping_dedicated_representative_foundation.sql',
  '175_delivery_shipping_representative_portal_foundation.sql',
];

const GL_MIGRATIONS = [
  '154_delivery_shipping_gl_posting_authority.sql',
  '155_delivery_shipping_gl_link_seed_repair.sql',
];

/** مهاجرات بنية المندوب المحمول — تشمل المزامنة الأوفلاين ومنع الازدواجية */
const REPRESENTATIVE_MIGRATIONS = [
  '086_representative_mobile_pos_foundation.sql',
  '087_representative_offline_drafts_idempotency.sql',
  '088_representative_currency_stock_visibility.sql',
  '089_financial_idempotency.sql',
  '107_representative_available_products_only.sql',
  '108_representative_warehouse_assignment_history.sql',
  '109_representative_mobile_free_gift_lines.sql',
  '111_representative_mobile_live_location.sql',
  '177_representative_currency_rate_quote_authority.sql',
];

/** مهاجرات أساسية مطلوبة كقاعدة (عملات + إعدادات + مستخدمين) */
const BASE_MIGRATIONS = [
  '122_currency_definitions_foundation.sql',
  '076_custom_user_permissions.sql',
  '132_user_archive_state.sql',
];

// ═══════════════════════════════════════════════════════════════
//  تحويلات النص
// ═══════════════════════════════════════════════════════════════

/**
 * إزالة بوابة الميزة الخاصة بـ Rayyan Pro.
 * في النظام المستقل، الشحن هو النظام كله — لا حاجة لبوابة تفعيل.
 */
function stripFeatureGate(code) {
  let out = code;
  const notes = [];

  // 1) حذف سطور الاستيراد الخاصة بـ deliveryShippingFeature
  const importRe = /^.*import\s*\{[^}]*(?:requireDeliveryShippingFeature|isDeliveryShippingFeatureEnabledAndLicensed)[^}]*\}\s*from\s*['"][^'"]*deliveryShippingFeature[^'"]*['"];?\s*$/gm;
  if (importRe.test(out)) {
    out = out.replace(importRe, '');
    notes.push('حذف استيراد deliveryShippingFeature');
  }

  // 2) إزالة preHandler: requireDeliveryShippingFeature  (مفردة أو ضمن مصفوفة)
  const before = out;
  out = out.replace(/preHandler:\s*requireDeliveryShippingFeature\s*,?/g, '');
  out = out.replace(/(\[\s*)requireDeliveryShippingFeature\s*,\s*/g, '$1');
  out = out.replace(/,\s*requireDeliveryShippingFeature(\s*\])/g, '$1');
  out = out.replace(/(\[\s*)requireDeliveryShippingFeature(\s*\])/g, '$1$2');
  if (out !== before) notes.push('إزالة بوابة requireDeliveryShippingFeature');

  // 3) تحييد أي فحص متبقٍ للترخيص
  if (/isDeliveryShippingFeatureEnabledAndLicensed/.test(out)) {
    out = out.replace(
      /await\s+isDeliveryShippingFeatureEnabledAndLicensed\s*\(\s*\)/g,
      'true /* EXTRACTED: النظام المستقل مُفعّل دائماً */'
    );
    notes.push('تحييد فحص الترخيص');
  }

  // 4) تنظيف preHandler فارغ نتج عن الإزالة
  out = out.replace(/preHandler:\s*\[\s*\]\s*,?/g, '');

  return { code: out, notes };
}

/** إعادة توجيه مسارات الاستيراد للبنية الجديدة */
function rewriteImports(code) {
  let out = code;

  // modules/deliveryShipping/  →  modules/shipping/
  out = out.replace(/(['"])([^'"]*?)modules\/deliveryShipping\//g, '$1$2modules/shipping/');

  // استيراد شقيق نسبي:  ../deliveryShipping/x  →  ../shipping/x
  out = out.replace(/(['"])(\.\.\/)deliveryShipping\//g, '$1$2shipping/');

  // modules/representativeMobile/  →  modules/representative/
  out = out.replace(
    /(['"])([^'"]*?)modules\/representativeMobile\//g,
    '$1$2modules/representative/'
  );
  out = out.replace(/(['"])(\.\.\/)representativeMobile\//g, '$1$2representative/');

  // سلطة التفعيل  →  البديل المستقل
  out = out.replace(
    /(['"])([^'"]*?)shared\/security\/shippingActivation(\.js)?\1/g,
    "$1$2shared/branding/activation$3$1"
  );

  return out;
}

/** تنظيف بقايا تركيبية نتجت عن إزالة البوابة */
function tidySyntax(code) {
  let out = code;
  // كائن خيارات فارغ:  app.get('/x', { }, h)  →  app.get('/x', {}, h)
  out = out.replace(/,\s*\{\s*\}\s*,/g, ', {},');
  // فاصلة زائدة قبل قوس إغلاق
  out = out.replace(/,(\s*[}\]])/g, '$1');
  // أكثر من سطرين فارغين متتاليين
  out = out.replace(/\n{3,}/g, '\n\n');
  return out;
}

/** ترويسة توضّح المصدر */
function provenanceHeader(relPath) {
  return [
    '/* ─────────────────────────────────────────────────────────────',
    ' *  مستخرج آلياً من Rayyan Pro',
    ' *  المصدر : ' + relPath,
    ' *  الفرع  : integration/general-hotel-mainline',
    ' *  HEAD   : 82d33b6050bc888f06c072c539ad159d3b8f874c',
    ' *',
    ' *  لا تعدّل يدوياً قبل إثبات تكافؤ الأرقام مع النظام الأم.',
    ' * ───────────────────────────────────────────────────────────── */',
    '',
  ].join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  أدوات نظام الملفات
// ═══════════════════════════════════════════════════════════════

const stats = {
  copied: 0,
  skipped: 0,
  missing: [],
  bytes: 0,
  transformed: 0,
  transformNotes: [],
};

function ensureDir(p) {
  if (!DRY) fs.mkdirSync(p, { recursive: true });
}

function copyFile(srcAbs, destAbs, { transform = false, relLabel = '' } = {}) {
  if (!fs.existsSync(srcAbs)) {
    stats.missing.push(relLabel || srcAbs);
    return false;
  }
  if (fs.existsSync(destAbs) && !FORCE) {
    stats.skipped++;
    return false;
  }

  ensureDir(path.dirname(destAbs));

  if (transform) {
    let code = fs.readFileSync(srcAbs, 'utf8');
    const gate = stripFeatureGate(code);
    code = rewriteImports(gate.code);
    if (gate.notes.length) code = tidySyntax(code);
    code = provenanceHeader(relLabel) + code;
    if (gate.notes.length) {
      stats.transformed++;
      stats.transformNotes.push(`  ${path.basename(destAbs)} → ${gate.notes.join('، ')}`);
    }
    if (!DRY) fs.writeFileSync(destAbs, code, 'utf8');
    stats.bytes += Buffer.byteLength(code);
  } else {
    const buf = fs.readFileSync(srcAbs);
    if (!DRY) fs.writeFileSync(destAbs, buf);
    stats.bytes += buf.length;
  }

  stats.copied++;
  return true;
}

function copyDirRecursive(srcDir, destDir, { transform = false, srcLabel = '' } = {}) {
  if (!fs.existsSync(srcDir)) {
    stats.missing.push(srcLabel || srcDir);
    return;
  }
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d, { transform, srcLabel: path.join(srcLabel, entry.name) });
    } else if (entry.isFile()) {
      copyFile(s, d, { transform, relLabel: path.join(srcLabel, entry.name) });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  التنفيذ
// ═══════════════════════════════════════════════════════════════

function section(title) {
  console.log('\n\x1b[36m▸ ' + title + '\x1b[0m');
}

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║   فصل موديول الشحن من Rayyan Pro                    ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`  المصدر  : ${SRC_ROOT}`);
console.log(`  الوجهة  : ${ROOT}`);
console.log(`  الوضع   : ${DRY ? '\x1b[33mمعاينة فقط (لا كتابة)\x1b[0m' : '\x1b[32mنسخ فعلي\x1b[0m'}`);
console.log(`  الـ GL   : ${WITH_GL ? '\x1b[33mمُضمَّن\x1b[0m' : '\x1b[32mمستبعد (موصى به)\x1b[0m'}`);

// 1) موديول الشحن الخادمي
section('موديول الشحن الخادمي → server/src/modules/shipping/');
for (const f of SHIPPING_SERVER_FILES) {
  const rel = `server/src/modules/deliveryShipping/${f}`;
  const ok = copyFile(
    path.join(SRC_ROOT, rel),
    path.join(ROOT, 'server/src/modules/shipping', f),
    { transform: true, relLabel: rel }
  );
  console.log(`   ${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[90m·\x1b[0m'} ${f}`);
}

// 2) موديول المندوب
section('موديول المندوب المحمول → server/src/modules/representative/');
for (const f of REPRESENTATIVE_SERVER_FILES) {
  const rel = `server/src/modules/representativeMobile/${f}`;
  const ok = copyFile(
    path.join(SRC_ROOT, rel),
    path.join(ROOT, 'server/src/modules/representative', f),
    { transform: true, relLabel: rel }
  );
  console.log(`   ${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[90m·\x1b[0m'} ${f}`);
}

// 3) المجلدات المشتركة
section('السلطات المشتركة → server/src/shared/');
for (const d of SHARED_DIRS) {
  const rel = `server/src/shared/${d}`;
  const before = stats.copied;
  copyDirRecursive(
    path.join(SRC_ROOT, rel),
    path.join(ROOT, 'server/src/shared', d),
    { transform: true, srcLabel: rel }
  );
  console.log(`   \x1b[32m✔\x1b[0m ${d}/  (${stats.copied - before} ملف)`);
}

// 4) صفحات الواجهة
section('صفحات الواجهة → client/src/pages/');
for (const f of CLIENT_PAGES) {
  const rel = `client/src/pages/${f}`;
  const ok = copyFile(
    path.join(SRC_ROOT, rel),
    path.join(ROOT, 'client/src/pages', f),
    { transform: true, relLabel: rel }
  );
  console.log(`   ${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[90m·\x1b[0m'} ${f}`);
}

// 5) المهاجرات
section('المهاجرات → migrations/_source/');
const migList = [
  ...BASE_MIGRATIONS,
  ...REPRESENTATIVE_MIGRATIONS,
  ...SHIPPING_MIGRATIONS,
  ...(WITH_GL ? GL_MIGRATIONS : []),
];
for (const f of migList) {
  const rel = `migrations/${f}`;
  const ok = copyFile(
    path.join(SRC_ROOT, rel),
    path.join(ROOT, 'migrations/_source', f),
    { relLabel: rel }
  );
  console.log(`   ${ok ? '\x1b[32m✔\x1b[0m' : '\x1b[90m·\x1b[0m'} ${f}`);
}
if (!WITH_GL) {
  console.log('   \x1b[33m⊘\x1b[0m 154_delivery_shipping_gl_posting_authority.sql  (مستبعد)');
  console.log('   \x1b[33m⊘\x1b[0m 155_delivery_shipping_gl_link_seed_repair.sql   (مستبعد)');
}

// ═══════════════════════════════════════════════════════════════
//  التقرير
// ═══════════════════════════════════════════════════════════════
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║                      النتيجة                         ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`  ملفات منسوخة   : \x1b[32m${stats.copied}\x1b[0m`);
console.log(`  ملفات مُحوَّلة   : ${stats.transformed}`);
console.log(`  تم تخطيها      : ${stats.skipped}${stats.skipped ? '  (موجودة — استخدم --force للكتابة فوقها)' : ''}`);
console.log(`  الحجم          : ${(stats.bytes / 1024).toFixed(1)} KB`);

if (stats.transformNotes.length) {
  console.log('\n  \x1b[36mالتحويلات المطبَّقة:\x1b[0m');
  stats.transformNotes.forEach((n) => console.log(n));
}

if (stats.missing.length) {
  console.log('\n  \x1b[33m⚠ ملفات غير موجودة في المصدر:\x1b[0m');
  stats.missing.forEach((m) => console.log('    - ' + m));
  console.log('\n  تحقق أن المستودع على الفرع integration/general-hotel-mainline');
}

if (DRY) {
  console.log('\n  \x1b[33mهذه معاينة فقط — لم يُكتب أي ملف.\x1b[0m');
  console.log('  أعد التشغيل بدون --dry-run للنسخ الفعلي.');
} else {
  console.log('\n  \x1b[32m✔ تم.\x1b[0m الخطوات التالية:');
  console.log('    1) node scripts/merge-migrations.mjs');
  console.log('    2) عدّل brand.config.json ثم:  node scripts/apply-brand.mjs');
  console.log('    3) npm install  &&  npm run dev');
}
console.log('');
