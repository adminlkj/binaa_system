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
  INVENTORY_MATERIALS:  { code: '1131', name: 'مخزون مواد البناء' },
  OPENING_BALANCE_EQUITY: { code: '3900', name: 'رصيد افتتاحي — حقوق ملكية' },
  INVENTORY_LOSS:       { code: '5160', name: 'خسائر تلف وهدر المخزون' },
  INVENTORY_GAIN:       { code: '4910', name: 'فروقات جرد المخزون (زيادة)' },
  STAFF_RECEIVABLE:     { code: '1125', name: 'ذمم مدينة — تحميلات على الموظفين' },
  SUB_PAYABLES:         { code: '2120', name: 'ذمم دائنة — مقاولو الباطن' },
  RETENTION_PAYABLE:    { code: '2130', name: 'محتجزات مقاولي الباطن' },
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
  SUBCONTRACTOR_INVOICE: [
    { m: 'رقم المستخلص مطلوب', t: (d) => !isBlank(d.invoiceNo) },
    { m: 'اختيار مقاول الباطن مطلوب', t: (d) => !isBlank(d.subcontractorId) },
    { m: 'المبلغ الأساسي يجب أن يكون أكبر من صفر', t: (d) => num(d.baseAmount) > 0 },
  ],
  RENTAL_INVOICE: [
    { m: 'رقم الفاتورة مطلوب', t: (d) => !isBlank(d.invoiceNo) },
    { m: 'تاريخ الفاتورة مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'قيمة الفاتورة يجب أن تكون أكبر من صفر', t: (d) => num(d.baseAmount) + num(d.extraCharges) > 0 },
  ],
  STOCK_MOVEMENT: [
    { m: 'تاريخ الحركة مطلوب', t: (d) => !isBlank(d.date) },
    { m: 'اختيار الصنف مطلوب', t: (d) => !isBlank(d.itemId) },
    { m: 'الكمية يجب أن تكون أكبر من صفر', t: (d) => num(d.quantity) > 0 },
    { m: 'نوع الحركة غير صحيح', t: (d) => ['RECEIVE', 'ISSUE', 'TRANSFER', 'DAMAGE_NORMAL', 'DAMAGE_ABNORMAL', 'ADJUST_INCREASE', 'ADJUST_DECREASE'].includes(d.type) },
    { m: 'مخزن الاستلام مطلوب', t: (d) => !['RECEIVE', 'ADJUST_INCREASE'].includes(d.type) || !isBlank(d.toWarehouseId) },
    { m: 'مخزن الصرف مطلوب', t: (d) => !['ISSUE', 'DAMAGE_NORMAL', 'DAMAGE_ABNORMAL', 'ADJUST_DECREASE'].includes(d.type) || !isBlank(d.fromWarehouseId) },
    { m: 'مخزن المصدر ومخزن الوجهة مطلوبان للتحويل', t: (d) => d.type !== 'TRANSFER' || (!isBlank(d.fromWarehouseId) && !isBlank(d.toWarehouseId)) },
    { m: 'لا يمكن التحويل إلى نفس المخزن', t: (d) => d.type !== 'TRANSFER' || d.fromWarehouseId !== d.toWarehouseId },
    { m: 'اختيار المورد مطلوب عند الاستلام بذمة مورد', t: (d) => d.type !== 'RECEIVE' || d.sourceType !== 'SUPPLIER' || !isBlank(d.supplierId) },
    { m: 'اختيار الحساب النقدي مطلوب عند الشراء النقدي', t: (d) => d.type !== 'RECEIVE' || d.sourceType !== 'CASH' || !isBlank(d.cashAccountCode) },
    { m: 'اختيار المسؤول المُحمّل عليه التلف مطلوب في التلف غير الطبيعي', t: (d) => d.type !== 'DAMAGE_ABNORMAL' || !isBlank(d.responsibleName) },
    { m: 'تكلفة الوحدة مطلوبة للتلف وتسويات الجرد لإثبات القيمة المحاسبية', t: (d) => !['DAMAGE_NORMAL', 'DAMAGE_ABNORMAL', 'ADJUST_INCREASE', 'ADJUST_DECREASE'].includes(d.type) || num(d.unitCost) > 0 },
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

// أدوار الذمم التي تُوسم بالطرف (عميل/مورد) لبناء الكشوفات من القيود المرحّلة.
const PARTY_ROLE_TYPE = { RECEIVABLES: 'CLIENT', PAYABLES: 'SUPPLIER', SUB_PAYABLES: 'SUBCONTRACTOR' };

function buildLinesFromTemplate(template, amounts, accounts, description, party) {
  const lines = [];
  const unmappedRoles = [];
  for (const tl of template.lines || []) {
    const amount = +(amounts[tl.amountField] || 0);
    if (tl.optional && amount <= 0) continue;
    const acc = resolveAccount(tl.semanticRole, accounts);
    if (acc.unmapped) unmappedRoles.push(tl.semanticRole);
    const line = {
      accountCode: acc.code, accountName: acc.name,
      debit: tl.side === 'DEBIT' ? amount : 0,
      credit: tl.side === 'CREDIT' ? amount : 0,
      description: tl.description || description || '',
    };
    // وسم سطر الذمم بالطرف المطابق لدوره الدلالي (عميل لذمم مدينة، مورد لذمم دائنة).
    if (party && PARTY_ROLE_TYPE[tl.semanticRole] === party.type) {
      line.partyType = party.type; line.partyId = party.id; line.partyName = party.name;
    }
    lines.push(line);
  }
  const totalDebit = +lines.reduce((s, l) => s + l.debit, 0).toFixed(2);
  const totalCredit = +lines.reduce((s, l) => s + l.credit, 0).toFixed(2);
  return { lines, totalDebit, totalCredit, unmappedRoles };
}

async function buildJEFromTemplate(base44, operationType, meta, amounts, party) {
  const [accounts, templates] = await Promise.all([
    base44.asServiceRole.entities.ChartAccount.list('code', 1000),
    base44.asServiceRole.entities.PostingTemplate.filter({ operationType, isActive: true }),
  ]);
  const template = (templates || [])[0];
  if (!template) return null;
  const { lines, totalDebit, totalCredit, unmappedRoles } = buildLinesFromTemplate(template, amounts, accounts || [], meta.description, party);
  if (unmappedRoles.length > 0) {
    throw new Error(`أدوار محاسبية غير معرّفة في الدليل: ${unmappedRoles.join(', ')} — لا يمكن ترحيل القيد ${meta.entryNo}`);
  }
  return { entryNo: meta.entryNo, date: meta.date, description: meta.description, sourceType: meta.sourceType, isPosted: true, totalDebit, totalCredit, lines };
}

async function buildJE(base44, operationType, meta, amounts, fallbackBuilder, party) {
  const fromTemplate = await buildJEFromTemplate(base44, operationType, meta, amounts, party);
  return fromTemplate || fallbackBuilder();
}

// ─── بناة القيود الثابتة ──────────────────────────────────────────────────────
function buildSalesInvoiceJE({ invoiceNo, date, clientId, clientName, subtotal, vatAmount, totalAmount, invoiceType }) {
  const rev = invoiceType === 'RENTAL' ? ACCOUNTS.REVENUE_RENTAL : invoiceType === 'SERVICE' ? ACCOUNTS.REVENUE_SERVICE : ACCOUNTS.REVENUE_CONSTRUCTION;
  return {
    entryNo: `JE-SINV-${invoiceNo}`, date, description: `فاتورة مبيعات ${invoiceNo} — ${clientName}`, sourceType: 'SalesInvoice', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: ACCOUNTS.RECEIVABLES.code, accountName: ACCOUNTS.RECEIVABLES.name, debit: totalAmount, credit: 0, description: `فاتورة ${invoiceNo}`, partyType: 'CLIENT', partyId: clientId, partyName: clientName },
      { accountCode: rev.code, accountName: rev.name, debit: 0, credit: subtotal, description: 'الإيراد الأساسي' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_PAYABLE.code, accountName: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

function buildPurchaseOrderJE({ orderNo, date, supplierId, supplierName, baseAmount, vatAmount, grandTotal }) {
  return {
    entryNo: `JE-PO-${orderNo}`, date, description: `أمر شراء ${orderNo} — ${supplierName}`, sourceType: 'PurchaseOrder', isPosted: true,
    totalDebit: grandTotal, totalCredit: grandTotal,
    lines: [
      { accountCode: ACCOUNTS.EXPENSE_PURCHASE.code, accountName: ACCOUNTS.EXPENSE_PURCHASE.name, debit: baseAmount, credit: 0, description: 'مواد وبضاعة' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_RECEIVABLE.code, accountName: ACCOUNTS.VAT_RECEIVABLE.name, debit: vatAmount, credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: ACCOUNTS.PAYABLES.code, accountName: ACCOUNTS.PAYABLES.name, debit: 0, credit: grandTotal, description: `مستحقات ${supplierName}`, partyType: 'SUPPLIER', partyId: supplierId, partyName: supplierName },
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

function buildRentalJE({ contractNo, date, clientId, clientName, base, vatAmount, totalAmount }) {
  return {
    entryNo: `JE-RC-${contractNo}`, date: date || new Date().toISOString().slice(0, 10), description: `عقد تأجير ${contractNo} — ${clientName}`, sourceType: 'RentalContract', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: ACCOUNTS.RECEIVABLES.code, accountName: ACCOUNTS.RECEIVABLES.name, debit: totalAmount, credit: 0, description: `عقد ${contractNo}`, partyType: 'CLIENT', partyId: clientId, partyName: clientName },
      { accountCode: ACCOUNTS.REVENUE_RENTAL.code, accountName: ACCOUNTS.REVENUE_RENTAL.name, debit: 0, credit: base, description: 'إيراد التأجير' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_PAYABLE.code, accountName: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

// تحصيل من عميل: من ح/ النقدية المختارة (مدين) إلى ح/ ذمم العملاء (دائن)
function buildClientPaymentJE({ paymentNo, date, clientId, clientName, amount, cashAccountCode, cashAccountName }, accounts) {
  const receivables = resolveAccount('RECEIVABLES', accounts);
  const cash = { code: cashAccountCode, name: cashAccountName || 'النقدية' };
  const ref = paymentNo || `${date}-${clientName || ''}`;
  return {
    entryNo: `JE-RCPT-${ref}`, date, description: `تحصيل من ${clientName || 'عميل'}`, sourceType: 'ClientPayment', isPosted: true,
    totalDebit: amount, totalCredit: amount,
    lines: [
      { accountCode: cash.code, accountName: cash.name, debit: amount, credit: 0, description: `تحصيل في ${cash.name}` },
      { accountCode: receivables.code, accountName: receivables.name, debit: 0, credit: amount, description: `سداد ذمة ${clientName || ''}`, partyType: 'CLIENT', partyId: clientId, partyName: clientName },
    ],
  };
}

// سداد لمورد: من ح/ ذمم الموردين (مدين) إلى ح/ النقدية المختارة (دائن)
function buildSupplierPaymentJE({ paymentNo, date, supplierId, supplierName, amount, cashAccountCode, cashAccountName }, accounts) {
  const payables = resolveAccount('PAYABLES', accounts);
  const cash = { code: cashAccountCode, name: cashAccountName || 'النقدية' };
  const ref = paymentNo || `${date}-${supplierName || ''}`;
  return {
    entryNo: `JE-PMT-${ref}`, date, description: `سداد إلى ${supplierName || 'مورد'}`, sourceType: 'SupplierPayment', isPosted: true,
    totalDebit: amount, totalCredit: amount,
    lines: [
      { accountCode: payables.code, accountName: payables.name, debit: amount, credit: 0, description: `سداد ذمة ${supplierName || ''}`, partyType: 'SUPPLIER', partyId: supplierId, partyName: supplierName },
      { accountCode: cash.code, accountName: cash.name, debit: 0, credit: amount, description: `دفع من ${cash.name}` },
    ],
  };
}

// فاتورة مورد (التزام): من ح/ مشتريات + ضريبة مدفوعة (مدين) إلى ح/ ذمم الموردين (دائن)
// مركز التكلفة = المشروع (فتقع التكلفة على المشروع) وإلا المخزن.
function buildSupplierInvoiceJE({ invoiceNo, date, supplierId, supplierName, baseAmount, vatAmount, totalAmount, projectName, warehouseName }, accounts) {
  const purchase = resolveAccount('EXPENSE_PURCHASE', accounts);
  const vatRec = resolveAccount('VAT_RECEIVABLE', accounts);
  const payables = resolveAccount('PAYABLES', accounts);
  const costCenter = projectName || warehouseName || '';
  return {
    entryNo: `JE-SUPINV-${invoiceNo}`, date, description: `فاتورة مورد ${invoiceNo} — ${supplierName || ''}`, sourceType: 'SupplierInvoice', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: purchase.code, accountName: purchase.name, debit: baseAmount, credit: 0, description: `مشتريات ومواد${projectName ? ` — ${projectName}` : ''}`, costCenter },
      ...(vatAmount > 0 ? [{ accountCode: vatRec.code, accountName: vatRec.name, debit: vatAmount, credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: payables.code, accountName: payables.name, debit: 0, credit: totalAmount, description: `مستحقات ${supplierName || ''}`, partyType: 'SUPPLIER', partyId: supplierId, partyName: supplierName },
    ],
  };
}

// مستخلص مقاول باطن (التزام): من ح/ مصروفات المشاريع + ضريبة مدفوعة (مدين)
//   إلى ح/ ذمم مقاولي الباطن (بالصافي بعد المحتجز) + ح/ محتجزات مقاولي الباطن (دائن).
function buildSubcontractorInvoiceJE({ invoiceNo, subcontractorId, subcontractorName, date, baseAmount, retentionAmount, vatAmount, totalAmount }, accounts) {
  const expense = resolveAccount('EXPENSE_PROJECT', accounts);
  const vatRec = resolveAccount('VAT_RECEIVABLE', accounts);
  const subPay = resolveAccount('SUB_PAYABLES', accounts);
  const retention = resolveAccount('RETENTION_PAYABLE', accounts);
  const net = +(num(baseAmount) - num(retentionAmount)).toFixed(2);
  const payable = +(net + num(vatAmount)).toFixed(2);
  return {
    entryNo: `JE-SUBINV-${invoiceNo}`, date: date || new Date().toISOString().slice(0, 10), description: `مستخلص مقاول باطن ${invoiceNo} — ${subcontractorName || ''}`, sourceType: 'SubcontractorInvoice', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: expense.code, accountName: expense.name, debit: num(baseAmount), credit: 0, description: 'أعمال مقاول باطن' },
      ...(num(vatAmount) > 0 ? [{ accountCode: vatRec.code, accountName: vatRec.name, debit: num(vatAmount), credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: subPay.code, accountName: subPay.name, debit: 0, credit: payable, description: `مستحقات ${subcontractorName || ''}`, partyType: 'SUBCONTRACTOR', partyId: subcontractorId, partyName: subcontractorName },
      ...(num(retentionAmount) > 0 ? [{ accountCode: retention.code, accountName: retention.name, debit: 0, credit: num(retentionAmount), description: `محتجز ${subcontractorName || ''}`, partyType: 'SUBCONTRACTOR', partyId: subcontractorId, partyName: subcontractorName }] : []),
    ],
  };
}

// فاتورة تأجير (إيراد): من ح/ ذمم العملاء (مدين) إلى ح/ إيراد التأجير + ضريبة محصلة (دائن)
function buildRentalInvoiceJE({ invoiceNo, date, clientId, clientName, baseAmount, vatAmount, totalAmount }, accounts) {
  const receivables = resolveAccount('RECEIVABLES', accounts);
  const revenue = resolveAccount('REVENUE_RENTAL', accounts);
  const vatPay = resolveAccount('VAT_PAYABLE', accounts);
  return {
    entryNo: `JE-RINV-${invoiceNo}`, date, description: `فاتورة تأجير ${invoiceNo} — ${clientName || ''}`, sourceType: 'RentalInvoice', isPosted: true,
    totalDebit: totalAmount, totalCredit: totalAmount,
    lines: [
      { accountCode: receivables.code, accountName: receivables.name, debit: totalAmount, credit: 0, description: `فاتورة ${invoiceNo}`, partyType: 'CLIENT', partyId: clientId, partyName: clientName },
      { accountCode: revenue.code, accountName: revenue.name, debit: 0, credit: baseAmount, description: 'إيراد التأجير' },
      ...(vatAmount > 0 ? [{ accountCode: vatPay.code, accountName: vatPay.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

// ─── الحركات المخزنية ─────────────────────────────────────────────────────────
// استلام: من ح/ المخزون (مدين) إلى ح/ (ذمم المورد | النقدية | رصيد افتتاحي) دائن.
// صرف على مشروع: من ح/ مصروفات المشاريع (مدين) إلى ح/ المخزون (دائن) — نقل القيمة إلى تكلفة المشروع.
// تحويل بين مخازن: قيد تذكيري بنفس حساب المخزون مع وسم مركز التكلفة لكل طرف.
function buildStockMovementJE(m, accounts) {
  const inventory = resolveAccount('INVENTORY_MATERIALS', accounts);
  const total = +num(m.totalCost).toFixed(2);
  const itemDesc = `${m.itemName || ''}${m.quantity ? ` × ${m.quantity}` : ''}`;

  if (m.type === 'RECEIVE') {
    let creditAcc, creditParty = null, creditDesc;
    if (m.sourceType === 'SUPPLIER') {
      creditAcc = resolveAccount('PAYABLES', accounts);
      creditParty = { type: 'SUPPLIER', id: m.supplierId, name: m.supplierName };
      creditDesc = `مستحقات ${m.supplierName || 'مورد'}`;
    } else if (m.sourceType === 'CASH') {
      creditAcc = { code: m.cashAccountCode, name: m.cashAccountName || 'النقدية' };
      creditDesc = `شراء نقدي من ${creditAcc.name}`;
    } else {
      creditAcc = resolveAccount('OPENING_BALANCE_EQUITY', accounts);
      creditDesc = 'رصيد افتتاحي مخزون';
    }
    const creditLine = { accountCode: creditAcc.code, accountName: creditAcc.name, debit: 0, credit: total, description: creditDesc };
    if (creditParty && creditParty.id) { creditLine.partyType = creditParty.type; creditLine.partyId = creditParty.id; creditLine.partyName = creditParty.name; }
    return {
      entryNo: `JE-STK-${m.movementNo}`, date: m.date, description: `استلام مخزون ${m.movementNo} — ${itemDesc}`, sourceType: 'StockMovement', isPosted: true,
      totalDebit: total, totalCredit: total,
      lines: [
        { accountCode: inventory.code, accountName: inventory.name, debit: total, credit: 0, description: `إدخال ${itemDesc} — ${m.toWarehouseName || ''}`, costCenter: m.toWarehouseName || '' },
        creditLine,
      ],
    };
  }

  if (m.type === 'ISSUE') {
    const expense = resolveAccount('EXPENSE_PROJECT', accounts);
    return {
      entryNo: `JE-STK-${m.movementNo}`, date: m.date, description: `صرف مخزون ${m.movementNo} — ${itemDesc}`, sourceType: 'StockMovement', isPosted: true,
      totalDebit: total, totalCredit: total,
      lines: [
        { accountCode: expense.code, accountName: expense.name, debit: total, credit: 0, description: `استهلاك ${itemDesc}${m.projectName ? ` — ${m.projectName}` : ''}`, costCenter: m.projectName || '' },
        { accountCode: inventory.code, accountName: inventory.name, debit: 0, credit: total, description: `صرف من ${m.fromWarehouseName || ''}`, costCenter: m.fromWarehouseName || '' },
      ],
    };
  }

  // DAMAGE_NORMAL — تلف طبيعي: خسارة تشغيلية. من ح/ خسائر تلف المخزون (مدين) إلى ح/ المخزون (دائن).
  if (m.type === 'DAMAGE_NORMAL') {
    const loss = resolveAccount('INVENTORY_LOSS', accounts);
    return {
      entryNo: `JE-STK-${m.movementNo}`, date: m.date, description: `تلف طبيعي ${m.movementNo} — ${itemDesc}`, sourceType: 'StockMovement', isPosted: true,
      totalDebit: total, totalCredit: total,
      lines: [
        { accountCode: loss.code, accountName: loss.name, debit: total, credit: 0, description: `تلف طبيعي ${itemDesc}${m.reason ? ` — ${m.reason}` : ''}`, costCenter: m.fromWarehouseName || '' },
        { accountCode: inventory.code, accountName: inventory.name, debit: 0, credit: total, description: `إخراج تالف من ${m.fromWarehouseName || ''}`, costCenter: m.fromWarehouseName || '' },
      ],
    };
  }

  // DAMAGE_ABNORMAL — تلف غير طبيعي محمّل على مسؤول المخزن: من ح/ ذمم مدينة على الموظفين (مدين) إلى ح/ المخزون (دائن).
  if (m.type === 'DAMAGE_ABNORMAL') {
    const staff = resolveAccount('STAFF_RECEIVABLE', accounts);
    const staffLine = { accountCode: staff.code, accountName: staff.name, debit: total, credit: 0, description: `تحميل تلف على ${m.responsibleName || 'المسؤول'}${m.reason ? ` — ${m.reason}` : ''}`, costCenter: m.fromWarehouseName || '' };
    if (m.responsibleId) { staffLine.partyType = 'EMPLOYEE'; staffLine.partyId = m.responsibleId; staffLine.partyName = m.responsibleName; }
    return {
      entryNo: `JE-STK-${m.movementNo}`, date: m.date, description: `تلف غير طبيعي ${m.movementNo} — ${itemDesc} — تحميل على ${m.responsibleName || ''}`, sourceType: 'StockMovement', isPosted: true,
      totalDebit: total, totalCredit: total,
      lines: [
        staffLine,
        { accountCode: inventory.code, accountName: inventory.name, debit: 0, credit: total, description: `إخراج تالف من ${m.fromWarehouseName || ''}`, costCenter: m.fromWarehouseName || '' },
      ],
    };
  }

  // ADJUST_INCREASE — تسوية جرد بالزيادة: من ح/ المخزون (مدين) إلى ح/ فروقات جرد (دائن).
  if (m.type === 'ADJUST_INCREASE') {
    const gain = resolveAccount('INVENTORY_GAIN', accounts);
    return {
      entryNo: `JE-STK-${m.movementNo}`, date: m.date, description: `تسوية جرد بالزيادة ${m.movementNo} — ${itemDesc}`, sourceType: 'StockMovement', isPosted: true,
      totalDebit: total, totalCredit: total,
      lines: [
        { accountCode: inventory.code, accountName: inventory.name, debit: total, credit: 0, description: `زيادة جرد في ${m.toWarehouseName || ''}${m.reason ? ` — ${m.reason}` : ''}`, costCenter: m.toWarehouseName || '' },
        { accountCode: gain.code, accountName: gain.name, debit: 0, credit: total, description: 'فروقات جرد بالزيادة' },
      ],
    };
  }

  // ADJUST_DECREASE — تسوية جرد بالعجز: من ح/ خسائر تلف/هدر المخزون (مدين) إلى ح/ المخزون (دائن).
  if (m.type === 'ADJUST_DECREASE') {
    const loss = resolveAccount('INVENTORY_LOSS', accounts);
    return {
      entryNo: `JE-STK-${m.movementNo}`, date: m.date, description: `تسوية جرد بالعجز ${m.movementNo} — ${itemDesc}`, sourceType: 'StockMovement', isPosted: true,
      totalDebit: total, totalCredit: total,
      lines: [
        { accountCode: loss.code, accountName: loss.name, debit: total, credit: 0, description: `عجز جرد في ${m.fromWarehouseName || ''}${m.reason ? ` — ${m.reason}` : ''}`, costCenter: m.fromWarehouseName || '' },
        { accountCode: inventory.code, accountName: inventory.name, debit: 0, credit: total, description: `إنقاص عجز من ${m.fromWarehouseName || ''}`, costCenter: m.fromWarehouseName || '' },
      ],
    };
  }

  // TRANSFER — نفس حساب المخزون على الطرفين، مع وسم مركز التكلفة لكل مخزن.
  return {
    entryNo: `JE-STK-${m.movementNo}`, date: m.date, description: `تحويل مخزون ${m.movementNo} — ${itemDesc}`, sourceType: 'StockMovement', isPosted: true,
    totalDebit: total, totalCredit: total,
    lines: [
      { accountCode: inventory.code, accountName: inventory.name, debit: total, credit: 0, description: `تحويل وارد إلى ${m.toWarehouseName || ''}`, costCenter: m.toWarehouseName || '' },
      { accountCode: inventory.code, accountName: inventory.name, debit: 0, credit: total, description: `تحويل صادر من ${m.fromWarehouseName || ''}`, costCenter: m.fromWarehouseName || '' },
    ],
  };
}

// يعدّل رصيد صنف في مخزن محدّد: يزيد/ينقص كمية سجل الصنف المطابق للمخزن.
// إن لم يوجد سجل للصنف في المخزن الوجهة عند الاستلام/التحويل، يُنشأ سجل جديد.
async function adjustStock(base44, itemId, warehouseId, warehouseName, deltaQty, unitCost) {
  if (!warehouseId) return;
  const item = await base44.asServiceRole.entities.InventoryItem.get(itemId);
  if (!item) return;
  // السجل الذي يمثّل رصيد الصنف في هذا المخزن: نفس الكود + نفس المخزن.
  const inWarehouse = (await base44.asServiceRole.entities.InventoryItem.filter({ code: item.code, warehouseId })) || [];
  if (inWarehouse.length > 0) {
    const rec = inWarehouse[0];
    const newQty = +(num(rec.quantity) + deltaQty).toFixed(3);
    await base44.asServiceRole.entities.InventoryItem.update(rec.id, { quantity: newQty });
  } else if (deltaQty > 0) {
    await base44.asServiceRole.entities.InventoryItem.create({
      code: item.code, name: item.name, nameEn: item.nameEn, category: item.category, unit: item.unit,
      quantity: +deltaQty.toFixed(3), reorderLevel: item.reorderLevel, unitCost: num(unitCost) || item.unitCost,
      warehouseId, warehouseName, isActive: true,
    });
  }
}

async function createStockMovement(base44, data) {
  assertValid('STOCK_MOVEMENT', data);
  const quantity = num(data.quantity);
  const unitCost = num(data.unitCost);
  const totalCost = +(quantity * unitCost).toFixed(2);
  const payload = { ...data, quantity, unitCost, totalCost, journalEntryNo: `JE-STK-${data.movementNo}` };
  const rec = await base44.asServiceRole.entities.StockMovement.create(payload);
  try {
    // القيد يُرحّل فقط عند وجود قيمة (تكلفة > 0)؛ الحركات صفرية القيمة تحدّث الكمية فقط.
    if (totalCost > 0) {
      const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
      await autoPostJE(base44, buildStockMovementJE(payload, accounts));
    }
    // تحديث أرصدة المخازن حسب نوع الحركة.
    if (payload.type === 'RECEIVE' || payload.type === 'ADJUST_INCREASE') {
      await adjustStock(base44, payload.itemId, payload.toWarehouseId, payload.toWarehouseName, quantity, unitCost);
    } else if (['ISSUE', 'DAMAGE_NORMAL', 'DAMAGE_ABNORMAL', 'ADJUST_DECREASE'].includes(payload.type)) {
      await adjustStock(base44, payload.itemId, payload.fromWarehouseId, payload.fromWarehouseName, -quantity, unitCost);
    } else {
      await adjustStock(base44, payload.itemId, payload.fromWarehouseId, payload.fromWarehouseName, -quantity, unitCost);
      await adjustStock(base44, payload.itemId, payload.toWarehouseId, payload.toWarehouseName, quantity, unitCost);
    }
  } catch (e) {
    await rollback(base44, 'StockMovement', rec.id);
    throw e;
  }
  return rec;
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

// الإنشاء يحفظ الفاتورة كمسودة فقط بلا قيد — القيد يُرحّل عند الاعتماد.
async function createSalesInvoice(base44, data) {
  assertValid('SALES_INVOICE', data);
  const { base: subtotal, vat: vatAmount, total: totalAmount } = calcVAT(data.subtotal, num(data.vatRate) || VAT_RATE);
  const payload = { ...data, subtotal, vatRate: num(data.vatRate) || VAT_RATE, vatAmount, totalAmount, paidAmount: num(data.paidAmount), status: 'DRAFT' };
  return await base44.asServiceRole.entities.SalesInvoice.create(payload);
}

async function updateSalesInvoice(base44, id, data, prevStatus) {
  assertValid('SALES_INVOICE', data);
  assertTransition('SALES_INVOICE', prevStatus, data.status);
  const { base: subtotal, vat: vatAmount, total: totalAmount } = calcVAT(data.subtotal, num(data.vatRate) || VAT_RATE);
  const payload = { ...data, subtotal, vatRate: num(data.vatRate) || VAT_RATE, vatAmount, totalAmount, paidAmount: num(data.paidAmount) };
  return await base44.asServiceRole.entities.SalesInvoice.update(id, payload);
}

// اعتماد فاتورة مبيعات: يرحّل قيد الإيراد ويحوّل الحالة إلى معتمدة.
async function approveSalesInvoice(base44, id) {
  const inv = await base44.asServiceRole.entities.SalesInvoice.get(id);
  if (!inv) throw new Error('الفاتورة غير موجودة');
  if (inv.status !== 'DRAFT') throw new Error('لا يمكن اعتماد إلا الفواتير التي في حالة مسودة');
  const je = await buildJE(base44, 'SALES_INVOICE',
    { entryNo: `JE-SINV-${inv.invoiceNo}`, date: inv.date, description: `فاتورة مبيعات ${inv.invoiceNo} — ${inv.clientName}`, sourceType: 'SalesInvoice' },
    { base: num(inv.subtotal), vat: num(inv.vatAmount), total: num(inv.totalAmount) },
    () => buildSalesInvoiceJE({ ...inv }),
    { type: 'CLIENT', id: inv.clientId, name: inv.clientName });
  await autoPostJE(base44, je);
  return await base44.asServiceRole.entities.SalesInvoice.update(id, { status: 'APPROVED' });
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
        () => buildPurchaseOrderJE({ orderNo: payload.orderNo, date: payload.date, supplierId: payload.supplierId, supplierName: payload.supplierName, baseAmount, vatAmount, grandTotal }),
        { type: 'SUPPLIER', id: payload.supplierId, name: payload.supplierName });
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
        () => buildPurchaseOrderJE({ orderNo: payload.orderNo, date: payload.date, supplierId: payload.supplierId, supplierName: payload.supplierName, baseAmount, vatAmount, grandTotal }),
        { type: 'SUPPLIER', id: payload.supplierId, name: payload.supplierName });
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
  // العقد مرجعي فقط ولا ينشئ أي قيد محاسبي — الإيراد والذمة ينشآن من فاتورة التأجير.
  const contract = await base44.asServiceRole.entities.RentalContract.create(payload);
  // حجز المعدة عند تفعيل العقد.
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

// الإنشاء يحفظ الفاتورة كمسودة فقط بلا قيد — القيد يُرحّل عند الاعتماد.
async function createSupplierInvoice(base44, data) {
  assertValid('SUPPLIER_INVOICE', data);
  const payload = { ...buildSupplierInvoicePayload(data), status: 'DRAFT' };
  return await base44.asServiceRole.entities.SupplierInvoice.create(payload);
}

async function updateSupplierInvoice(base44, id, data) {
  assertValid('SUPPLIER_INVOICE', data);
  const payload = buildSupplierInvoicePayload(data);
  return await base44.asServiceRole.entities.SupplierInvoice.update(id, payload);
}

// اعتماد فاتورة مورد: يرحّل قيد الالتزام ويحوّل الحالة إلى معتمدة.
async function approveSupplierInvoice(base44, id) {
  const inv = await base44.asServiceRole.entities.SupplierInvoice.get(id);
  if (!inv) throw new Error('الفاتورة غير موجودة');
  if (inv.status !== 'DRAFT') throw new Error('لا يمكن اعتماد إلا الفواتير التي في حالة مسودة');
  const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
  await autoPostJE(base44, buildSupplierInvoiceJE(inv, accounts));
  return await base44.asServiceRole.entities.SupplierInvoice.update(id, { status: 'APPROVED' });
}

// ─── مستخلصات مقاولي الباطن ──────────────────────────────────────────────────
async function createSubcontractorInvoice(base44, data) {
  assertValid('SUBCONTRACTOR_INVOICE', data);
  const payload = { ...data, status: 'DRAFT' };
  return await base44.asServiceRole.entities.SubcontractorInvoice.create(payload);
}

async function updateSubcontractorInvoice(base44, id, data) {
  assertValid('SUBCONTRACTOR_INVOICE', data);
  return await base44.asServiceRole.entities.SubcontractorInvoice.update(id, data);
}

// اعتماد مستخلص مقاول باطن: يرحّل قيد الالتزام (بالصافي + محتجز) ويحوّل الحالة إلى معتمد.
async function approveSubcontractorInvoice(base44, id) {
  const inv = await base44.asServiceRole.entities.SubcontractorInvoice.get(id);
  if (!inv) throw new Error('المستخلص غير موجود');
  if (inv.status !== 'DRAFT') throw new Error('لا يمكن اعتماد إلا المستخلصات التي في حالة مسودة');
  let subName = inv.subcontractorName;
  if (!subName && inv.subcontractorId) {
    try { subName = (await base44.asServiceRole.entities.Subcontractor.get(inv.subcontractorId))?.name; } catch { /* قد لا يوجد */ }
  }
  const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
  await autoPostJE(base44, buildSubcontractorInvoiceJE({ ...inv, subcontractorName: subName }, accounts));
  return await base44.asServiceRole.entities.SubcontractorInvoice.update(id, { status: 'APPROVED' });
}

// ─── فواتير التأجير ───────────────────────────────────────────────────────────
function buildRentalInvoicePayload(data) {
  const baseAmount = num(data.baseAmount);
  const extraCharges = num(data.extraCharges);
  const deliveryAmount = num(data.deliveryAmount);
  const deliveryVatable = data.deliveryVatable !== false;
  const net = +(baseAmount + extraCharges + deliveryAmount).toFixed(2);
  // الوعاء الخاضع للضريبة يستثني الشحن غير الخاضع.
  const vatableBase = baseAmount + extraCharges + (deliveryVatable ? deliveryAmount : 0);
  const vatAmount = +(vatableBase * VAT_RATE).toFixed(2);
  const totalAmount = +(net + vatAmount).toFixed(2);
  return { ...data, baseAmount, extraCharges, deliveryAmount, deliveryVatable, net, vatAmount, totalAmount, paidAmount: num(data.paidAmount) };
}

// الإنشاء يحفظ فاتورة التأجير كمسودة فقط بلا قيد — القيد يُرحّل عند الاعتماد.
async function createRentalInvoice(base44, data) {
  assertValid('RENTAL_INVOICE', data);
  const p = buildRentalInvoicePayload(data);
  const payload = { ...p, status: 'DRAFT' }; delete payload.net;
  return await base44.asServiceRole.entities.RentalInvoice.create(payload);
}

async function updateRentalInvoice(base44, id, data) {
  assertValid('RENTAL_INVOICE', data);
  const p = buildRentalInvoicePayload(data);
  const payload = { ...p }; delete payload.net;
  return await base44.asServiceRole.entities.RentalInvoice.update(id, payload);
}

// اعتماد فاتورة تأجير: يرحّل قيد الإيراد ويحوّل الحالة إلى معتمدة.
async function approveRentalInvoice(base44, id) {
  const inv = await base44.asServiceRole.entities.RentalInvoice.get(id);
  if (!inv) throw new Error('الفاتورة غير موجودة');
  if (inv.status !== 'DRAFT') throw new Error('لا يمكن اعتماد إلا الفواتير التي في حالة مسودة');
  // الوعاء الأساسي للإيراد = الأساسي + الرسوم الإضافية + الشحن (net).
  const net = +(num(inv.baseAmount) + num(inv.extraCharges) + num(inv.deliveryAmount)).toFixed(2);
  const accounts = await base44.asServiceRole.entities.ChartAccount.list('code', 1000);
  await autoPostJE(base44, buildRentalInvoiceJE({ ...inv, baseAmount: net }, accounts));
  return await base44.asServiceRole.entities.RentalInvoice.update(id, { status: 'APPROVED' });
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
  SALES_INVOICE:   { create: (b, p) => createSalesInvoice(b, p.data), update: (b, p) => updateSalesInvoice(b, p.id, p.data, p.prevStatus), approve: (b, p) => approveSalesInvoice(b, p.id) },
  PURCHASE_ORDER:  { create: (b, p) => createPurchaseOrder(b, p.data), update: (b, p) => updatePurchaseOrder(b, p.id, p.data, p.prevStatus) },
  EXPENSE:         { create: (b, p) => createExpense(b, p.data), update: (b, p) => updateExpense(b, p.id, p.data) },
  RENTAL_CONTRACT: { create: (b, p) => createRentalContract(b, p.data), update: (b, p) => updateRentalContract(b, p.id, p.data, p.prevStatus, p.prevEquipmentStatus) },
  PAYROLL:         { create: (b, p) => createPayrollRun(b, p.data), update: (b, p) => updatePayrollRun(b, p.id, p.data, p.prevStatus) },
  CLIENT_PAYMENT:  { create: (b, p) => createClientPayment(b, p.data), update: (b, p) => updateClientPayment(b, p.id, p.data) },
  SUPPLIER_PAYMENT:{ create: (b, p) => createSupplierPayment(b, p.data), update: (b, p) => updateSupplierPayment(b, p.id, p.data) },
  SUPPLIER_INVOICE:{ create: (b, p) => createSupplierInvoice(b, p.data), update: (b, p) => updateSupplierInvoice(b, p.id, p.data), approve: (b, p) => approveSupplierInvoice(b, p.id) },
  SUBCONTRACTOR_INVOICE: { create: (b, p) => createSubcontractorInvoice(b, p.data), update: (b, p) => updateSubcontractorInvoice(b, p.id, p.data), approve: (b, p) => approveSubcontractorInvoice(b, p.id) },
  RENTAL_INVOICE:  { create: (b, p) => createRentalInvoice(b, p.data), update: (b, p) => updateRentalInvoice(b, p.id, p.data), approve: (b, p) => approveRentalInvoice(b, p.id) },
  STOCK_MOVEMENT:  { create: (b, p) => createStockMovement(b, p.data) },
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