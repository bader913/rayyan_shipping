#!/usr/bin/env node
/**
 * check-schema-refs.mjs
 * ---------------------------------------------------------------
 * يكشف كل مفتاح أجنبي يشير إلى جدول غير معرّف في المخطط.
 *
 * يقرأ كل ملفات migrations/*.sql بالترتيب ويعاملها كمخطط واحد،
 * لأن الجدول قد يُعرَّف في 000 ويُشار إليه من 001.
 *
 * لماذا؟
 *   عند فصل موديول من نظام أكبر، تبقى مفاتيح أجنبية تشير إلى جداول
 *   لم تُنسخ. المخطط يبدو سليماً حتى تحاول تطبيقه، فيفشل.
 *   TypeScript يمسك أخطاء الكود — لا شيء يمسك هذه إلا هذا الفحص.
 *
 * الاستخدام:
 *   node scripts/check-schema-refs.mjs
 *   node scripts/check-schema-refs.mjs --fix
 * ---------------------------------------------------------------
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIG_DIR = path.join(ROOT, 'migrations');

const argv = process.argv.slice(2);
const FIX = argv.includes('--fix');

if (!fs.existsSync(MIG_DIR)) {
  console.error(`\n✖ مجلد المهاجرات غير موجود: ${MIG_DIR}\n`);
  process.exit(1);
}

// ملفات المهاجرات الفعلية — نستبعد _source ونسخ .bak
const files = fs
  .readdirSync(MIG_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (!files.length) {
  console.error('\n✖ لا توجد ملفات .sql في migrations/');
  console.error('  شغّل أولاً: node scripts/merge-migrations.mjs\n');
  process.exit(1);
}

/** يزيل التعليقات حتى لا تُحتسب مراجع داخلها */
function stripComments(text) {
  return text.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// ─── اقرأ كل الملفات ─────────────────────────────────────────────
const sources = new Map(); // file -> raw text
for (const f of files) {
  sources.set(f, fs.readFileSync(path.join(MIG_DIR, f), 'utf8'));
}

// ─── الجداول المعرّفة عبر كل الملفات ─────────────────────────────
const defined = new Set();
for (const [, raw] of sources) {
  const sql = stripComments(raw);
  const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([A-Za-z_][\w$]*)"?/gi;
  let m;
  while ((m = createRe.exec(sql)) !== null) {
    const g = m.at(1);
    if (g) defined.add(g.toLowerCase());
  }
}

// ─── كل المراجع، مع تتبّع الملف الذي وردت فيه ────────────────────
const refs = new Map(); // target -> { count, files:Set }
for (const [file, raw] of sources) {
  const sql = stripComments(raw);
  const refRe = /REFERENCES\s+"?([A-Za-z_][\w$]*)"?\s*\(/gi;
  let m;
  while ((m = refRe.exec(sql)) !== null) {
    const g = m.at(1);
    if (!g) continue;
    const t = g.toLowerCase();
    if (!refs.has(t)) refs.set(t, { count: 0, files: new Set() });
    const entry = refs.get(t);
    entry.count += 1;
    entry.files.add(file);
  }
}

// ─── التحليل ─────────────────────────────────────────────────────
const missing = [];
const satisfied = [];
for (const [target, info] of refs) {
  if (defined.has(target)) satisfied.push([target, info]);
  else missing.push([target, info]);
}
missing.sort((a, b) => b.at(1).count - a.at(1).count);
satisfied.sort((a, b) => b.at(1).count - a.at(1).count);

// ─── التقرير ─────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║        فحص المفاتيح الأجنبية في المخطط              ║');
console.log('╚══════════════════════════════════════════════════════╝');
console.log(`  ملفات المهاجرات : ${files.length}`);
files.forEach((f) => console.log(`     - ${f}`));
console.log(`  جداول معرّفة     : ${defined.size}`);
console.log(`  أهداف مرجعية    : ${refs.size}`);

if (satisfied.length) {
  console.log(`\n  ✔ مراجع سليمة (${satisfied.length}):`);
  for (const row of satisfied) {
    console.log(`     ${String(row.at(0)).padEnd(42)} ${row.at(1).count}×`);
  }
}

if (missing.length) {
  console.log(`\n  ✖ مراجع معلّقة — جداول غير موجودة (${missing.length}):`);
  for (const row of missing) {
    const info = row.at(1);
    console.log(
      `     ${String(row.at(0)).padEnd(42)} ${info.count}×   في: ${[...info.files].join(', ')}`
    );
  }
  console.log('\n  هذه ستفشل عند تطبيق المخطط.');
  if (!FIX) {
    console.log('\n  لإسقاط القيود وإبقاء الأعمدة مراجع اختيارية:');
    console.log('    node scripts/check-schema-refs.mjs --fix\n');
  }
} else {
  console.log('\n  ✔ لا توجد مراجع معلّقة. المخطط متماسك.\n');
}

// ─── الإصلاح الآلي ───────────────────────────────────────────────
if (FIX && missing.length) {
  let total = 0;
  const touched = new Set();

  for (const [file, raw] of sources) {
    let fixed = raw;
    let fileCount = 0;

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
        fileCount += 1;
        return '';
      });
    }

    if (fileCount > 0) {
      const abs = path.join(MIG_DIR, file);
      fs.writeFileSync(abs + '.bak', raw, 'utf8');

      const note =
        '-- ═══════════════════════════════════════════════════════════════\n' +
        '--  قيود مفاتيح أجنبية أُسقطت آلياً (خارج نطاق النظام المستقل)\n' +
        '--  الأعمدة باقية كمراجع اختيارية بلا قيد تكامل مرجعي.\n' +
        missing
          .filter((row) => row.at(1).files.has(file))
          .map((row) => `--    - ${row.at(0)}`)
          .join('\n') +
        '\n-- ═══════════════════════════════════════════════════════════════\n\n';

      fs.writeFileSync(abs, note + fixed, 'utf8');
      touched.add(file);
      total += fileCount;
    }
  }

  console.log(`  ✔ أُسقط ${total} قيد مفتاح أجنبي في ${touched.size} ملف.`);
  touched.forEach((f) => console.log(`     - ${f}  (نسخة احتياطية: ${f}.bak)`));
  console.log('\n  ⚠ الأعمدة بقيت موجودة كمراجع اختيارية بلا قيد.');
  console.log('     راجع الناتج يدوياً قبل التطبيق.\n');
}

// رمز خروج غير صفري عند وجود مراجع معلّقة لم تُصلَح — ليفشل في CI
process.exit(missing.length > 0 && !FIX ? 1 : 0);
