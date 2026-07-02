// Utility helpers for Binaa System

export function t(ar, en, lang) {
  return lang === 'ar' ? ar : en;
}

export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return '0';
  return Number(num).toLocaleString('ar-SA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatCurrency(num, lang = 'ar') {
  const n = formatNumber(num);
  return lang === 'ar' ? `${n} ر.س` : `SAR ${n}`;
}

export function formatDate(dateStr, lang = 'ar') {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (lang === 'ar') {
      return d.toLocaleDateString('ar-SA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    return d.toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return dateStr;
  }
}

export function genCode(prefix, num) {
  return `${prefix}-${String(num).padStart(4, '0')}`;
}

// Status configs
export const PROJECT_STATUS = {
  PLANNING: { ar: 'تخطيط', en: 'Planning', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
  ACTIVE: { ar: 'نشط', en: 'Active', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  ON_HOLD: { ar: 'معلق', en: 'On Hold', color: 'bg-orange-100 text-orange-700 border border-orange-200' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed', color: 'bg-teal-100 text-teal-700 border border-teal-200' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled', color: 'bg-rose-100 text-rose-700 border border-rose-200' },
};

export const EQUIPMENT_STATUS = {
  AVAILABLE: { ar: 'متاحة', en: 'Available', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  IN_USE: { ar: 'قيد الاستخدام', en: 'In Use', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
  RENTED: { ar: 'مؤجرة', en: 'Rented', color: 'bg-purple-100 text-purple-700 border border-purple-200' },
  MAINTENANCE: { ar: 'صيانة', en: 'Maintenance', color: 'bg-rose-100 text-rose-700 border border-rose-200' },
  OUT_OF_SERVICE: { ar: 'خارج الخدمة', en: 'Out of Service', color: 'bg-gray-100 text-gray-700 border border-gray-200' },
};

export const INVOICE_STATUS = {
  DRAFT: { ar: 'مسودة', en: 'Draft', color: 'bg-gray-100 text-gray-700 border border-gray-200' },
  SENT: { ar: 'مرسلة', en: 'Sent', color: 'bg-blue-100 text-blue-700 border border-blue-200' },
  PARTIALLY_PAID: { ar: 'مدفوعة جزئياً', en: 'Partially Paid', color: 'bg-amber-100 text-amber-700 border border-amber-200' },
  PAID: { ar: 'مدفوعة', en: 'Paid', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  OVERDUE: { ar: 'متأخرة', en: 'Overdue', color: 'bg-rose-100 text-rose-700 border border-rose-200' },
  CANCELLED: { ar: 'ملغاة', en: 'Cancelled', color: 'bg-gray-100 text-gray-500 border border-gray-200' },
};

export const CONTRACT_STATUS = {
  DRAFT: { ar: 'مسودة', en: 'Draft', color: 'bg-gray-100 text-gray-700 border border-gray-200' },
  ACTIVE: { ar: 'نشط', en: 'Active', color: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  COMPLETED: { ar: 'مكتمل', en: 'Completed', color: 'bg-teal-100 text-teal-700 border border-teal-200' },
  CANCELLED: { ar: 'ملغي', en: 'Cancelled', color: 'bg-rose-100 text-rose-700 border border-rose-200' },
};

export const EXPENSE_CATEGORIES = [
  { key: 'RENT', ar: 'إيجار', en: 'Rent' },
  { key: 'MAINTENANCE', ar: 'صيانة', en: 'Maintenance' },
  { key: 'TRANSPORT', ar: 'نقل', en: 'Transport' },
  { key: 'DELIVERY', ar: 'توصيل', en: 'Delivery' },
  { key: 'CONSUMABLES', ar: 'مستهلكات', en: 'Consumables' },
  { key: 'SERVICES', ar: 'خدمات', en: 'Services' },
  { key: 'INSURANCE', ar: 'تأمين', en: 'Insurance' },
  { key: 'FUEL', ar: 'وقود', en: 'Fuel' },
  { key: 'PERMITS', ar: 'تراخيص', en: 'Permits' },
  { key: 'OFFICE', ar: 'مكتبية', en: 'Office' },
  { key: 'HOSPITALITY', ar: 'ضيافة', en: 'Hospitality' },
  { key: 'SALARIES', ar: 'رواتب', en: 'Salaries' },
  { key: 'ELECTRICITY', ar: 'كهرباء', en: 'Electricity' },
  { key: 'WATER', ar: 'مياه', en: 'Water' },
  { key: 'OTHER', ar: 'أخرى', en: 'Other' },
];