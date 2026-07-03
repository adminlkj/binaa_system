/**
 * Business Engine — المحرك المركزي لمنطق الأعمال
 * 
 * كل قاعدة مالية، حساب ضريبة، وقيد محاسبي تلقائي تمر من هنا.
 * الشاشات تجمع البيانات فقط → ترسل للـ Engine → تعرض النتيجة.
 */

import { base44 } from '@/api/base44Client';

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
  EXPENSE_PROJECT:       { code: '5400', name: 'مصروفات المشاريع', nameEn: 'Project Expenses' },
  EXPENSE_EQUIPMENT:     { code: '5500', name: 'مصروفات المعدات', nameEn: 'Equipment Expenses' },
  EXPENSE_EMPLOYEE:      { code: '5600', name: 'مصروفات الموظفين', nameEn: 'Employee Expenses' },
  EXPENSE_GOVERNMENT:    { code: '5700', name: 'رسوم ومصروفات حكومية', nameEn: 'Government Expenses' },
  EXPENSE_ADMIN:         { code: '5800', name: 'مصروفات إدارية', nameEn: 'Administrative Expenses' },
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

// ─── Pipeline كامل لكل عملية ──────────────────────────────────────────────────
//
// كل عملية مالية تُنفَّذ الآن داخل ترانسكشن ذرّي على الخادم عبر دالة الباكند
// `postOperation`: إنشاء السجل + ترحيل القيد في نداء واحد غير قابل للانقسام،
// مع تراجع كامل (rollback) عند أي فشل. هذه الطبقة رفيعة: تحضّر الحمولة
// (تحل أسماء الكيانات المرتبطة) ثم تستدعي الخادم، فتبقى الشاشات دون تغيير.

// ينفّذ العملية على الخادم ويعيد السجل الناتج، أو يرمي رسالة الخطأ العربية.
async function runOperation(payload) {
  const res = await base44.functions.invoke('postOperation', payload);
  const out = res?.data || {};
  if (out.success === false) {
    const err = new Error(out.error || 'فشل تنفيذ العملية');
    throw err;
  }
  return out.record;
}

// يحل اسم كيان من قائمة مرجعية حسب المعرّف
const nameOf = (list, id, current) => (list || []).find(x => x.id === id)?.name || current || '';

export const OperationEngine = {

  async createSalesInvoice(data, projects, clients) {
    const payload = { ...data, projectName: nameOf(projects, data.projectId, data.projectName), clientName: nameOf(clients, data.clientId, data.clientName) };
    return await runOperation({ operation: 'SALES_INVOICE', mode: 'create', data: payload });
  },

  async updateSalesInvoice(id, data, projects, clients, prevStatus) {
    const payload = { ...data, projectName: nameOf(projects, data.projectId, data.projectName), clientName: nameOf(clients, data.clientId, data.clientName) };
    return await runOperation({ operation: 'SALES_INVOICE', mode: 'update', id, data: payload, prevStatus });
  },

  async createPurchaseOrder(data, suppliers, projects, warehouses = []) {
    const payload = { ...data, supplierName: nameOf(suppliers, data.supplierId, data.supplierName), projectName: nameOf(projects, data.projectId, data.projectName), warehouseName: nameOf(warehouses, data.warehouseId, data.warehouseName) };
    return await runOperation({ operation: 'PURCHASE_ORDER', mode: 'create', data: payload });
  },

  async updatePurchaseOrder(id, data, suppliers, projects, prevStatus, warehouses = []) {
    const payload = { ...data, supplierName: nameOf(suppliers, data.supplierId, data.supplierName), projectName: nameOf(projects, data.projectId, data.projectName), warehouseName: nameOf(warehouses, data.warehouseId, data.warehouseName) };
    return await runOperation({ operation: 'PURCHASE_ORDER', mode: 'update', id, data: payload, prevStatus });
  },

  // يحل أسماء الكيانات المرتبطة بالمصروف حسب نوعه
  _buildExpensePayload(data, refs = {}) {
    const { projects = [], equipment = [], employees = [], subcontractors = [] } = refs;
    return {
      ...data,
      projectName:       nameOf(projects, data.projectId, data.projectName),
      equipmentName:     nameOf(equipment, data.equipmentId, data.equipmentName),
      employeeName:      nameOf(employees, data.employeeId, data.employeeName),
      subcontractorName: nameOf(subcontractors, data.subcontractorId, data.subcontractorName),
    };
  },

  async createExpense(data, refs = {}) {
    return await runOperation({ operation: 'EXPENSE', mode: 'create', data: this._buildExpensePayload(data, refs) });
  },

  async updateExpense(id, data, refs = {}) {
    return await runOperation({ operation: 'EXPENSE', mode: 'update', id, data: this._buildExpensePayload(data, refs) });
  },

  async createRentalContract(data, equipment, clients) {
    const payload = { ...data, equipmentName: nameOf(equipment, data.equipmentId, data.equipmentName), clientName: nameOf(clients, data.clientId, data.clientName) };
    return await runOperation({ operation: 'RENTAL_CONTRACT', mode: 'create', data: payload });
  },

  async updateRentalContract(id, data, equipment, clients, prevStatus) {
    const eq = (equipment || []).find(e => e.id === data.equipmentId);
    const payload = { ...data, equipmentName: eq?.name || data.equipmentName, clientName: nameOf(clients, data.clientId, data.clientName) };
    return await runOperation({ operation: 'RENTAL_CONTRACT', mode: 'update', id, data: payload, prevStatus, prevEquipmentStatus: eq?.status });
  },

  async createPayrollRun(data) {
    return await runOperation({ operation: 'PAYROLL', mode: 'create', data });
  },

  async updatePayrollRun(id, data, prevStatus) {
    return await runOperation({ operation: 'PAYROLL', mode: 'update', id, data, prevStatus });
  },

  async createClientPayment(data) {
    return await runOperation({ operation: 'CLIENT_PAYMENT', mode: 'create', data });
  },

  async updateClientPayment(id, data) {
    return await runOperation({ operation: 'CLIENT_PAYMENT', mode: 'update', id, data });
  },

  async createSupplierPayment(data) {
    return await runOperation({ operation: 'SUPPLIER_PAYMENT', mode: 'create', data });
  },

  async updateSupplierPayment(id, data) {
    return await runOperation({ operation: 'SUPPLIER_PAYMENT', mode: 'update', id, data });
  },

  async createSupplierInvoice(data) {
    return await runOperation({ operation: 'SUPPLIER_INVOICE', mode: 'create', data });
  },

  async updateSupplierInvoice(id, data) {
    return await runOperation({ operation: 'SUPPLIER_INVOICE', mode: 'update', id, data });
  },

  // اعتماد فاتورة مورد → ترحيل قيد الالتزام وتحويلها إلى معتمدة.
  async approveSupplierInvoice(id) {
    return await runOperation({ operation: 'SUPPLIER_INVOICE', mode: 'approve', id });
  },

  async createSubcontractorInvoice(data) {
    return await runOperation({ operation: 'SUBCONTRACTOR_INVOICE', mode: 'create', data });
  },

  async updateSubcontractorInvoice(id, data) {
    return await runOperation({ operation: 'SUBCONTRACTOR_INVOICE', mode: 'update', id, data });
  },

  // اعتماد مستخلص مقاول باطن → ترحيل قيد الالتزام وتحويله إلى معتمد.
  async approveSubcontractorInvoice(id) {
    return await runOperation({ operation: 'SUBCONTRACTOR_INVOICE', mode: 'approve', id });
  },

  async createRentalInvoice(data) {
    return await runOperation({ operation: 'RENTAL_INVOICE', mode: 'create', data });
  },

  async updateRentalInvoice(id, data) {
    return await runOperation({ operation: 'RENTAL_INVOICE', mode: 'update', id, data });
  },

  // اعتماد فاتورة تأجير → ترحيل قيد الإيراد وتحويلها إلى معتمدة.
  async approveRentalInvoice(id) {
    return await runOperation({ operation: 'RENTAL_INVOICE', mode: 'approve', id });
  },

  // استلام بضاعة (السلسلة: أمر شراء ← استلام جزئي ← مخزون) — يزيد المخزون ويرحّل القيود خلف الكواليس.
  async createGoodsReceipt(data) {
    return await runOperation({ operation: 'GOODS_RECEIPT', mode: 'create', data });
  },

  // حركة مخزنية (استلام / صرف / تحويل) — تُنشئ السجل وترحّل قيدها تلقائياً وتحدّث الأرصدة.
  async createStockMovement(data, refs = {}) {
    const { items = [], warehouses = [], projects = [], suppliers = [], employees = [] } = refs;
    const item = (items || []).find(i => i.id === data.itemId);
    const payload = {
      ...data,
      itemName: item?.name || data.itemName,
      itemCode: item?.code || data.itemCode,
      unit: item?.unit || data.unit,
      fromWarehouseName: nameOf(warehouses, data.fromWarehouseId, data.fromWarehouseName),
      toWarehouseName: nameOf(warehouses, data.toWarehouseId, data.toWarehouseName),
      projectName: nameOf(projects, data.projectId, data.projectName),
      supplierName: nameOf(suppliers, data.supplierId, data.supplierName),
      responsibleName: nameOf(employees, data.responsibleId, data.responsibleName),
    };
    return await runOperation({ operation: 'STOCK_MOVEMENT', mode: 'create', data: payload });
  },
};