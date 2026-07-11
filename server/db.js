import { newDb } from 'pg-mem';
import crypto from 'crypto';
const db = newDb();
const origPool = db.public;
function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  if (typeof val === 'object') { const json = JSON.stringify(val); return `'${json.replace(/'/g, "''")}'`; }
  return `'${String(val).replace(/'/g, "''")}'`;
}
function inlineParams(text, params) {
  if (!Array.isArray(params) || params.length === 0) return text;
  let out = text;
  for (let i = 0; i < params.length; i++) { out = out.replace(new RegExp(`\\$${i + 1}(?![0-9])`, 'g'), escapeSql(params[i])); }
  return out;
}
export const pool = {
  async query(text, params) {
    const values = Array.isArray(params) ? params : (params && params.values) || [];
    try { return await origPool.query(inlineParams(text, values)); }
    catch (err) { if (!err.code) err.code = 'ERROR'; throw err; }
  },
};
const SYSTEM_OWNER_EMAIL = 'fysl71443@gmail.com';
const SYSTEM_OWNER_PASSWORD = 'faisal.11223344';
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}
function buildStandardAccounts() {
  return [
    { code: '1111', name: 'الصندوق', accountType: 'ASSET', semanticRole: 'CASH', isActive: true },
    { code: '1112', name: 'البنك', accountType: 'ASSET', semanticRole: 'BANK', isActive: true },
    { code: '1114', name: 'بنك الراجحي', accountType: 'ASSET', semanticRole: 'BANK', isActive: true },
    { code: '1121', name: 'ذمم العملاء', accountType: 'ASSET', semanticRole: 'RECEIVABLES', isActive: true },
    { code: '1131', name: 'مخزون مواد البناء', accountType: 'ASSET', semanticRole: 'INVENTORY_MATERIALS', isActive: true },
    { code: '1140', name: 'ضريبة القيمة المضافة المدفوعة', accountType: 'ASSET', semanticRole: 'VAT_RECEIVABLE', isActive: true },
    { code: '2110', name: 'ذمم الموردين', accountType: 'LIABILITY', semanticRole: 'PAYABLES', isActive: true },
    { code: '2120', name: 'ذمم مقاولي الباطن', accountType: 'LIABILITY', semanticRole: 'SUB_PAYABLES', isActive: true },
    { code: '2130', name: 'محتجزات مقاولي الباطن', accountType: 'LIABILITY', semanticRole: 'RETENTION_PAYABLE', isActive: true },
    { code: '2140', name: 'رواتب مستحقة', accountType: 'LIABILITY', semanticRole: 'ACCRUED_SALARIES', isActive: true },
    { code: '2160', name: 'ضريبة القيمة المضافة المحصلة', accountType: 'LIABILITY', semanticRole: 'VAT_PAYABLE', isActive: true },
    { code: '3200', name: 'الأرباح المحتجزة', accountType: 'EQUITY', isActive: true },
    { code: '3300', name: 'الأرباح المبقاة', accountType: 'EQUITY', isActive: true },
    { code: '3900', name: 'رصيد افتتاحي', accountType: 'EQUITY', isActive: true },
    { code: '4100', name: 'إيرادات المقاولات', accountType: 'REVENUE', semanticRole: 'REVENUE_CONSTRUCTION', isActive: true },
    { code: '4200', name: 'إيرادات التأجير', accountType: 'REVENUE', semanticRole: 'REVENUE_RENTAL', isActive: true },
    { code: '4300', name: 'إيرادات الخدمات', accountType: 'REVENUE', semanticRole: 'REVENUE_SERVICE', isActive: true },
    { code: '4910', name: 'فروقات الجرد', accountType: 'REVENUE', isActive: true },
    { code: '5110', name: 'مواد ومشتريات المشاريع', accountType: 'EXPENSE', semanticRole: 'EXPENSE_PURCHASE', isActive: true },
    { code: '5120', name: 'مصروفات المشاريع', accountType: 'EXPENSE', semanticRole: 'EXPENSE_PROJECT', isActive: true },
    { code: '5150', name: 'مصروفات المعدات', accountType: 'EXPENSE', semanticRole: 'EXPENSE_EQUIPMENT', isActive: true },
    { code: '5160', name: 'خسائر المخزون', accountType: 'EXPENSE', isActive: true },
    { code: '5210', name: 'الرواتب', accountType: 'EXPENSE', semanticRole: 'EXPENSE_SALARIES', isActive: true },
    { code: '5220', name: 'مصروفات الموظفين', accountType: 'EXPENSE', semanticRole: 'EXPENSE_EMPLOYEE', isActive: true },
    { code: '5230', name: 'مصروفات إدارية', accountType: 'EXPENSE', semanticRole: 'EXPENSE_ADMIN', isActive: true },
    { code: '5240', name: 'رسوم حكومية', accountType: 'EXPENSE', semanticRole: 'EXPENSE_GOVERNMENT', isActive: true },
    { code: '5250', name: 'مصروفات عمومية', accountType: 'EXPENSE', semanticRole: 'EXPENSE_GENERAL', isActive: true },
    { code: '1125', name: 'ذمم الموظفين', accountType: 'ASSET', isActive: true },
  ];
}
function fiscalYearPayload() {
  const year = new Date().getFullYear();
  return { name: `السنة المالية ${year}`, year, startDate: `${year}-01-01`, endDate: `${year}-12-31`, status: 'OPEN', isCurrent: true, notes: '' };
}
async function seedCoreData() {
  const { rows: ownerRows } = await pool.query('SELECT id FROM app_users WHERE email = $1 LIMIT 1', [SYSTEM_OWNER_EMAIL]);
  const ownerId = ownerRows[0]?.id || null;
  const { rows: fiscalRows } = await pool.query("SELECT id FROM entity_records WHERE entity_name = 'FiscalYear' AND data->>'status' = 'OPEN' LIMIT 1");
  if (!fiscalRows[0]) { await pool.query('INSERT INTO entity_records (entity_name, id, created_by_id, data) VALUES ($1, $2, $3, $4)', ['FiscalYear', crypto.randomUUID(), ownerId, JSON.stringify(fiscalYearPayload())]); }
  const { rows: existingCodes } = await pool.query("SELECT data->>'code' AS code FROM entity_records WHERE entity_name = 'ChartAccount'");
  const existing = new Set(existingCodes.map(r => r.code).filter(Boolean));
  for (const account of buildStandardAccounts()) { if (existing.has(account.code)) continue; await pool.query('INSERT INTO entity_records (entity_name, id, created_by_id, data) VALUES ($1, $2, $3, $4)', ['ChartAccount', crypto.randomUUID(), ownerId, JSON.stringify(account)]); }
}
export async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS app_users (id uuid PRIMARY KEY, email text UNIQUE NOT NULL, full_name text, role text NOT NULL DEFAULT 'user', password_hash text NOT NULL, reset_token_hash text, reset_expires_at timestamptz, created_date timestamptz NOT NULL DEFAULT now(), updated_date timestamptz NOT NULL DEFAULT now());`);
  await pool.query(`ALTER TABLE app_users ADD COLUMN IF NOT EXISTS app_role text NOT NULL DEFAULT 'VIEWER', ADD COLUMN IF NOT EXISTS job_title text, ADD COLUMN IF NOT EXISTS department text, ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true, ADD COLUMN IF NOT EXISTS allowed_modules jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN IF NOT EXISTS module_permissions jsonb NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;`);
  await pool.query(`CREATE TABLE IF NOT EXISTS registration_requests (id uuid PRIMARY KEY, email text NOT NULL, full_name text, password_hash text NOT NULL, status text NOT NULL DEFAULT 'PENDING', app_role text, allowed_modules jsonb NOT NULL DEFAULT '[]'::jsonb, module_permissions jsonb NOT NULL DEFAULT '{}'::jsonb, reviewed_by_id uuid REFERENCES app_users(id) ON DELETE SET NULL, requested_date timestamptz NOT NULL DEFAULT now(), reviewed_date timestamptz);`);
  const ownerPasswordHash = hashPassword(SYSTEM_OWNER_PASSWORD);
  const ownerId = crypto.randomUUID();
  const { rows: existingOwner } = await pool.query('SELECT id FROM app_users WHERE email = $1', [SYSTEM_OWNER_EMAIL]);
  if (existingOwner[0]) { await pool.query(`UPDATE app_users SET role = 'admin', app_role = 'OWNER', password_hash = $2, is_active = true, allowed_modules = '[]'::jsonb, module_permissions = '{}'::jsonb, token_version = token_version + 1, updated_date = now() WHERE email = $1`, [SYSTEM_OWNER_EMAIL, ownerPasswordHash]); }
  else { await pool.query(`INSERT INTO app_users (id, email, full_name, role, app_role, password_hash, is_active, allowed_modules, module_permissions, token_version) VALUES ($1, $2, $3, 'admin', 'OWNER', $4, true, '[]'::jsonb, '{}'::jsonb, 0)`, [ownerId, SYSTEM_OWNER_EMAIL, 'فيصل عبدالرحمن', ownerPasswordHash]); }
  await pool.query(`CREATE TABLE IF NOT EXISTS entity_records (entity_name text NOT NULL, id uuid NOT NULL, created_by_id uuid REFERENCES app_users(id) ON DELETE SET NULL, created_date timestamptz NOT NULL DEFAULT now(), updated_date timestamptz NOT NULL DEFAULT now(), data jsonb NOT NULL DEFAULT '{}'::jsonb, PRIMARY KEY (entity_name, id));`);
  await seedCoreData();
}
