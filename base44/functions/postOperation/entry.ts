import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * postOperation — تنفيذ العمليات المالية كترانسكشن ذرّي على الخادم.
 *
 * كل عملية (إنشاء السجل + ترحيل القيد المحاسبي) تُنفَّذ هنا في نداء واحد.
 * إن فشلت أي خطوة بعد إنشاء السجل، يُحذف السجل (rollback) فلا تبقى معاملة
 * مالية بلا قيد مقابل. الشاشات تنادي هذه الدالة عبر SDK باستدعاء واحد.
 *
 * الحمولة: { operation, mode, data, id, prevStatus }
 *   operation: SALES_INVOICE | PURCHASE_ORDER | EXPENSE | RENTAL_CONTRACT | PAYROLL
 *   mode:      create | update
 */

const VAT_RATE = 0.15;

// خريطة الحسابات الافتراضية حسب الدور (تُستخدم كخطة بديلة إن لم يوجد حساب في الدليل)
// خطة بديلة تطابق الشجرة القياسية الحالية — تُستخدم فقط إن لم يوجد الدور في الدليل.
const ACCOUNTS = {
  CASH:                 { code: '1111', name: 'الصندوق' },
  BANK:                 { code: '1112', name: 'البنك' },
  RECEIVABLES:          { code: '1121', name: 'ذمم العملاء' },
  PAYABLES:             { code: '2110', name: 'ذمم الموردين' },
  VAT_PAYABLE:          { code: '2160', name: 'ضريبة القيمة المضافة المحصلة' },
  VAT_RECEIVABLE:       { code: '1140', name: 'ضريبة القيمة المضافة المدفوعة' },
  ACCRUED_SALARIES:     { code: '2140', name: 'رواتب مستحقة الدفع' },
  REVENUE_CONSTRUCTION: { code: '4100', name: 'إيرادات أعمال المقاولات' },
  REVENUE_RENTAL:       { code: '4200', name: 'إيرادات تأجير المعدات' },
  REVENUE_SERVICE:      { code: '4300', name: 'إيرادات الخدمات' },
  EXPENSE_GENERAL:      { code: '5250', name: 'المصروفات العمومية' },
  EXPENSE_SALARIES:     { code: '5210', name: 'الرواتب والأجور الإدارية' },
  EXPENSE_PURCHASE:     { code: '5110', name: 'مواد ومشتريات المشاريع' },
  EXPENSE_PROJECT:      { code: '5120', name: 'مصروفات المشاريع' },
  EXPENSE_EQUIPMENT:    { code: '5150', name: 'مصروفات المعدات' },
  EXPENSE_EMPLOYEE:     { code: '5220', name: 'مصروفات الموظفين' },
  EXPENSE_GOVERNMENT:   { code: '5240', name: 'رسوم ومصروفات حكومية' },
  EXPENSE_ADMIN:        { code: '5230', name: 'مصروفات إدارية' },
};

const EXPENSE_TYPE_ACCOUNTS = {
  EXPENSE_PROJECT:    ACCOUNTS.EXPENSE_PROJECT,
  EXPENSE_EQUIPMENT:  ACCOUNTS.EXPENSE_EQUIPMENT,
  EXPENSE_EMPLOYEE:   ACCOUNTS.EXPENSE_EMPLOYEE,
  EXPENSE_GOVERNMENT: ACCOUNTS.EXPENSE_GOVERNMENT,
  EXPENSE_ADMIN:      ACCOUNTS.EXPENSE_ADMIN,
  EXPENSE_GENERAL:    ACCOUNTS.EXPENSE_GENERAL,
};

const num = (v) => parseFloat(v) || 0;
const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';

function calcVAT(amount, rate = VAT_RATE) {
  const base = num(amount);
  const vat = +(base * rate).toFixed(2);
  const total = +(base + vat).toFixed(2);
  return { base, vat, total };
}

// ─── قواعد التحقق ─────────────────────────────────────────────────────────────
const RULES = {
  SALES_INVOICE: [
    { m: 'رقم الفاتورة مطلوب', t: (d) => !isBlank(d.invoiceNo) },
    { m: 'اختيار العميل مطلوب', t: (d) => !isBlank(d.clientId) },
    { m: 'تاريخ الفاتورة مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'المبلغ الأساسي يجب أن يكون أكبر من صفر', t: (d) => num(d.subtotal) > 0 },
    { m: 'تاريخ الاستحقاق لا يمكن أن يسبق تاريخ الفاتورة', t: (d) => isBlank(d.dueDate) || isBlank(d.date) || d.dueDate >= d.date },
    { m: 'المبلغ المدفوع لا يمكن أن يتجاوز إجمالي الفاتورة', t: (d) => num(d.paidAmount) <= num(d.subtotal) * (1 + (num(d.vatRate) || 0.15)) + 0.01 },
  ],
  PURCHASE_ORDER: [
    { m: 'رقم الأمر مطلوب', t: (d) => !isBlank(d.orderNo) },
    { m: 'اختيار المورد مطلوب', t: (d) => !isBlank(d.supplierId) },
    { m: 'تاريخ الأمر مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'قيمة الأمر يجب أن تكون أكبر من صفر', t: (d) => num(d.totalAmount) > 0 },
    { m: 'تاريخ التسليم المتوقع لا يمكن أن يسبق تاريخ الأمر', t: (d) => isBlank(d.expectedDelivery) || isBlank(d.date) || d.expectedDelivery >= d.date },
  ],
  EXPENSE: [
    { m: 'بند المصروف مطلوب', t: (d) => !isBlank(d.category) },
    { m: 'وصف المصروف مطلوب', t: (d) => !isBlank(d.description) },
    { m: 'تاريخ المصروف مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'المبلغ يجب أن يكون أكبر من صفر', t: (d) => num(d.amount) > 0 },
  ],
  RENTAL_CONTRACT: [
    { m: 'رقم العقد مطلوب', t: (d) => !isBlank(d.contractNo) },
    { m: 'اختيار المعدة مطلوب', t: (d) => !isBlank(d.equipmentId) },
    { m: 'اختيار العميل مطلوب', t: (d) => !isBlank(d.clientId) },
    { m: 'قيمة الإيجار يجب أن تكون أكبر من صفر', t: (d) => num(d.rate) > 0 },
    { m: 'تاريخ نهاية العقد لا يمكن أن يسبق تاريخ البداية', t: (d) => isBlank(d.endDate) || isBlank(d.startDate) || d.endDate >= d.startDate },
  ],
  PAYROLL: [
    { m: 'كود المسير مطلوب', t: (d) => !isBlank(d.code) },
    { m: 'الشهر مطلوب (1-12)', t: (d) => num(d.month) >= 1 && num(d.month) <= 12 },
    { m: 'السنة مطلوبة', t: (d) => num(d.year) >= 2000 },
    { m: 'صافي المسير يجب أن يكون أكبر من صفر', t: (d) => num(d.netAmount) > 0 },
    { m: 'لا يمكن اعتماد مسير مدفوع دون تحديد طريقة الدفع (الحساب النقدي)', t: (d) => d.status !== 'PAID' || !isBlank(d.paymentAccountCode) },
    { m: 'لا يمكن اعتماد مسير مدفوع دون تحديد تاريخ الدفع', t: (d) => d.status !== 'PAID' || !isBlank(d.paymentDate) },
  ],
  CLIENT_PAYMENT: [
    { m: 'اختيار العميل مطلوب', t: (d) => !isBlank(d.clientId) },
    { m: 'تاريخ السند مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'المبلغ يجب أن يكون أكبر من صفر', t: (d) => num(d.amount) > 0 },
    { m: 'اختيار الحساب النقدي (صندوق/بنك) مطلوب — لا يمكن تحصيل بلا حساب', t: (d) => !isBlank(d.cashAccountCode) },
  ],
  SUPPLIER_PAYMENT: [
    { m: 'اختيار المورد مطلوب', t: (d) => !isBlank(d.supplierId) },
    { m: 'تاريخ السند مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'المبلغ يجب أن يكون أكبر من صفر', t: (d) => num(d.amount) > 0 },
    { m: 'اختيار الحساب النقدي (صندوق/بنك) مطلوب — لا يمكن الصرف بلا حساب', t: (d) => !isBlank(d.cashAccountCode) },
  ],
  SUPPLIER_INVOICE: [
    { m: 'رقم الفاتورة مطلوب', t: (d) => !isBlank(d.invoiceNo) },
    { m: 'اختيار المورد مطلوب', t: (d) => !isBlank(d.supplierId) },
    { m: 'تاريخ الفاتورة مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'المبلغ الأساسي يجب أن يكون أكبر من صفر', t: (d) => num(d.baseAmount) > 0 },
    { m: 'تاريخ الاستحقاق لا يمكن أن يسبق تاريخ الفاتورة', t: (d) => isBlank(d.dueDate) || isBlank(d.date) || d.dueDate >= d.date },
  ],
  RENTAL_INVOICE: [
    { m: 'رقم الفاتورة مطلوب', t: (d) => !isBlank(d.invoiceNo) },
    { m: 'تاريخ الفاتورة مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'قيمة الفاتورة يجب أن تكون أكبر من صفر', t: (d) => num(d.baseAmount) + num(d.extraCharges) > 0 },
  ],
};

function assertValid(operationType, data) {
  const rules = RULES[operationType] || [];
  const errors = rules.filter((r) => !r.t(data || {})).map((r) => r.m);
  if (errors.length) throw new Error(errors[0]);
}

// ─── سير العمل: الانتقالات المسموحة ──────────────────────────────────────────
const TRANSITIONS = {
  SALES_INVOICE: {
    DRAFT: ['SENT', 'CANCELLED'], SENT: ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
    PARTIALLY_PAID: ['PAID', 'OVERDUE', 'CANCELLED'], OVERDUE: ['PARTIALLY_PAID', 'PAID', 'CANCELLED'],
    PAID: [], CANCELLED: [],
  },
  PURCHASE_ORDER: {
    DRAFT: ['APPROVED', 'CANCELLED'], APPROVED: ['ORDERED', 'CANCELLED'],
    ORDERED: ['RECEIVED', 'CANCELLED'], RECEIVED: [], CANCELLED: [],
  },
  RENTAL_CONTRACT: {
    DRAFT: ['ACTIVE', 'CANCELLED'], ACTIVE: ['COMPLETED', 'CANCELLED'], COMPLETED: [], CANCELLED: [],
  },
  PAYROLL: { DRAFT: ['APPROVED'], APPROVED: ['PAID'], PAID: [] },
};

function assertTransition(docType, from, to) {
  if (!from || from === to) return;
  const map = TRANSITIONS[docType];
  if (!map) return;
  const allowed = map[from];
  if (!allowed) return;
  if (!allowed.includes(to)) {
    throw new Error(`لا يمكن الانتقال من الحالة "${from}" إلى "${to}" — انتقال غير مسموح في سير العمل`);
  }
}

// ─── الترحيل الدلالي: حل الأدوار من الدليل المحاسبي ───────────────────────────
function resolveAccount(role, accounts) {
  const fromChart = (accounts || []).find((a) => a.semanticRole === role && a.isActive !== false);
  if (fromChart) return { code: fromChart.code, name: fromChart.name };
  const fallback = ACCOUNTS[role];
  if (fallback) return { code: fallback.code, name: fallback.name };
  return { code: '????', name: `دور غير معرّف: ${role}`, unmapped: true };
}

function buildLinesFromTemplate(template, amounts, accounts, description) {
  const lines = [];
  const unmappedRoles = [];
  for (const tl of template.lines || []) {
    const amount = +(amounts[tl.amountField] || 0);
    if (tl.optional && amount <= 0) continue;
    const acc = resolveAccount(tl.semanticRole, accounts);
    if (acc.unmapped) unmappedRoles.push(tl.semanticRole);
    lines.push({
      accountCode: acc.code, accountName: acc.name,
      debit: tl.side === 'DEBIT' ? amount : 0,
      credit: tl.side === 'CREDIT' ? amount : 0,
      description: tl.description || description || '',
    });
  }
  const totalDebit = +lines.reduce((s, l) => s + l.debit, 0).toFixed(2);
  const totalCredit = +lines.reduce((s, l) => s + l.credit, 0).toFixed(2);
  return { lines, totalDebit, totalCredit, unmappedRoles };
}

async function buildJEFromTemplate(base44, operationType, meta, amounts) {
  const [accounts, templates] = await Promise.all([
    base44.asServiceRole.entities.ChartAccount.list('code', 1000),
    base44.asServiceRole.entities.PostingTemplate.filter({ operationType, isActive: true }),
  ]);
  const template = (templates || [])[0];
  if (!template) return null;
  const { lines, totalDebit, totalCredit, unmappedRoles } = buildLinesFromTemplate(template, amounts, accounts || [], meta.description);
  if (unmappedRoles.length > 0) {
    throw new Error(`أدوار محاسبية غير معرّفة في الدليل: ${unmappedRoles.join(', ')} — لا يمكن ترحيل القيد ${meta.entryNo}`);
  }
  return { entryNo: meta.entryNo, date: meta.date, description: meta.description, sourceType: meta.sourceType, isPosted: true, totalDebit, totalCredit, lines };
}

async function buildJE(base44, operationType, meta, amounts, fallbackBuilder) {
  const fromTemplate = await buildJEFromTemplate(base44, operationType, meta, amounts);
  return fromTemplate || fallbackBuilder();
}

// ─── بناة القيود الثابتة ──────────────────────────────────────────────────────
function buildSalesInvoiceJE({ invoiceNo, date, clientName, subtotal, vatAmount, totalAmount, invoiceType }) {
  const rev = invoiceType === 'RENTAL' ? ACCOUNTS.REVENUE_RENTAL : invoiceType === 'SERVICE' ? ACCOUNTS.REVENUE_SERVICE : ACCOUNTS.REVENUE_CONSTRUCTION;
  return {
    entryNo: `JE-SINV-${invoiceNo}`, date, description: `فاتورة مبيعات ${invoiceNo} — ${clientName}`, sourceType: 'SalesInvoice', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: ACCOUNTS.RECEIVABLES.code, accountName: ACCOUNTS.RECEIVABLES.name, debit: totalAmount, credit: 0, description: `فاتورة ${invoiceNo}` },
      { accountCode: rev.code, accountName: rev.name, debit: 0, credit: subtotal, description: 'الإيراد الأساسي' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_PAYABLE.code, accountName: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

function buildPurchaseOrderJE({ orderNo, date, supplierName, baseAmount, vatAmount, grandTotal }) {
  return {
    entryNo: `JE-PO-${orderNo}`, date, description: `أمر شراء ${orderNo} — ${supplierName}`, sourceType: 'PurchaseOrder', isPosted: true,
    totalDebit: grandTotal, totalCredit: grandTotal,
    lines: [
      { accountCode: ACCOUNTS.EXPENSE_PURCHASE.code, accountName: ACCOUNTS.EXPENSE_PURCHASE.name, debit: baseAmount, credit: 0, description: 'مواد وبضاعة' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_RECEIVABLE.code, accountName: ACCOUNTS.VAT_RECEIVABLE.name, debit: vatAmount, credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: ACCOUNTS.PAYABLES.code, accountName: ACCOUNTS.PAYABLES.name, debit: 0, credit: grandTotal, description: `مستحقات ${supplierName}` },
    ],
  };
}

function buildExpenseJE({ date, description, amount, vatAmount, totalAmount, reference, accountRole, expenseAccount, paymentAccount }) {
  // أولوية الحساب الذي اختاره المستخدم من الدليل، ثم الحساب الافتراضي حسب النوع.
  const debitAccount = expenseAccount || EXPENSE_TYPE_ACCOUNTS[accountRole] || ACCOUNTS.EXPENSE_GENERAL;
  // طرف السداد: الحساب النقدي المختار (صندوق/بنك/عهد)، وإلا البنك افتراضياً.
  const creditAccount = paymentAccount || ACCOUNTS.BANK;
  return {
    entryNo: `JE-EXP-${reference || Date.now()}`, date, description: `مصروف: ${description}`, sourceType: 'Expense', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: debitAccount.code, accountName: debitAccount.name, debit: amount, credit: 0, description },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_RECEIVABLE.code, accountName: ACCOUNTS.VAT_RECEIVABLE.name, debit: vatAmount, credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: creditAccount.code, accountName: creditAccount.name, debit: 0, credit: totalAmount, description: 'سداد المصروف' },
    ],
  };
}

const AR_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// قيد الاستحقاق: يُنشأ لكل مسير (مدفوعاً كان أو لا) — يثبت التزام الرواتب على الشركة.
//   من ح/ مصروف الرواتب (مدين)  إلى ح/ رواتب مستحقة الدفع (دائن)
function buildPayrollAccrualJE({ code, month, year, netAmount }, accounts) {
  const monthName = AR_MONTHS[(month || 1) - 1];
  const date = `${year}-${String(month).padStart(2, '0')}-01`;
  const salaryExp = resolveAccount('EXPENSE_SALARIES', accounts);
  const accrued = resolveAccount('ACCRUED_SALARIES', accounts);
  return {
    entryNo: `JE-PAY-${code}`, date, description: `استحقاق رواتب ${monthName} ${year}`, sourceType: 'PayrollRun', isPosted: true,
    totalDebit: netAmount, totalCredit: netAmount,
    lines: [
      { accountCode: salaryExp.code, accountName: salaryExp.name, debit: netAmount, credit: 0, description: `مصروف رواتب ${monthName}` },
      { accountCode: accrued.code, accountName: accrued.name, debit: 0, credit: netAmount, description: 'رواتب مستحقة الدفع' },
    ],
  };
}

// قيد السداد: يُنشأ فقط عند الدفع — يُنقص الالتزام والنقدية.
//   من ح/ رواتب مستحقة الدفع (مدين)  إلى ح/ النقدية المختارة (دائن)
function buildPayrollPaymentJE({ code, month, year, netAmount, paymentDate, paymentAccountCode, paymentAccountName }, accounts) {
  const monthName = AR_MONTHS[(month || 1) - 1];
  const accrued = resolveAccount('ACCRUED_SALARIES', accounts);
  const cash = { code: paymentAccountCode, name: paymentAccountName || 'النقدية' };
  return {
    entryNo: `JE-PAYPAID-${code}`, date: paymentDate, description: `سداد رواتب ${monthName} ${year}`, sourceType: 'PayrollRun', isPosted: true,
    totalDebit: netAmount, totalCredit: netAmount,
    lines: [
      { accountCode: accrued.code, accountName: accrued.name, debit: netAmount, credit: 0, description: 'سداد رواتب مستحقة' },
      { accountCode: cash.code, accountName: cash.name, debit: 0, credit: netAmount, description: `دفع من ${cash.name}` },
    ],
  };
}

function buildRentalJE({ contractNo, date, clientName, base, vatAmount, totalAmount }) {
  return {
    entryNo: `JE-RC-${contractNo}`, date: date || new Date().toISOString().slice(0, 10), description: `عقد تأجير ${contractNo} — ${clientName}`, sourceType: 'RentalContract', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: ACCOUNTS.RECEIVABLES.code, accountName: ACCOUNTS.RECEIVABLES.name, debit: totalAmount, credit: 0, description: `عقد ${contractNo}` },
      { accountCode: ACCOUNTS.REVENUE_RENTAL.code, accountName: ACCOUNTS.REVENUE_RENTAL.name, debit: 0, credit: base, description: 'إيراد التأجير' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_PAYABLE.code, accountName: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

// تحصيل من عميل: من ح/ النقدية المختارة (مدين) إلى ح/ ذمم العملاء (دائن)
function buildClientPaymentJE({ paymentNo, date, clientName, amount, cashAccountCode, cashAccountName }, accounts) {
  const receivables = resolveAccount('RECEIVABLES', accounts);
  const cash = { code: cashAccountCode, name: cashAccountName || 'النقدية' };
  const ref = paymentNo || `${date}-${clientName || ''}`;
  return {
    entryNo: `JE-RCPT-${ref}`, date, description: `تحصيل من ${clientName || 'عميل'}`, sourceType: 'ClientPayment', isPosted: true,
    totalDebit: amount, totalCredit: amount,
    lines: [
      { accountCode: cash.code, accountName: cash.name, debit: amount, credit: 0, description: `تحصيل في ${cash.name}` },
      { accountCode: receivables.code, accountName: receivables.name, debit: 0, credit: amount, description: `سداد ذمة ${clientName || ''}` },
    ],
  };
}

// سداد لمورد: من ح/ ذمم الموردين (مدين) إلى ح/ النقدية المختارة (دائن)
function buildSupplierPaymentJE({ paymentNo, date, supplierName, amount, cashAccountCode, cashAccountName }, accounts) {
  const payables = resolveAccount('PAYABLES', accounts);
  const cash = { code: cashAccountCode, name: cashAccountName || 'النقدية' };
  const ref = paymentNo || `${date}-${supplierName || ''}`;
  return {
    entryNo: `JE-PMT-${ref}`, date, description: `سداد إلى ${supplierName || 'مورد'}`, sourceType: 'SupplierPayment', isPosted: true,
    totalDebit: amount, totalCredit: amount,
    lines: [
      { accountCode: payables.code, accountName: payables.name, debit: amount, credit: 0, description: `سداد ذمة ${supplierName || ''}` },
      { accountCode: cash.code, accountName: cash.name, debit: 0, credit: amount, description: `دفع من ${cash.name}` },
    ],
  };
}

// فاتورة مورد (التزام): من ح/ مشتريات + ضريبة مدفوعة (مدين) إلى ح/ ذمم الموردين (دائن)
function buildSupplierInvoiceJE({ invoiceNo, date, supplierName, baseAmount, vatAmount, totalAmount }, accounts) {
  const purchase = resolveAccount('EXPENSE_PURCHASE', accounts);
  const vatRec = resolveAccount('VAT_RECEIVABLE', accounts);
  const payables = resolveAccount('PAYABLES', accounts);
  return {
    entryNo: `JE-SUPINV-${invoiceNo}`, date, description: `فاتورة مورد ${invoiceNo} — ${supplierName || ''}`, sourceType: 'SupplierInvoice', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: purchase.code, accountName: purchase.name, debit: baseAmount, credit: 0, description: 'مشتريات ومواد' },
      ...(vatAmount > 0 ? [{ accountCode: vatRec.code, accountName: vatRec.name, debit: vatAmount, credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: payables.code, accountName: payables.name, debit: 0, credit: totalAmount, description: `مستحقات ${supplierName || ''}` },
    ],
  };
}

// فاتورة تأجير (إيراد): من ح/ ذمم العملاء (مدين) إلى ح/ إيراد التأجير + ضريبة محصلة (دائن)
function buildRentalInvoiceJE({ invoiceNo, date, clientName, baseAmount, vatAmount, totalAmount }, accounts) {
  const receivables = resolveAccount('RECEIVABLES', accounts);
  const revenue = resolveAccount('REVENUE_RENTAL', accounts);
  const vatPay = resolveAccount('VAT_PAYABLE', accounts);
  return {
    entryNo: `JE-RINV-${invoiceNo}`, date, description: `فاتورة تأجير ${invoiceNo} — ${clientName || ''}`, sourceType: 'RentalInvoice', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: receivables.code, accountName: receivables.name, debit: totalAmount, credit: 0, description: `فاتورة ${invoiceNo}` },
      { accountCode: revenue.code, accountName: revenue.name, debit: 0, credit: baseAmount, description: 'إيراد التأجير' },
      ...(vatAmount > 0 ? [{ accountCode: vatPay.code, accountName: vatPay.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

// ─── حارس سلامة القيد ─────────────────────────────────────────────────────────
function assertJEIntegrity(je) {
  if (!je) throw new Error('قيد فارغ — لا يوجد قيد لترحيله');
  if (!Array.isArray(je.lines) || je.lines.length < 2) throw new Error(`القيد ${je.entryNo || ''} يجب أن يحتوي سطرين على الأقل (مدين ودائن)`);
  if (je.lines.find((l) => !l.accountCode || l.accountCode === '????')) throw new Error(`القيد ${je.entryNo || ''} يحتوي سطراً بحساب غير معرّف`);
  const sumDebit = +je.lines.reduce((s, l) => s + (+l.debit || 0), 0).toFixed(2);
  const sumCredit = +je.lines.reduce((s, l) => s + (+l.credit || 0), 0).toFixed(2);
  if (Math.abs(sumDebit - sumCredit) >= 0.01) throw new Error(`القيد ${je.entryNo || ''} غير متوازن: مدين ${sumDebit} ≠ دائن ${sumCredit}`);
  if (Math.abs((je.totalDebit || 0) - sumDebit) >= 0.01 || Math.abs((je.totalCredit || 0) - sumCredit) >= 0.01) throw new Error(`القيد ${je.entryNo || ''} إجمالياته لا تطابق سطوره`);
}

// يرحّل القيد ذرّياً بصلاحية الخدمة، ويمنع التكرار بنفس رقم القيد
async function autoPostJE(base44, jeData) {
  assertJEIntegrity(jeData);
  const existing = await base44.asServiceRole.entities.JournalEntry.filter({ entryNo: jeData.entryNo });
  if (existing && existing.length > 0) return existing[0];
  return await base44.asServiceRole.entities.JournalEntry.create(jeData);
}

// ─── منفّذو العمليات (كل واحد يُنشئ السجل ثم يرحّل القيد ذرّياً مع rollback) ───

async function createSalesInvoice(base44, data) {
  assertValid('SALES_INVOICE', data);
  const { base: subtotal, vat: vatAmount, total: totalAmount } = calcVAT(data.subtotal, num(data.vatRate) || VAT_RATE);
  const payload = { ...data, subtotal, vatRate: num(data.vatRate) || VAT_RATE, vatAmount, totalAmount, paidAmount: num(data.paidAmount) };
  const invoice = await base44.asServiceRole.entities.SalesInvoice.create(payload);
  try {
    const je = await buildJE(base44, 'SALES_INVOICE',
      { entryNo: `JE-SINV-${payload.invoiceNo}`, date: payload.date, description: `فاتورة مبيعات ${payload.invoiceNo} — ${payload.clientName}`, sourceType: 'SalesInvoice' },
      { base: subtotal, vat: vatAmount, total: totalAmount },
      () => buildSalesInvoiceJE({ ...payload }));
    await autoPostJE(base44, je);
  } catch (e) {
    await rollback(base44, 'SalesInvoice', invoice.id);
    throw e;
  }
  return invoice;
}

async function updateSalesInvoice(base44, id, data, prevStatus) {
  assertValid('SALES_INVOICE', data);
  assertTransition('SALES_INVOICE', prevStatus, data.status);
  const { base: subtotal, vat: vatAmount, total: totalAmount } = calcVAT(data.subtotal, num(data.vatRate) || VAT_RATE);
  const payload = { ...data, subtotal, vatRate: num(data.vatRate) || VAT_RATE, vatAmount, totalAmount, paidAmount: num(data.paidAmount) };
  return await base44.asServiceRole.entities.SalesInvoice.update(id, payload);
}

async function createPurchaseOrder(base44, data) {
  assertValid('PURCHASE_ORDER', data);
  const { base: baseAmount, vat: vatAmount, total: grandTotal } = calcVAT(data.totalAmount);
  const payload = { ...data, totalAmount: baseAmount, vatAmount };
  const po = await base44.asServiceRole.entities.PurchaseOrder.create(payload);
  if (payload.status === 'RECEIVED') {
    try {
      const je = await buildJE(base44, 'PURCHASE_ORDER',
        { entryNo: `JE-PO-${payload.orderNo}`, date: payload.date, description: `أمر شراء ${payload.orderNo} — ${payload.supplierName}`, sourceType: 'PurchaseOrder' },
        { base: baseAmount, vat: vatAmount, total: grandTotal },
        () => buildPurchaseOrderJE({ orderNo: payload.orderNo, date: payload.date, supplierName: payload.supplierName, baseAmount, vatAmount, grandTotal }));
      await autoPostJE(base44, je);
    } catch (e) {
      await rollback(base44, 'PurchaseOrder', po.id);
      throw e;
    }
  }
  return po;
}

async function updatePurchaseOrder(base44, id, data, prevStatus) {
  assertValid('PURCHASE_ORDER', data);
  assertTransition('PURCHASE_ORDER', prevStatus, data.status);
  const { base: baseAmount, vat: vatAmount, total: grandTotal } = calcVAT(data.totalAmount);
  const payload = { ...data, totalAmount: baseAmount, vatAmount };
  const po = await base44.asServiceRole.entities.PurchaseOrder.update(id, payload);
  // القيد يُرحّل فقط عند أول انتقال إلى "مستلم". فشل القيد = فشل العملية: نُعيد الحالة السابقة.
  if (payload.status === 'RECEIVED' && prevStatus !== 'RECEIVED') {
    try {
      const je = await buildJE(base44, 'PURCHASE_ORDER',
        { entryNo: `JE-PO-${payload.orderNo}`, date: payload.date, description: `أمر شراء ${payload.orderNo} — ${payload.supplierName}`, sourceType: 'PurchaseOrder' },
        { base: baseAmount, vat: vatAmount, total: grandTotal },
        () => buildPurchaseOrderJE({ orderNo: payload.orderNo, date: payload.date, supplierName: payload.supplierName, baseAmount, vatAmount, grandTotal }));
      await autoPostJE(base44, je);
    } catch (e) {
      await restoreStatus(base44, 'PurchaseOrder', id, prevStatus);
      throw e;
    }
  }
  return po;
}

function expenseAccountRole(expenseType) {
  const map = { PROJECT: 'EXPENSE_PROJECT', EQUIPMENT: 'EXPENSE_EQUIPMENT', EMPLOYEE: 'EXPENSE_EMPLOYEE', GOVERNMENT: 'EXPENSE_GOVERNMENT', ADMIN: 'EXPENSE_ADMIN', COMPANY: 'EXPENSE_GENERAL' };
  return map[expenseType] || 'EXPENSE_GENERAL';
}

function buildExpensePayload(data) {
  const amt = num(data.amount);
  const vatAmount = data._vatEnabled ? +(amt * VAT_RATE).toFixed(2) : 0;
  const totalAmount = +(amt + vatAmount).toFixed(2);
  const payload = { ...data, amount: amt, vatAmount, totalAmount };
  delete payload._vatEnabled;
  return { payload, amt, vatAmount, totalAmount };
}

async function createExpense(base44, data) {
  assertValid('EXPENSE', data);
  const { payload, amt, vatAmount, totalAmount } = buildExpensePayload(data);
  const accountRole = expenseAccountRole(payload.expenseType);
  // الحسابات التي اختارها المستخدم صراحةً من الدليل (إن وُجدت)
  const expenseAccount = payload.expenseAccountCode
    ? { code: payload.expenseAccountCode, name: payload.expenseAccountName || payload.description }
    : null;
  const paymentAccount = payload.paymentAccountCode
    ? { code: payload.paymentAccountCode, name: payload.paymentAccountName || 'سداد المصروف' }
    : null;
  const expense = await base44.asServiceRole.entities.Expense.create(payload);
  const ref = `EXP-${Date.now()}`;
  try {
    // بناء القيد مباشرةً من الحسابات المختارة حين يحدد المستخدم حساباً — اختياره الصريح
    // يتجاوز القالب. وإلا نرجع للقالب ثم للبناء الافتراضي حسب نوع المصروف.
    const je = (expenseAccount || paymentAccount)
      ? buildExpenseJE({ date: payload.date, description: payload.description, amount: amt, vatAmount, totalAmount, reference: ref, accountRole, expenseAccount, paymentAccount })
      : await buildJE(base44, 'EXPENSE',
          { entryNo: `JE-EXP-${ref}`, date: payload.date, description: `مصروف: ${payload.description}`, sourceType: 'Expense' },
          { base: amt, vat: vatAmount, total: totalAmount },
          () => buildExpenseJE({ date: payload.date, description: payload.description, amount: amt, vatAmount, totalAmount, reference: ref, accountRole }));
    await autoPostJE(base44, je);
  } catch (e) {
    await rollback(base44, 'Expense', expense.id);
    throw e;
  }
  return expense;
}

async function updateExpense(base44, id, data) {
  assertValid('EXPENSE', data);
  const { payload } = buildExpensePayload(data);
  return await base44.asServiceRole.entities.Expense.update(id, payload);
}

async function createRentalContract(base44, data) {
  assertValid('RENTAL_CONTRACT', data);
  const rate = num(data.rate);
  const delivery = num(data.deliveryFees);
  const base = rate + delivery;
  const { vat: vatAmount, total: totalAmount } = calcVAT(base);
  const payload = { ...data, rate, deliveryFees: delivery, totalAmount, vatAmount };
  const contract = await base44.asServiceRole.entities.RentalContract.create(payload);
  try {
    const je = await buildJE(base44, 'RENTAL_CONTRACT',
      { entryNo: `JE-RC-${payload.contractNo}`, date: payload.startDate || new Date().toISOString().slice(0, 10), description: `عقد تأجير ${payload.contractNo} — ${payload.clientName}`, sourceType: 'RentalContract' },
      { base, vat: vatAmount, total: totalAmount },
      () => buildRentalJE({ contractNo: payload.contractNo, date: payload.startDate, clientName: payload.clientName, base, vatAmount, totalAmount }));
    await autoPostJE(base44, je);
  } catch (e) {
    await rollback(base44, 'RentalContract', contract.id);
    throw e;
  }
  // الأثر الجانبي (حجز المعدة) يجري فقط بعد نجاح القيد — كي لا تبقى معدة محجوزة بلا عقد.
  if (data.equipmentId && payload.status === 'ACTIVE') {
    try { await base44.asServiceRole.entities.Equipment.update(data.equipmentId, { status: 'RENTED' }); } catch { /* المعدة قد لا تكون موجودة */ }
  }
  return contract;
}

async function updateRentalContract(base44, id, data, prevStatus, prevEquipmentStatus) {
  assertValid('RENTAL_CONTRACT', data);
  assertTransition('RENTAL_CONTRACT', prevStatus, data.status);
  const rate = num(data.rate);
  const delivery = num(data.deliveryFees);
  const base = rate + delivery;
  const { vat: vatAmount, total: totalAmount } = calcVAT(base);
  const payload = { ...data, rate, deliveryFees: delivery, totalAmount, vatAmount };
  const contract = await base44.asServiceRole.entities.RentalContract.update(id, payload);
  if (data.equipmentId) {
    const newStatus = payload.status === 'ACTIVE' ? 'RENTED' : (payload.status === 'COMPLETED' || payload.status === 'CANCELLED') ? 'AVAILABLE' : prevEquipmentStatus;
    if (newStatus && newStatus !== prevEquipmentStatus) {
      try { await base44.asServiceRole.entities.Equipment.update(data.equipmentId, { status: newStatus }); } catch { /* المعدة قد لا تكون موجودة */ }
    }
  }
  return contract;
}

// يرحّل قيدي المسير: الاستحقاق دائماً، والسداد عند الدفع فقط. يُعيد قائمة القيود المُنشأة.
async function postPayrollEntries(base44, data) {
  const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
  const posted = [];
  // 1) قيد الاستحقاق — يُنشأ لكل مسير مهما كانت حالته
  const accrualJE = buildPayrollAccrualJE(data, accounts);
  posted.push(await autoPostJE(base44, accrualJE));
  // 2) قيد السداد — عند الدفع فقط (طريقة الدفع والتاريخ مضمونان بالتحقق)
  if (data.status === 'PAID') {
    const paymentJE = buildPayrollPaymentJE(data, accounts);
    posted.push(await autoPostJE(base44, paymentJE));
  }
  return posted;
}

async function createPayrollRun(base44, data) {
  assertValid('PAYROLL', data);
  const payroll = await base44.asServiceRole.entities.PayrollRun.create(data);
  try {
    await postPayrollEntries(base44, data);
  } catch (e) {
    await rollback(base44, 'PayrollRun', payroll.id);
    throw e;
  }
  return payroll;
}

async function updatePayrollRun(base44, id, data, prevStatus) {
  assertValid('PAYROLL', data);
  assertTransition('PAYROLL', prevStatus, data.status);
  const payroll = await base44.asServiceRole.entities.PayrollRun.update(id, data);
  // قيد السداد يُرحّل فقط عند أول انتقال إلى "مدفوع". قيد الاستحقاق مُنشأ سلفاً (autoPostJE يمنع التكرار).
  if (data.status === 'PAID' && prevStatus !== 'PAID') {
    try {
      const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
      await autoPostJE(base44, buildPayrollPaymentJE(data, accounts));
    } catch (e) {
      await restoreStatus(base44, 'PayrollRun', id, prevStatus);
      throw e;
    }
  }
  return payroll;
}

// ─── تحصيلات العملاء ──────────────────────────────────────────────────────────
async function createClientPayment(base44, data) {
  assertValid('CLIENT_PAYMENT', data);
  const payload = { ...data, amount: num(data.amount) };
  const rec = await base44.asServiceRole.entities.ClientPayment.create(payload);
  try {
    const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
    await autoPostJE(base44, buildClientPaymentJE({ ...payload, id: rec.id }, accounts));
  } catch (e) {
    await rollback(base44, 'ClientPayment', rec.id);
    throw e;
  }
  return rec;
}

async function updateClientPayment(base44, id, data) {
  assertValid('CLIENT_PAYMENT', data);
  const payload = { ...data, amount: num(data.amount) };
  return await base44.asServiceRole.entities.ClientPayment.update(id, payload);
}

// ─── سداد الموردين ────────────────────────────────────────────────────────────
async function createSupplierPayment(base44, data) {
  assertValid('SUPPLIER_PAYMENT', data);
  const payload = { ...data, amount: num(data.amount) };
  const rec = await base44.asServiceRole.entities.SupplierPayment.create(payload);
  try {
    const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
    await autoPostJE(base44, buildSupplierPaymentJE({ ...payload, id: rec.id }, accounts));
  } catch (e) {
    await rollback(base44, 'SupplierPayment', rec.id);
    throw e;
  }
  return rec;
}

async function updateSupplierPayment(base44, id, data) {
  assertValid('SUPPLIER_PAYMENT', data);
  const payload = { ...data, amount: num(data.amount) };
  return await base44.asServiceRole.entities.SupplierPayment.update(id, payload);
}

// ─── فواتير الموردين ──────────────────────────────────────────────────────────
function buildSupplierInvoicePayload(data) {
  const baseAmount = num(data.baseAmount);
  const vatAmount = num(data.vatAmount);
  const totalAmount = +(baseAmount + vatAmount).toFixed(2);
  return { ...data, baseAmount, vatAmount, totalAmount, paidAmount: num(data.paidAmount) };
}

async function createSupplierInvoice(base44, data) {
  assertValid('SUPPLIER_INVOICE', data);
  const payload = buildSupplierInvoicePayload(data);
  const inv = await base44.asServiceRole.entities.SupplierInvoice.create(payload);
  try {
    const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
    await autoPostJE(base44, buildSupplierInvoiceJE(payload, accounts));
  } catch (e) {
    await rollback(base44, 'SupplierInvoice', inv.id);
    throw e;
  }
  return inv;
}

async function updateSupplierInvoice(base44, id, data) {
  assertValid('SUPPLIER_INVOICE', data);
  const payload = buildSupplierInvoicePayload(data);
  return await base44.asServiceRole.entities.SupplierInvoice.update(id, payload);
}

// ─── فواتير التأجير ───────────────────────────────────────────────────────────
function buildRentalInvoicePayload(data) {
  const baseAmount = num(data.baseAmount);
  const extraCharges = num(data.extraCharges);
  const net = +(baseAmount + extraCharges).toFixed(2);
  const vatAmount = +(net * VAT_RATE).toFixed(2);
  const totalAmount = +(net + vatAmount).toFixed(2);
  return { ...data, baseAmount, extraCharges, net, vatAmount, totalAmount, paidAmount: num(data.paidAmount) };
}

async function createRentalInvoice(base44, data) {
  assertValid('RENTAL_INVOICE', data);
  const p = buildRentalInvoicePayload(data);
  const payload = { ...p }; delete payload.net;
  const inv = await base44.asServiceRole.entities.RentalInvoice.create(payload);
  try {
    const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
    await autoPostJE(base44, buildRentalInvoiceJE({ ...payload, baseAmount: p.net }, accounts));
  } catch (e) {
    await rollback(base44, 'RentalInvoice', inv.id);
    throw e;
  }
  return inv;
}

async function updateRentalInvoice(base44, id, data) {
  assertValid('RENTAL_INVOICE', data);
  const p = buildRentalInvoicePayload(data);
  const payload = { ...p }; delete payload.net;
  return await base44.asServiceRole.entities.RentalInvoice.update(id, payload);
}

// تراجع (إنشاء): احذف السجل المصدر حين يفشل ترحيل القيد
async function rollback(base44, entityName, id) {
  try { await base44.asServiceRole.entities[entityName].delete(id); } catch { /* السجل قد يكون حُذف */ }
}

// تراجع (تحديث): أعِد السجل لحالته السابقة حين يفشل ترحيل القيد بعد تغيير الحالة
async function restoreStatus(base44, entityName, id, prevStatus) {
  if (!prevStatus) return;
  try { await base44.asServiceRole.entities[entityName].update(id, { status: prevStatus }); } catch { /* السجل قد يكون حُذف */ }
}

// ─── التوجيه ──────────────────────────────────────────────────────────────────
const HANDLERS = {
  SALES_INVOICE:   { create: (b, p) => createSalesInvoice(b, p.data), update: (b, p) => updateSalesInvoice(b, p.id, p.data, p.prevStatus) },
  PURCHASE_ORDER:  { create: (b, p) => createPurchaseOrder(b, p.data), update: (b, p) => updatePurchaseOrder(b, p.id, p.data, p.prevStatus) },
  EXPENSE:         { create: (b, p) => createExpense(b, p.data), update: (b, p) => updateExpense(b, p.id, p.data) },
  RENTAL_CONTRACT: { create: (b, p) => createRentalContract(b, p.data), update: (b, p) => updateRentalContract(b, p.id, p.data, p.prevStatus, p.prevEquipmentStatus) },
  PAYROLL:         { create: (b, p) => createPayrollRun(b, p.data), update: (b, p) => updatePayrollRun(b, p.id, p.data, p.prevStatus) },
  CLIENT_PAYMENT:  { create: (b, p) => createClientPayment(b, p.data), update: (b, p) => updateClientPayment(b, p.id, p.data) },
  SUPPLIER_PAYMENT:{ create: (b, p) => createSupplierPayment(b, p.data), update: (b, p) => updateSupplierPayment(b, p.id, p.data) },
  SUPPLIER_INVOICE:{ create: (b, p) => createSupplierInvoice(b, p.data), update: (b, p) => updateSupplierInvoice(b, p.id, p.data) },
  RENTAL_INVOICE:  { create: (b, p) => createRentalInvoice(b, p.data), update: (b, p) => updateRentalInvoice(b, p.id, p.data) },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'غير مصرّح' }, { status: 401 });

    const body = await req.json();
    const { operation, mode } = body || {};
    const group = HANDLERS[operation];
    if (!group) return Response.json({ error: `عملية غير معروفة: ${operation}` }, { status: 400 });
    const handler = group[mode];
    if (!handler) return Response.json({ error: `وضع غير معروف: ${mode}` }, { status: 400 });

    const result = await handler(base44, body);
    return Response.json({ success: true, record: result });
  } catch (error) {
    return Response.json({ success: false, error: error?.message || 'فشل تنفيذ العملية' }, { status: 400 });
  }
});