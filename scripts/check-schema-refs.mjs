#!/usr/bin/env node
/**
 * check-schema-refs.mjs
 * ---------------------------------------------------------------
 * يكشف كل مفتاح أجنبي يشير إلى جدول غير معرّف في المخطط المدموج.
 *
 * لماذا؟
 *   عند فصل موديول من نظام أكبر، تبقى مفاتيح أجنبية تشير إلى جداول
 *   لم تُنسخ. المخطط يبدو سليماً حتى تحاول تطبيقه، فيفشل.
 *   TypeScript يمسك أخطاء الكود — لا شيء يمسك هذه إلا هذا الفحص.
 *
 * الاستخدام:
 *   node scripts/check-schema-refs.mjs
 *   node scripts/check-schema-refs.mjs --fix
 *   node scripts/check-schema-refs.mjs --file migrations/001_shipping_initial_schema.sql
 * ---------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const fileArg = argv.indexOf('--file');
const SCHEMA = path.join(
  ROOT,
  fileArg >= 0 ? argv.at(fileArg + 1) : 'migrations/001_shipping_initial_schema.sql'
);

if (!fs.existsSync(SCHEMA)) {
  console.error(`\n✖ المخطط غير موجود: ${SCHEMA}`);
  console.error('  شغّل أولاً: node scripts/merge-migrations.mjs\n');
  process.exit(1);
}

const raw = fs.readFileSync(SCHEMA, 'utf8');

// أزل التعليقات حتى لا تُحتسب مراجع داخلها
const sql = raw
  .replace(/--[^\n]*/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

// ─── الجداول المعرّفة داخل المخطط ─────────────────────────────────
const defined = new Set();
const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z_][\w$]*)"?/gi;
let m;
while ((m = createRe.exec(sql)) !== null) {
  const g = m.at(1);
  if (g) defined.add(g.toLowerCase());
}

// ─── كل مراجع المفاتيح الأجنبية ──────────────────────────────────
const refs = new Map();
const refRe = /REFERENCES\s+"?([A-Za-z_][\w$]*)"?\s*\(/gi;
while ((m = refRe.exec(sql)) !== null) {
  const g = m.at(1);
  if (!g) continue;
  const target = g.toLowerCase();
  refs.set(target, (refs.get(target) || 0) + 1);
}

// ─── التحليل ─────────────────────────────────────────────────────
const missing = [];
const satisfied = [];
for (const [target, count] of refs) {
  if (defined.has(target)) satisfied.push([target, count]);
  else missing.push([target, count]);
}
missing.sort((a, b) => b.at(1) - a.at(1));
satisfied.sort((a, b) => b.at(1) - a.at(1));

// ─── التقرير ─────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║        فحص المفاتيح الأجنبية في المخطط              ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`  الملف          : ${path.relative(ROOT, SCHEMA)}`);
console.log(`  جداول معرّفة    : ${defined.size}`);
console.log(`  أهداف مرجعية   : ${refs.size}`);

if (satisfied.length) {
  console.log(`\n  ✔ مراجع سليمة (${satisfied.length}):`);
  for (const row of satisfied) {
    console.log(`     ${String(row.at(0)).padEnd(42)} ${row.at(1)}×`);
  }
}

if (missing.length) {
  console.log(`\n  ✖ مراجع معلّقة — جداول غير موجودة (${missing.length}):`);
  for (const row of missing) {
    console.log(`     ${String(row.at(0)).padEnd(42)} ${row.at(1)}×`);
  }

  console.log('\n  هذه ستفشل عند تطبيق المخطط.');
  console.log('\n  لكل جدول مفقود، اختر:');
  console.log('    1) انسخ الجدول من Rayyan Pro (إذا كان ضمن النطاق)');
  console.log('    2) أسقط قيد REFERENCES وأبقِ العمود مرجعاً اختيارياً');
  console.log('    3) احذف العمود كلياً (إذا كان بلا معنى في النظام المستقل)');
  console.log('\n  لتطبيق الخيار 2 آلياً:');
  console.log('    node scripts/check-schema-refs.mjs --fix\n');
} else {
  console.log('\n  ✔ لا توجد مراجع معلّقة. المخطط متماسك.\n');
}

// ─── الإصلاح الآلي ───────────────────────────────────────────────
if (argv.includes('--fix') && missing.length) {
  let fixed = raw;
  let count = 0;

  for (const row of missing) {
    const target = row.at(0);
    const fixRe = new RegExp(
      `\\s*REFERENCES\\s+"?${target}"?\\s*\\([^)]*\\)` +
        `(?:\\s+ON\\s+DELETE\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))?` +
        `(?:\\s+ON\\s+UPDATE\\s+(?:CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION))?`,
      'gi'
    );
    // نستبدل بفراغ لا بتعليق: إدراج /* */ داخل تعليق كتلة قائم
    // ينتج تداخلاً يُنهي التعليق مبكراً ويحوّل بقيته إلى SQL فعلي.
    fixed = fixed.replace(fixRe, () => {
      count++;
      return '';
    });
  }

  const note =
    '-- ═══════════════════════════════════════════════════════════════\n' +
    '--  قيود مفاتيح أجنبية أُسقطت آلياً (خارج نطاق النظام المستقل)\n' +
    '--  الأعمدة باقية كمراجع اختيارية بلا قيد تكامل مرجعي.\n' +
    missing.map((row) => `--    - ${row.at(0)}  (${row.at(1)}×)`).join('\n') +
    '\n-- ═══════════════════════════════════════════════════════════════\n\n';

  const backup = SCHEMA + '.bak';
  fs.writeFileSync(backup, raw, 'utf8');
  fs.writeFileSync(SCHEMA, note + fixed, 'utf8');

  console.log(`  ✔ أُسقط ${count} قيد مفتاح أجنبي.`);
  console.log(`     نسخة احتياطية: ${path.relative(ROOT, backup)}`);
  console.log('\n  ⚠ الأعمدة بقيت موجودة كمراجع اختيارية بلا قيد.');
  console.log('     راجع الناتج يدوياً قبل التطبيق.\n');
}

// رمز خروج غير صفري عند وجود مراجع معلّقة لم تُصلَح — ليفشل في CI
process.exit(missing.length > 0 && !argv.includes('--fix') ? 1 : 0);
