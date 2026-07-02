/**
 * Posting Engine — محرك الترحيل الدلالي (Semantic Posting Engine)
 *
 * الفكرة الأساسية: القيود لا تعتمد على أرقام حسابات ثابتة.
 * كل سطر قيد يشير إلى "دور دلالي" (semanticRole) مثل REVENUE_CONSTRUCTION،
 * والمحرك يحلّ هذا الدور إلى الحساب الفعلي من الدليل المحاسبي وقت الترحيل.
 *
 * فإذا غيّر المحاسب الحساب المرتبط بدور ما، تتبعه كل القيود تلقائياً
 * دون تعديل أي كود — وهذا جوهر الـ Semantic Accounting Engine.
 */

import { base44 } from '@/api/base44Client';
import { ACCOUNTS } from '@/lib/businessEngine';

// ─── طبقة تخزين مؤقت للدليل المحاسبي (تتفادى rate limit وتسرّع الترحيل) ──────
let _accountsCache = null;

export async function loadAccounts(force = false) {
  if (_accountsCache && !force) return _accountsCache;
  try {
    const list = await base44.entities.ChartAccount.list('code', 1000);
    _accountsCache = list || [];
  } catch {
    _accountsCache = [];
  }
  return _accountsCache;
}

export function clearAccountsCache() {
  _accountsCache = null;
}

/**
 * يحل دوراً دلالياً إلى حساب فعلي.
 * الأولوية: الدليل المحاسبي (SSOT) → ثم الثوابت الافتراضية كخطة بديلة.
 */
export function resolveAccount(role, accounts) {
  const fromChart = (accounts || []).find(
    a => a.semanticRole === role && a.isActive !== false
  );
  if (fromChart) {
    return { code: fromChart.code, name: fromChart.name, nameEn: fromChart.nameEn };
  }
  const fallback = ACCOUNTS[role];
  if (fallback) return { code: fallback.code, name: fallback.name, nameEn: fallback.nameEn };
  // لا حساب معرّف لهذا الدور — يُعاد مؤشر واضح لالتقاطه في التحقق
  return { code: '????', name: `دور غير معرّف: ${role}`, nameEn: `Unmapped role: ${role}`, unmapped: true };
}

/**
 * يبني سطور قيد من قالب ترحيل ومبالغ.
 * amounts = { base, vat, total, net }
 * يُرجع { lines, totalDebit, totalCredit, unmappedRoles }
 */
export function buildLinesFromTemplate(template, amounts, accounts, ctx = {}) {
  const lines = [];
  const unmappedRoles = [];
  for (const tl of template.lines || []) {
    const amount = +(amounts[tl.amountField] || 0);
    if (tl.optional && amount <= 0) continue;
    const acc = resolveAccount(tl.semanticRole, accounts);
    if (acc.unmapped) unmappedRoles.push(tl.semanticRole);
    lines.push({
      accountCode: acc.code,
      accountName: acc.name,
      debit:  tl.side === 'DEBIT'  ? amount : 0,
      credit: tl.side === 'CREDIT' ? amount : 0,
      description: tl.description || ctx.description || '',
    });
  }
  const totalDebit  = +lines.reduce((s, l) => s + l.debit, 0).toFixed(2);
  const totalCredit = +lines.reduce((s, l) => s + l.credit, 0).toFixed(2);
  return { lines, totalDebit, totalCredit, unmappedRoles };
}

/**
 * يبني قيداً كاملاً من نوع عملية باستخدام القالب المخزّن (إن وجد).
 * إذا لم يوجد قالب لنوع العملية، يُرجع null ليتراجع النظام لبناء القيد الثابت.
 */
export async function buildJEFromTemplate(operationType, { entryNo, date, description, sourceType, amounts }) {
  const [accounts, templates] = await Promise.all([
    loadAccounts(),
    base44.entities.PostingTemplate.filter({ operationType, isActive: true }),
  ]);
  const template = (templates || [])[0];
  if (!template) return null;

  const { lines, totalDebit, totalCredit, unmappedRoles } = buildLinesFromTemplate(template, amounts, accounts, { description });
  // إذا وُجد دور دلالي بلا حساب مقابل في الدليل، لا يجوز بناء قيد معطوب.
  if (unmappedRoles.length > 0) {
    throw new Error(`أدوار محاسبية غير معرّفة في الدليل: ${unmappedRoles.join(', ')} — لا يمكن ترحيل القيد ${entryNo}`);
  }
  return {
    entryNo,
    date,
    description,
    sourceType,
    isPosted: true,
    totalDebit,
    totalCredit,
    lines,
  };
}

/**
 * تحقق توازن القيد — لا يُرحّل قيد غير متوازن (Validation).
 */
export function isBalanced(je) {
  return Math.abs((je.totalDebit || 0) - (je.totalCredit || 0)) < 0.01;
}