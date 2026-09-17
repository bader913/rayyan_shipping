-- ═══════════════════════════════════════════════════════════════
--  جداول الأساس — نظام الشحن المستقل
-- ═══════════════════════════════════════════════════════════════
--  يعمل قبل 001_shipping_initial_schema.sql (ترتيب أبجدي).
--
--  هذه الجداول ليست منسوخة من Rayyan Pro. هناك تجرّ معها نقطة
--  البيع والمخزون والرواتب. هنا نعرّف الحد الأدنى الذي يحتاجه
--  الشحن فعلياً:
--
--    users     — مرجع actor_user_id و created_by في كل عملية شحن
--    employees — مرجع representative_mobile_profiles.employee_id
--    expenses  — مرجع delivery_shipping_expense_links ومركز الربح
--
--  ⚠ هذا الملف يُحرَّر يدوياً. merge-migrations.mjs لا يولّده.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ───────────────────────────────────────────────────────────────
--  المستخدمون — سلطة المصادقة والصلاحيات
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(160) NOT NULL DEFAULT '',
  role VARCHAR(48) NOT NULL DEFAULT 'user',

  -- يُبطل الجلسات القائمة عند تغيير الصلاحيات أو كلمة المرور
  auth_stamp VARCHAR(64),

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  phone VARCHAR(32),
  email VARCHAR(160),

  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active;

COMMENT ON TABLE users IS
  'سلطة المصادقة. كل عملية شحن تسجّل actor_user_id يشير إلى هنا.';

-- ───────────────────────────────────────────────────────────────
--  الموظفون — المندوبون وطاقم التشغيل
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  employee_code VARCHAR(48) UNIQUE,

  phone VARCHAR(32),
  national_id VARCHAR(48),
  job_title VARCHAR(96),

  -- ربط اختياري بحساب دخول
  linked_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at TIMESTAMPTZ,

  hired_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_active
  ON employees(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_employees_linked_user
  ON employees(linked_user_id);

COMMENT ON TABLE employees IS
  'الموظفون. ملفات المندوبين ترتبط بهذا الجدول عبر employee_id.';

-- ───────────────────────────────────────────────────────────────
--  المصاريف — مصاريف تشغيل الشحن
-- ───────────────────────────────────────────────────────────────
--  مركز ربح الشحن يجمّع حسب: currency, category, amount, expense_date
--  ويربط عبر delivery_shipping_expense_links.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category VARCHAR(96) NOT NULL,
  amount NUMERIC(18,4) NOT NULL CHECK (amount > 0),
  currency VARCHAR(3) NOT NULL,
  exchange_rate_snapshot NUMERIC(18,6) NOT NULL DEFAULT 1
    CHECK (exchange_rate_snapshot > 0),

  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note VARCHAR(500),

  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_date
  ON expenses(expense_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category
  ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_currency
  ON expenses(currency);

COMMENT ON TABLE expenses IS
  'مصاريف التشغيل. تُربط بالشحن عبر delivery_shipping_expense_links.';

-- ───────────────────────────────────────────────────────────────
--  مستخدم إداري أولي
-- ───────────────────────────────────────────────────────────────
--  ⚠ كلمة المرور الافتراضية معطّلة عمداً (قيمة غير قابلة للمطابقة).
--     عيّن كلمة مرور حقيقية قبل أي استخدام:
--
--     UPDATE users SET password_hash = '<bcrypt hash>' WHERE username = 'admin';
--
--     لا تضع كلمة مرور نصية هنا ولا ترفع أي سر إلى المستودع.
-- ───────────────────────────────────────────────────────────────
INSERT INTO users (username, password_hash, full_name, role, auth_stamp)
VALUES (
  'admin',
  '!disabled-set-a-real-password-before-use',
  'مدير النظام',
  'admin_manager',
  encode(gen_random_bytes(16), 'hex')
)
ON CONFLICT (username) DO NOTHING;

COMMIT;
