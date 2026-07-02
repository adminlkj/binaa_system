/**
 * الشجرة المحاسبية القياسية لنشاط المقاولات (Standard Contracting Chart of Accounts)
 *
 * تُبنى على 5 حسابات أب رئيسية (أصول، خصوم، حقوق ملكية، إيرادات، مصروفات)،
 * ثم حسابات تجميعية تحتها (غير قابلة للترحيل)، ثم حسابات تفصيلية قابلة للترحيل.
 *
 * الحسابات التفصيلية التي يحتاجها المحرك تحمل semanticRole ليربطها بالقيود
 * التلقائية. يستطيع المستخدم لاحقاً إضافة حسابات فرعية أخرى تحت أي حساب رئيسي.
 *
 * البنية الكودية (Numbering):
 *   1xxx أصول · 2xxx خصوم · 3xxx حقوق ملكية · 4xxx إيرادات · 5xxx مصروفات
 */

// group=true → حساب تجميعي (أب) غير قابل للترحيل
export const STANDARD_CHART = [
  // ═══════════════════ 1 — الأصول (ASSETS) ═══════════════════
  { code: '1000', name: 'الأصول', nameEn: 'Assets', accountType: 'ASSET', nature: 'DEBIT', group: true },

  { code: '1100', name: 'الأصول المتداولة', nameEn: 'Current Assets', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1000', group: true },
  { code: '1110', name: 'النقدية وما في حكمها', nameEn: 'Cash & Cash Equivalents', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1100', group: true },
  { code: '1111', name: 'الصندوق', nameEn: 'Cash on Hand', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1110', semanticRole: 'CASH', cashLike: true },
  { code: '1112', name: 'البنك', nameEn: 'Bank', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1110', semanticRole: 'BANK', cashLike: true },
  { code: '1113', name: 'العهد النقدية', nameEn: 'Cash Custody', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1110', semanticRole: 'CUSTODY', cashLike: true },

  { code: '1120', name: 'الذمم المدينة', nameEn: 'Receivables', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1100', group: true },
  { code: '1121', name: 'ذمم العملاء', nameEn: 'Accounts Receivable', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1120', semanticRole: 'RECEIVABLES' },
  { code: '1122', name: 'دفعات مقدمة للموردين', nameEn: 'Advances to Suppliers', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1120' },
  { code: '1123', name: 'سلف العاملين', nameEn: 'Employee Advances', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1120', semanticRole: 'EMPLOYEE_ADVANCES' },
  { code: '1124', name: 'محتجزات لدى العملاء', nameEn: 'Retention Receivable', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1120', semanticRole: 'RETENTION_RECEIVABLE' },

  { code: '1130', name: 'المخزون', nameEn: 'Inventory', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1100', group: true },
  { code: '1131', name: 'مخزون مواد البناء', nameEn: 'Construction Materials', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1130', semanticRole: 'INVENTORY_MATERIALS' },
  { code: '1132', name: 'مخزون قطع الغيار', nameEn: 'Spare Parts', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1130' },
  { code: '1133', name: 'أعمال تحت التنفيذ', nameEn: 'Work in Progress (WIP)', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1130', semanticRole: 'WIP' },

  { code: '1140', name: 'ضريبة القيمة المضافة المدفوعة', nameEn: 'VAT Receivable (Input)', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1100', semanticRole: 'VAT_RECEIVABLE' },

  { code: '1200', name: 'الأصول الثابتة', nameEn: 'Fixed Assets', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1000', group: true },
  { code: '1210', name: 'المعدات والآلات الثقيلة', nameEn: 'Heavy Equipment & Machinery', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1200', semanticRole: 'FIXED_EQUIPMENT' },
  { code: '1220', name: 'السيارات والمركبات', nameEn: 'Vehicles', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1200' },
  { code: '1230', name: 'الأثاث والأجهزة المكتبية', nameEn: 'Furniture & Office Equipment', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1200' },
  { code: '1240', name: 'المباني والعقارات', nameEn: 'Buildings & Property', accountType: 'ASSET', nature: 'DEBIT', parentCode: '1200' },
  { code: '1290', name: 'مجمع الإهلاك', nameEn: 'Accumulated Depreciation', accountType: 'ASSET', nature: 'CREDIT', parentCode: '1200', semanticRole: 'ACCUM_DEPRECIATION' },

  // ═══════════════════ 2 — الخصوم (LIABILITIES) ═══════════════════
  { code: '2000', name: 'الخصوم', nameEn: 'Liabilities', accountType: 'LIABILITY', nature: 'CREDIT', group: true },

  { code: '2100', name: 'الخصوم المتداولة', nameEn: 'Current Liabilities', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2000', group: true },
  { code: '2110', name: 'ذمم الموردين', nameEn: 'Accounts Payable', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2100', semanticRole: 'PAYABLES' },
  { code: '2120', name: 'مستحقات مقاولي الباطن', nameEn: 'Subcontractors Payable', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2100', semanticRole: 'SUBCONTRACTOR_PAYABLE' },
  { code: '2130', name: 'محتجزات لصالح مقاولي الباطن', nameEn: 'Retention Payable', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2100', semanticRole: 'RETENTION_PAYABLE' },
  { code: '2140', name: 'رواتب مستحقة الدفع', nameEn: 'Accrued Salaries', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2100', semanticRole: 'ACCRUED_SALARIES' },
  { code: '2150', name: 'دفعات مقدمة من العملاء', nameEn: 'Advances from Customers', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2100', semanticRole: 'CUSTOMER_ADVANCES' },
  { code: '2160', name: 'ضريبة القيمة المضافة المحصلة', nameEn: 'VAT Payable (Output)', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2100', semanticRole: 'VAT_PAYABLE' },
  { code: '2170', name: 'مصروفات مستحقة', nameEn: 'Accrued Expenses', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2100' },

  { code: '2200', name: 'الخصوم طويلة الأجل', nameEn: 'Long-term Liabilities', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2000', group: true },
  { code: '2210', name: 'قروض بنكية طويلة الأجل', nameEn: 'Long-term Loans', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2200' },
  { code: '2220', name: 'مخصص نهاية الخدمة', nameEn: 'End of Service Provision', accountType: 'LIABILITY', nature: 'CREDIT', parentCode: '2200', semanticRole: 'EOS_PROVISION' },

  // ═══════════════════ 3 — حقوق الملكية (EQUITY) ═══════════════════
  { code: '3000', name: 'حقوق الملكية', nameEn: 'Equity', accountType: 'EQUITY', nature: 'CREDIT', group: true },
  { code: '3100', name: 'رأس المال', nameEn: 'Capital', accountType: 'EQUITY', nature: 'CREDIT', parentCode: '3000', semanticRole: 'CAPITAL' },
  { code: '3200', name: 'جاري الشركاء', nameEn: 'Partners Current Account', accountType: 'EQUITY', nature: 'CREDIT', parentCode: '3000' },
  { code: '3300', name: 'الأرباح المبقاة', nameEn: 'Retained Earnings', accountType: 'EQUITY', nature: 'CREDIT', parentCode: '3000', semanticRole: 'RETAINED_EARNINGS' },
  { code: '3900', name: 'رصيد افتتاحي — حقوق ملكية', nameEn: 'Opening Balance Equity', accountType: 'EQUITY', nature: 'CREDIT', parentCode: '3000', semanticRole: 'OPENING_BALANCE_EQUITY' },

  // ═══════════════════ 4 — الإيرادات (REVENUE) ═══════════════════
  { code: '4000', name: 'الإيرادات', nameEn: 'Revenue', accountType: 'REVENUE', nature: 'CREDIT', group: true },
  { code: '4100', name: 'إيرادات أعمال المقاولات', nameEn: 'Construction Revenue', accountType: 'REVENUE', nature: 'CREDIT', parentCode: '4000', semanticRole: 'REVENUE_CONSTRUCTION' },
  { code: '4200', name: 'إيرادات تأجير المعدات', nameEn: 'Equipment Rental Revenue', accountType: 'REVENUE', nature: 'CREDIT', parentCode: '4000', semanticRole: 'REVENUE_RENTAL' },
  { code: '4300', name: 'إيرادات الخدمات', nameEn: 'Service Revenue', accountType: 'REVENUE', nature: 'CREDIT', parentCode: '4000', semanticRole: 'REVENUE_SERVICE' },
  { code: '4900', name: 'إيرادات أخرى', nameEn: 'Other Revenue', accountType: 'REVENUE', nature: 'CREDIT', parentCode: '4000' },

  // ═══════════════════ 5 — المصروفات (EXPENSES) ═══════════════════
  { code: '5000', name: 'المصروفات', nameEn: 'Expenses', accountType: 'EXPENSE', nature: 'DEBIT', group: true },

  // 5100 — تكاليف المشاريع المباشرة (COGS)
  { code: '5100', name: 'تكاليف المشاريع المباشرة', nameEn: 'Direct Project Costs', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5000', group: true },
  { code: '5110', name: 'مواد ومشتريات المشاريع', nameEn: 'Project Materials & Purchases', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5100', semanticRole: 'EXPENSE_PURCHASE' },
  { code: '5120', name: 'مصروفات المشاريع', nameEn: 'Project Expenses', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5100', semanticRole: 'EXPENSE_PROJECT' },
  { code: '5130', name: 'أجور عمالة مباشرة', nameEn: 'Direct Labor', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5100', semanticRole: 'EXPENSE_DIRECT_LABOR' },
  { code: '5140', name: 'تكاليف مقاولي الباطن', nameEn: 'Subcontractor Costs', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5100', semanticRole: 'EXPENSE_SUBCONTRACTOR' },
  { code: '5150', name: 'مصروفات المعدات', nameEn: 'Equipment Expenses', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5100', semanticRole: 'EXPENSE_EQUIPMENT' },

  // 5200 — مصروفات تشغيلية وإدارية
  { code: '5200', name: 'المصروفات التشغيلية والإدارية', nameEn: 'Operating & Admin Expenses', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5000', group: true },
  { code: '5210', name: 'الرواتب والأجور الإدارية', nameEn: 'Salaries & Wages', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5200', semanticRole: 'EXPENSE_SALARIES' },
  { code: '5220', name: 'مصروفات الموظفين', nameEn: 'Employee Expenses', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5200', semanticRole: 'EXPENSE_EMPLOYEE' },
  { code: '5230', name: 'مصروفات إدارية', nameEn: 'Administrative Expenses', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5200', semanticRole: 'EXPENSE_ADMIN' },
  { code: '5240', name: 'رسوم ومصروفات حكومية', nameEn: 'Government Fees', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5200', semanticRole: 'EXPENSE_GOVERNMENT' },
  { code: '5250', name: 'المصروفات العمومية', nameEn: 'General Expenses', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5200', semanticRole: 'EXPENSE_GENERAL' },
  { code: '5260', name: 'مصروف الإهلاك', nameEn: 'Depreciation Expense', accountType: 'EXPENSE', nature: 'DEBIT', parentCode: '5200', semanticRole: 'EXPENSE_DEPRECIATION' },
];

// يحوّل الشجرة القياسية إلى سجلات جاهزة للإنشاء في الدليل المحاسبي.
export function buildStandardAccounts() {
  return STANDARD_CHART.map(a => {
    const depth = a.parentCode
      ? STANDARD_CHART.filter(x => x.code === a.parentCode)[0]
        ? levelOf(a.code)
        : 1
      : 1;
    const { group, cashLike, ...rest } = a;
    return {
      ...rest,
      parentCode: a.parentCode || '',
      semanticRole: a.semanticRole || '',
      isPostable: !group,
      isActive: true,
      level: depth,
    };
  });
}

// يحسب مستوى الحساب بتتبّع سلسلة الآباء.
function levelOf(code) {
  let level = 1;
  let cur = STANDARD_CHART.find(a => a.code === code);
  while (cur && cur.parentCode) {
    level += 1;
    cur = STANDARD_CHART.find(a => a.code === cur.parentCode);
  }
  return level;
}