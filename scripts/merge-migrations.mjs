#!/usr/bin/env node
/**
 * merge-migrations.mjs
 * ---------------------------------------------------------------
 * يدمج المهاجرات المنسوخة في مخطط ابتدائي واحد نظيف.
 *
 * لماذا الدمج؟
 *   هذا مشروع جديد بلا تاريخ تشغيلي، فلا قيمة لإعادة تشغيل 16
 *   مهاجرة تراكمية. مهاجرات Rayyan Pro الأصلية تبقى غير قابلة
 *   للمسّ في مستودعها — نحن ننسخ منها فقط.
 *
 * الاستخدام:
 *   node scripts/merge-migrations.mjs
 *   node scripts/merge-migrations.mjs --keep-separate
 * ---------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC_DIR = path.join(ROOT, 'migrations', '_source');
const OUT = path.join(ROOT, 'migrations', '001_shipping_initial_schema.sql');
const KEEP_SEPARATE = process.argv.includes('--keep-separate');

if (!fs.existsSync(SRC_DIR)) {
  console.error('\n✖ migrations/_source غير موجود.');
  console.error('  شغّل أولاً: node scripts/extract-from-rayyan.mjs --src <path>\n');
  process.exit(1);
}

const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort((a, b) => {
    const na = parseInt(a.slice(0, 3), 10);
    const nb = parseInt(b.slice(0, 3), 10);
    return na - nb;
  });

if (!files.length) {
  console.error('✖ لا توجد ملفات .sql في migrations/_source');
  process.exit(1);
}

// حارس أمان: منع تسرّب مهاجرات دفتر الأستاذ العام دون قصد
const glLeaks = files.filter((f) => /_gl_(posting|link)/.test(f));

if (KEEP_SEPARATE) {
  let n = 1;
  for (const f of files) {
    const dest = path.join(ROOT, 'migrations', `${String(n).padStart(3, '0')}_${f.replace(/^\d+_/, '')}`);
    fs.copyFileSync(path.join(SRC_DIR, f), dest);
    n++;
  }
  console.log(`\n✔ نُسخت ${files.length} مهاجرة منفصلة مع إعادة ترقيم.\n`);
  process.exit(0);
}

const header = `-- ═══════════════════════════════════════════════════════════════
--  المخطط الابتدائي — نظام الشحن
-- ═══════════════════════════════════════════════════════════════
--  مدموج آلياً من ${files.length} مهاجرة في Rayyan Pro
--  الفرع : integration/general-hotel-mainline
--  HEAD  : 82d33b6050bc888f06c072c539ad159d3b8f874c
--  التاريخ: ${new Date().toISOString().slice(0, 10)}
--
--  دفتر الأستاذ العام: ${glLeaks.length ? 'مُضمَّن ⚠' : 'مستبعد ✔'}
--
--  ⚠ هذا الملف مُولَّد. لإعادة توليده:
--     node scripts/extract-from-rayyan.mjs --src <path>
--     node scripts/merge-migrations.mjs
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

`;

let body = '';
for (const f of files) {
  let sql = fs.readFileSync(path.join(SRC_DIR, f), 'utf8');

  // إزالة BEGIN/COMMIT الداخلية — نغلّف الكل بمعاملة واحدة
  sql = sql.replace(/^\s*BEGIN\s*;\s*$/gim, '');
  sql = sql.replace(/^\s*COMMIT\s*;\s*$/gim, '');

  body +=
    `\n-- ───────────────────────────────────────────────────────────\n` +
    `-- المصدر: migrations/${f}\n` +
    `-- ───────────────────────────────────────────────────────────\n` +
    sql.trim() +
    '\n';
}

const footer = `
COMMIT;
`;

fs.writeFileSync(OUT, header + body + footer, 'utf8');

const size = (Buffer.byteLength(header + body + footer) / 1024).toFixed(1);
console.log(`\n✔ تم توليد المخطط الابتدائي`);
console.log(`   الملف   : migrations/001_shipping_initial_schema.sql`);
console.log(`   المصادر : ${files.length} مهاجرة`);
console.log(`   الحجم   : ${size} KB`);

if (glLeaks.length) {
  console.log(`\n   \x1b[33m⚠ تحذير: مهاجرات دفتر أستاذ عام مُضمَّنة:\x1b[0m`);
  glLeaks.forEach((f) => console.log('     - ' + f));
  console.log('   هذا يجرّ تبعية على موديولات المحاسبة في Rayyan Pro.');
  console.log('   إن لم تكن تقصد ذلك: احذفها من _source وأعد التشغيل.');
}

console.log(`
   الخطوة التالية — راجع الملف يدوياً بحثاً عن:
     • مراجع لجداول غير منسوخة (accounts, journal_entries, expenses)
     • قيود مفتاح أجنبي معلّقة
     • بذور تشير إلى سلطات Rayyan Pro

   ثم:  psql -d shipping_db -f migrations/001_shipping_initial_schema.sql
`);
