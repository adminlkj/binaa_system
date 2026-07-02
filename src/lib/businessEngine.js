/**
 * Business Engine — المحرك المركزي لمنطق الأعمال
 * 
 * كل قاعدة مالية، حساب ضريبة، وقيد محاسبي تلقائي تمر من هنا.
 * الشاشات تجمع البيانات فقط → ترسل للـ Engine → تعرض النتيجة.
 */

import { base44 } from '@/api/base44Client';
import { buildJEFromTemplate } from '@/lib/postingEngine';

/**
 * يبني القيد من قالب الترحيل الدلالي إن وُجد (المحاسب يتحكم بالحسابات)،
 * وإلا يتراجع لباني القيد الثابت (fallbackBuilder) لضمان عدم انكسار النظام.
 */
async function buildJE(operationType, meta, amounts, fallbackBuilder) {
  const fromTemplate = await buildJEFromTemplate(operationType, {
    entryNo: meta.entryNo, date: meta.date, description: meta.description,
    sourceType: meta.sourceType, amounts,
  });
  return fromTemplate || fallbackBuilder();
}

// ─── ثوابت الأعمال ────────────────────────────────────────────────────────────
export const VAT_RATE = 0.15;

// خريطة الحسابات المحاسبية حسب الدور (Role-based, not name-based)
export const ACCOUNTS = {
  // الأصول
  CASH:                  { code: '1010', name: 'الصندوق', nameEn: 'Cash' },
  BANK:                  { code: '1020', name: 'البنك', nameEn: 'Bank' },
  RECEIVABLES:           { code: '1100', name: 'الذمم المدينة - عملاء', nameEn: 'Accounts Receivable' },
  // الخصوم
  PAYABLES:              { code: '2100', name: 'الذمم الدائنة - موردون', nameEn: 'Accounts Payable' },
  VAT_PAYABLE:           { code: '2300', name: 'ضريبة القيمة المضافة المحصلة', nameEn: 'VAT Payable' },
  VAT_RECEIVABLE:        { code: '1300', name: 'ضريبة القيمة المضافة المدفوعة', nameEn: 'VAT Receivable' },
  ACCRUED_SALARIES:      { code: '2200', name: 'رواتب مستحقة الدفع', nameEn: 'Accrued Salaries' },
  // الإيرادات
  REVENUE_CONSTRUCTION:  { code: '4100', name: 'إيرادات أعمال المقاولات', nameEn: 'Construction Revenue' },
  REVENUE_RENTAL:        { code: '4200', name: 'إيرادات التأجير', nameEn: 'Rental Revenue' },
  REVENUE_SERVICE:       { code: '4300', name: 'إيرادات الخدمات', nameEn: 'Service Revenue' },
  // المصروفات
  EXPENSE_GENERAL:       { code: '5100', name: 'المصروفات العمومية', nameEn: 'General Expenses' },
  EXPENSE_SALARIES:      { code: '5200', name: 'مصروف الرواتب والأجور', nameEn: 'Salaries Expense' },
  EXPENSE_PURCHASE:      { code: '5300', name: 'مشتريات ومواد', nameEn: 'Purchases & Materials' },
};

// ─── حسابات الضريبة (Single Source of Truth) ─────────────────────────────────
export function calcVAT(amount, rate = VAT_RATE) {
  const base = parseFloat(amount) || 0;
  const vat  = +(base * rate).toFixed(2);
  const total = +(base + vat).toFixed(2);
  return { base, vat, total, rate };
}

export function calcVATFromTotal(totalIncVAT, rate = VAT_RATE) {
  const total = parseFloat(totalIncVAT) || 0;
  const base  = +(total / (1 + rate)).toFixed(2);
  const vat   = +(total - base).toFixed(2);
  return { base, vat, total, rate };
}

// ─── توليد أرقام تسلسلية ──────────────────────────────────────────────────────
export async function nextSerial(entity, field, prefix) {
  try {
    const items = await entity.list('-created_date', 1);
    if (!items.length) return `${prefix}-0001`;
    const last = items[0][field] || '';
    const match = last.match(/(\d+)$/);
    const num = match ? parseInt(match[1]) + 1 : 1;
    return `${prefix}-${String(num).padStart(4, '0')}`;
  } catch {
    return `${prefix}-${Date.now().toString().slice(-4)}`;
  }
}

// ─── بناء قيود محاسبية تلقائية حسب نوع العملية ───────────────────────────────

/**
 * قيد فاتورة مبيعات (السند المدين)
 * ح/ الذمم المدينة  مدين بالإجمالي
 *   ح/ الإيراد     دائن بالأساس
 *   ح/ ضريبة محصلة دائن بالضريبة
 */
export function buildSalesInvoiceJE({ invoiceNo, date, clientName, subtotal, vatAmount, totalAmount, invoiceType }) {
  const revenueAccount =
    invoiceType === 'RENTAL'  ? ACCOUNTS.REVENUE_RENTAL :
    invoiceType === 'SERVICE' ? ACCOUNTS.REVENUE_SERVICE :
    ACCOUNTS.REVENUE_CONSTRUCTION;

  return {
    entryNo:     `JE-SINV-${invoiceNo}`,
    date,
    description: `فاتورة مبيعات ${invoiceNo} — ${clientName}`,
    sourceType:  'SalesInvoice',
    isPosted:    true,
    totalDebit:  totalAmount,
    totalCredit: totalAmount,
    lines: [
      { accountCode: ACCOUNTS.RECEIVABLES.code, accountName: ACCOUNTS.RECEIVABLES.name, debit: totalAmount, credit: 0, description: `فاتورة ${invoiceNo}` },
      { accountCode: revenueAccount.code,        accountName: revenueAccount.name,       debit: 0, credit: subtotal,   description: 'الإيراد الأساسي' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_PAYABLE.code, accountName: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

/**
 * قيد تحصيل مبيعات (تسديد العميل)
 * ح/ البنك          مدين
 *   ح/ الذمم المدينة دائن
 */
export function buildCollectionJE({ invoiceNo, date, clientName, amount }) {
  return {
    entryNo:     `JE-COL-${invoiceNo}`,
    date,
    description: `تحصيل فاتورة ${invoiceNo} — ${clientName}`,
    sourceType:  'Collection',
    isPosted:    true,
    totalDebit:  amount,
    totalCredit: amount,
    lines: [
      { accountCode: ACCOUNTS.BANK.code,        accountName: ACCOUNTS.BANK.name,        debit: amount, credit: 0,      description: 'تحصيل نقدي' },
      { accountCode: ACCOUNTS.RECEIVABLES.code, accountName: ACCOUNTS.RECEIVABLES.name, debit: 0,      credit: amount, description: `سداد فاتورة ${invoiceNo}` },
    ],
  };
}

/**
 * قيد أمر شراء / مستلم
 * ح/ المشتريات     مدين بالأساس
 * ح/ ضريبة مدفوعة مدين بالضريبة
 *   ح/ الذمم الدائنة دائن بالإجمالي
 */
export function buildPurchaseOrderJE({ orderNo, date, supplierName, baseAmount, vatAmount, grandTotal }) {
  return {
    entryNo:     `JE-PO-${orderNo}`,
    date,
    description: `أمر شراء ${orderNo} — ${supplierName}`,
    sourceType:  'PurchaseOrder',
    isPosted:    true,
    totalDebit:  grandTotal,
    totalCredit: grandTotal,
    lines: [
      { accountCode: ACCOUNTS.EXPENSE_PURCHASE.code, accountName: ACCOUNTS.EXPENSE_PURCHASE.name, debit: baseAmount, credit: 0,          description: 'مواد وبضاعة' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_RECEIVABLE.code, accountName: ACCOUNTS.VAT_RECEIVABLE.name, debit: vatAmount, credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: ACCOUNTS.PAYABLES.code,          accountName: ACCOUNTS.PAYABLES.name,          debit: 0,          credit: grandTotal, description: `مستحقات ${supplierName}` },
    ],
  };
}

/**
 * قيد مصروف عام
 * ح/ المصروفات     مدين بالأساس
 * ح/ ضريبة مدفوعة مدين بالضريبة (اختياري)
 *   ح/ البنك        دائن بالإجمالي
 */
export function buildExpenseJE({ date, description, amount, vatAmount, totalAmount, reference }) {
  return {
    entryNo:     `JE-EXP-${reference || Date.now()}`,
    date,
    description: `مصروف: ${description}`,
    sourceType:  'Expense',
    isPosted:    true,
    totalDebit:  totalAmount,
    totalCredit: totalAmount,
    lines: [
      { accountCode: ACCOUNTS.EXPENSE_GENERAL.code, accountName: ACCOUNTS.EXPENSE_GENERAL.name, debit: amount,    credit: 0,           description },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_RECEIVABLE.code, accountName: ACCOUNTS.VAT_RECEIVABLE.name, debit: vatAmount, credit: 0, description: 'ضريبة مدفوعة' }] : []),
      { accountCode: ACCOUNTS.BANK.code,             accountName: ACCOUNTS.BANK.name,             debit: 0,         credit: totalAmount, description: 'سداد المصروف' },
    ],
  };
}

/**
 * قيد مسير رواتب
 * ح/ مصروف الرواتب   مدين
 *   ح/ رواتب مستحقة  دائن
 */
export function buildPayrollJE({ code, month, year, netAmount }) {
  const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const monthName = monthNames[(month || 1) - 1];
  const date = `${year}-${String(month).padStart(2,'0')}-01`;
  return {
    entryNo:     `JE-PAY-${code}`,
    date,
    description: `مسير رواتب ${monthName} ${year}`,
    sourceType:  'PayrollRun',
    isPosted:    true,
    totalDebit:  netAmount,
    totalCredit: netAmount,
    lines: [
      { accountCode: ACCOUNTS.EXPENSE_SALARIES.code,  accountName: ACCOUNTS.EXPENSE_SALARIES.name,  debit: netAmount, credit: 0,         description: `رواتب ${monthName}` },
      { accountCode: ACCOUNTS.ACCRUED_SALARIES.code,  accountName: ACCOUNTS.ACCRUED_SALARIES.name,  debit: 0,         credit: netAmount, description: 'مستحقات مدفوعة' },
    ],
  };
}

/**
 * قيد عقد تأجير (إيراد)
 * ح/ الذمم المدينة مدين
 *   ح/ إيراد التأجير دائن بالأساس
 *   ح/ ضريبة محصلة  دائن بالضريبة
 */
export function buildRentalJE({ contractNo, date, clientName, base, vatAmount, totalAmount }) {
  return {
    entryNo:     `JE-RC-${contractNo}`,
    date: date || new Date().toISOString().slice(0, 10),
    description: `عقد تأجير ${contractNo} — ${clientName}`,
    sourceType:  'RentalContract',
    isPosted:    true,
    totalDebit:  totalAmount,
    totalCredit: totalAmount,
    lines: [
      { accountCode: ACCOUNTS.RECEIVABLES.code,     accountName: ACCOUNTS.RECEIVABLES.name,     debit: totalAmount, credit: 0,          description: `عقد ${contractNo}` },
      { accountCode: ACCOUNTS.REVENUE_RENTAL.code,  accountName: ACCOUNTS.REVENUE_RENTAL.name,  debit: 0,           credit: base,       description: 'إيراد التأجير' },
      ...(vatAmount > 0 ? [{ accountCode: ACCOUNTS.VAT_PAYABLE.code, accountName: ACCOUNTS.VAT_PAYABLE.name, debit: 0, credit: vatAmount, description: 'ضريبة القيمة المضافة 15%' }] : []),
    ],
  };
}

// ─── دالة Auto-Post: تنشئ قيد محاسبي تلقائياً إذا لم يكن موجوداً ─────────────
export async function autoPostJE(jeData) {
  try {
    // تحقق إذا القيد موجود مسبقاً بنفس رقمه
    const existing = await base44.entities.JournalEntry.filter({ entryNo: jeData.entryNo });
    if (existing && existing.length > 0) return existing[0]; // تجنب التكرار
    return await base44.entities.JournalEntry.create(jeData);
  } catch (err) {
    console.error('AutoPost JE failed:', err);
    return null;
  }
}

// ─── Pipeline كامل لكل عملية ──────────────────────────────────────────────────

export const OperationEngine = {

  async createSalesInvoice(data, projects, clients) {
    const proj = projects.find(p => p.id === data.projectId);
    const cl   = clients.find(c => c.id === data.clientId);
    const { base: subtotal, vat: vatAmount, total: totalAmount } = calcVAT(data.subtotal, parseFloat(data.vatRate) || VAT_RATE);
    const payload = {
      ...data,
      subtotal,
      vatRate:    parseFloat(data.vatRate) || VAT_RATE,
      vatAmount,
      totalAmount,
      paidAmount: parseFloat(data.paidAmount) || 0,
      projectName: proj?.name || data.projectName,
      clientName:  cl?.name  || data.clientName,
    };
    const invoice = await base44.entities.SalesInvoice.create(payload);
    // Auto-post JE (semantic template first, fallback to fixed builder)
    const je = await buildJE(
      'SALES_INVOICE',
      { entryNo: `JE-SINV-${payload.invoiceNo}`, date: payload.date, description: `فاتورة مبيعات ${payload.invoiceNo} — ${payload.clientName}`, sourceType: 'SalesInvoice' },
      { base: subtotal, vat: vatAmount, total: totalAmount },
      () => buildSalesInvoiceJE({ ...payload, invoiceNo: payload.invoiceNo }),
    );
    await autoPostJE(je);
    return invoice;
  },

  async updateSalesInvoice(id, data, projects, clients) {
    const proj = projects.find(p => p.id === data.projectId);
    const cl   = clients.find(c => c.id === data.clientId);
    const { base: subtotal, vat: vatAmount, total: totalAmount } = calcVAT(data.subtotal, parseFloat(data.vatRate) || VAT_RATE);
    const payload = {
      ...data,
      subtotal,
      vatRate:    parseFloat(data.vatRate) || VAT_RATE,
      vatAmount,
      totalAmount,
      paidAmount: parseFloat(data.paidAmount) || 0,
      projectName: proj?.name || data.projectName,
      clientName:  cl?.name  || data.clientName,
    };
    return await base44.entities.SalesInvoice.update(id, payload);
  },

  async createPurchaseOrder(data, suppliers, projects) {
    const s = suppliers.find(s => s.id === data.supplierId);
    const p = projects.find(p => p.id === data.projectId);
    const { base: baseAmount, vat: vatAmount, total: grandTotal } = calcVAT(data.totalAmount);
    const payload = {
      ...data,
      totalAmount:  baseAmount,
      vatAmount,
      supplierName: s?.name || data.supplierName,
      projectName:  p?.name || data.projectName,
    };
    const po = await base44.entities.PurchaseOrder.create(payload);
    // Auto-post JE only if RECEIVED
    if (payload.status === 'RECEIVED') {
      const je = await buildJE(
        'PURCHASE_ORDER',
        { entryNo: `JE-PO-${payload.orderNo}`, date: payload.date, description: `أمر شراء ${payload.orderNo} — ${payload.supplierName}`, sourceType: 'PurchaseOrder' },
        { base: baseAmount, vat: vatAmount, total: grandTotal },
        () => buildPurchaseOrderJE({ orderNo: payload.orderNo, date: payload.date, supplierName: payload.supplierName, baseAmount, vatAmount, grandTotal }),
      );
      await autoPostJE(je);
    }
    return po;
  },

  async updatePurchaseOrder(id, data, suppliers, projects) {
    const s = suppliers.find(s => s.id === data.supplierId);
    const p = projects.find(p => p.id === data.projectId);
    const { base: baseAmount, vat: vatAmount, total: grandTotal } = calcVAT(data.totalAmount);
    const payload = {
      ...data,
      totalAmount:  baseAmount,
      vatAmount,
      supplierName: s?.name || data.supplierName,
      projectName:  p?.name || data.projectName,
    };
    const po = await base44.entities.PurchaseOrder.update(id, payload);
    if (payload.status === 'RECEIVED') {
      const je = await buildJE(
        'PURCHASE_ORDER',
        { entryNo: `JE-PO-${payload.orderNo}`, date: payload.date, description: `أمر شراء ${payload.orderNo} — ${payload.supplierName}`, sourceType: 'PurchaseOrder' },
        { base: baseAmount, vat: vatAmount, total: grandTotal },
        () => buildPurchaseOrderJE({ orderNo: payload.orderNo, date: payload.date, supplierName: payload.supplierName, baseAmount, vatAmount, grandTotal }),
      );
      await autoPostJE(je);
    }
    return po;
  },

  async createExpense(data, projects) {
    const p = projects.find(p => p.id === data.projectId);
    const amt = parseFloat(data.amount) || 0;
    const vatEnabled = data._vatEnabled;
    const vatAmount = vatEnabled ? +(amt * VAT_RATE).toFixed(2) : 0;
    const totalAmount = +(amt + vatAmount).toFixed(2);
    const payload = {
      ...data,
      amount: amt,
      vatAmount,
      totalAmount,
      projectName: p?.name || data.projectName,
    };
    delete payload._vatEnabled;
    const expense = await base44.entities.Expense.create(payload);
    const ref = `EXP-${Date.now()}`;
    const je = await buildJE(
      'EXPENSE',
      { entryNo: `JE-EXP-${ref}`, date: payload.date, description: `مصروف: ${payload.description}`, sourceType: 'Expense' },
      { base: amt, vat: vatAmount, total: totalAmount },
      () => buildExpenseJE({ date: payload.date, description: payload.description, amount: amt, vatAmount, totalAmount, reference: ref }),
    );
    await autoPostJE(je);
    return expense;
  },

  async updateExpense(id, data, projects) {
    const p = projects.find(p => p.id === data.projectId);
    const amt = parseFloat(data.amount) || 0;
    const vatEnabled = data._vatEnabled;
    const vatAmount = vatEnabled ? +(amt * VAT_RATE).toFixed(2) : 0;
    const totalAmount = +(amt + vatAmount).toFixed(2);
    const payload = { ...data, amount: amt, vatAmount, totalAmount, projectName: p?.name || data.projectName };
    delete payload._vatEnabled;
    return await base44.entities.Expense.update(id, payload);
  },

  async createRentalContract(data, equipment, clients) {
    const eq = equipment.find(e => e.id === data.equipmentId);
    const cl = clients.find(c => c.id === data.clientId);
    const rate = parseFloat(data.rate) || 0;
    const delivery = parseFloat(data.deliveryFees) || 0;
    const base = rate + delivery;
    const { vat: vatAmount, total: totalAmount } = calcVAT(base);
    const payload = {
      ...data,
      rate,
      deliveryFees: delivery,
      totalAmount,
      vatAmount,
      equipmentName: eq?.name || data.equipmentName,
      clientName:    cl?.name || data.clientName,
    };
    const contract = await base44.entities.RentalContract.create(payload);
    // Side effect: update equipment status
    if (eq && payload.status === 'ACTIVE') {
      await base44.entities.Equipment.update(eq.id, { status: 'RENTED' });
    }
    // Auto-post JE
    const je = await buildJE(
      'RENTAL_CONTRACT',
      { entryNo: `JE-RC-${payload.contractNo}`, date: payload.startDate || new Date().toISOString().slice(0, 10), description: `عقد تأجير ${payload.contractNo} — ${payload.clientName}`, sourceType: 'RentalContract' },
      { base, vat: vatAmount, total: totalAmount },
      () => buildRentalJE({ contractNo: payload.contractNo, date: payload.startDate, clientName: payload.clientName, base, vatAmount, totalAmount }),
    );
    await autoPostJE(je);
    return contract;
  },

  async updateRentalContract(id, data, equipment, clients) {
    const eq = equipment.find(e => e.id === data.equipmentId);
    const cl = clients.find(c => c.id === data.clientId);
    const rate = parseFloat(data.rate) || 0;
    const delivery = parseFloat(data.deliveryFees) || 0;
    const base = rate + delivery;
    const { vat: vatAmount, total: totalAmount } = calcVAT(base);
    const payload = {
      ...data,
      rate,
      deliveryFees: delivery,
      totalAmount,
      vatAmount,
      equipmentName: eq?.name || data.equipmentName,
      clientName:    cl?.name || data.clientName,
    };
    await base44.entities.RentalContract.update(id, payload);
    // Side effect: sync equipment status
    if (eq) {
      const newStatus =
        payload.status === 'ACTIVE'                                    ? 'RENTED' :
        payload.status === 'COMPLETED' || payload.status === 'CANCELLED' ? 'AVAILABLE' :
        eq.status;
      if (newStatus !== eq.status) await base44.entities.Equipment.update(eq.id, { status: newStatus });
    }
  },

  async createPayrollRun(data) {
    const payroll = await base44.entities.PayrollRun.create(data);
    if (data.status === 'PAID') {
      const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      const payDate = `${data.year}-${String(data.month).padStart(2,'0')}-01`;
      const je = await buildJE(
        'PAYROLL',
        { entryNo: `JE-PAY-${data.code}`, date: payDate, description: `مسير رواتب ${monthNames[(data.month || 1) - 1]} ${data.year}`, sourceType: 'PayrollRun' },
        { net: data.netAmount, base: data.netAmount, total: data.netAmount },
        () => buildPayrollJE({ code: data.code, month: data.month, year: data.year, netAmount: data.netAmount }),
      );
      await autoPostJE(je);
    }
    return payroll;
  },

  async updatePayrollRun(id, data) {
    const payroll = await base44.entities.PayrollRun.update(id, data);
    if (data.status === 'PAID') {
      const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      const payDate = `${data.year}-${String(data.month).padStart(2,'0')}-01`;
      const je = await buildJE(
        'PAYROLL',
        { entryNo: `JE-PAY-${data.code}`, date: payDate, description: `مسير رواتب ${monthNames[(data.month || 1) - 1]} ${data.year}`, sourceType: 'PayrollRun' },
        { net: data.netAmount, base: data.netAmount, total: data.netAmount },
        () => buildPayrollJE({ code: data.code, month: data.month, year: data.year, netAmount: data.netAmount }),
      );
      await autoPostJE(je);
    }
    return payroll;
  },
};