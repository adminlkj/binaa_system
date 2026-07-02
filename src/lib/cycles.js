// Cycle definitions: each workspace cycle is a single unified screen with top tabs.
// The sidebar shows only the cycle names; clicking one opens its screen and its
// sub-sections appear as horizontal tabs inside that screen.
import {
  Building2, Truck, ShoppingCart, Users, Calculator, Settings,
  FileText, CreditCard, ReceiptText, ClipboardList,
  Wrench, Fuel, CalendarDays, DollarSign, HardHat, Wallet, HandCoins,
  UsersRound, Package, Warehouse, ShieldCheck, Network, BookOpen, Shield, BarChart3, CalendarRange, Scale,
  GitPullRequestArrow, AlertTriangle, TrendingUp, PieChart, Landmark, Waves, ShieldQuestion,
} from 'lucide-react';

// Keys that have a real screen wired in App.jsx. Others render a ComingSoon placeholder.
export const READY_TABS = new Set([
  'projects', 'contracts', 'sales', 'client-payments', 'boq',
  'equipment', 'rental-contracts', 'timesheets', 'equipment-maintenance', 'fuel',
  'purchase-orders', 'expenses', 'subcontractors', 'supplier-invoices', 'supplier-payments',
  'employees', 'payroll-runs', 'attendance', 'advances',
  'chart-accounts', 'accounting', 'trial-balance', 'vat', 'reports', 'fiscal-years', 'audit',
  'clients', 'suppliers', 'inventory', 'users', 'settings',
  // Reports cycle
  'report-income', 'report-trial', 'report-vat', 'report-cashflow', 'report-projects',
  // Subcontractors cycle
  'sub-registry', 'sub-contracts', 'sub-invoices', 'sub-payments', 'sub-penalties',
]);

export const CYCLES = [
  {
    key: 'projects-cycle',
    label: { ar: 'المشاريع', en: 'Projects' },
    Icon: Building2,
    color: { text: 'text-emerald-600', border: 'border-emerald-500', light: 'bg-emerald-50', bg: 'bg-emerald-600' },
    tabs: [
      { key: 'projects',        ar: 'المشاريع',            en: 'Projects',          Icon: Building2 },
      { key: 'contracts',       ar: 'عقود المشاريع',       en: 'Project Contracts', Icon: FileText },
      { key: 'sales',           ar: 'المستخلصات والفواتير', en: 'Invoices & Claims', Icon: ReceiptText },
      { key: 'client-payments', ar: 'التحصيلات',           en: 'Collections',       Icon: CreditCard },
      { key: 'boq',             ar: 'جدول الكميات',        en: 'BOQ',               Icon: ClipboardList },
    ],
  },
  {
    key: 'rental-cycle',
    label: { ar: 'المعدات والتأجير', en: 'Equipment & Rental' },
    Icon: Truck,
    color: { text: 'text-cyan-600', border: 'border-cyan-500', light: 'bg-cyan-50', bg: 'bg-cyan-600' },
    tabs: [
      { key: 'equipment',             ar: 'سجل المعدات',   en: 'Equipment Registry', Icon: Truck },
      { key: 'rental-contracts',      ar: 'عقود التأجير',  en: 'Rental Contracts',   Icon: FileText },
      { key: 'timesheets',            ar: 'ساعات التشغيل', en: 'Timesheets',         Icon: CalendarDays },
      { key: 'equipment-maintenance', ar: 'الصيانة',      en: 'Maintenance',        Icon: Wrench },
      { key: 'fuel',                  ar: 'استهلاك الوقود', en: 'Fuel Consumption',  Icon: Fuel },
    ],
  },
  {
    key: 'costs-cycle',
    label: { ar: 'المشتريات والتكاليف', en: 'Procurement & Costs' },
    Icon: ShoppingCart,
    color: { text: 'text-amber-600', border: 'border-amber-500', light: 'bg-amber-50', bg: 'bg-amber-600' },
    tabs: [
      { key: 'purchase-orders',   ar: 'أوامر الشراء',       en: 'Purchase Orders',    Icon: ClipboardList },
      { key: 'expenses',          ar: 'المصروفات التشغيلية', en: 'Operating Expenses', Icon: DollarSign },
      { key: 'subcontractors',    ar: 'مقاولو الباطن',       en: 'Subcontractors',     Icon: HardHat },
      { key: 'supplier-invoices', ar: 'فواتير الموردين',     en: 'Supplier Invoices',  Icon: ReceiptText },
      { key: 'supplier-payments', ar: 'سداد الموردين',       en: 'Supplier Payments',  Icon: Wallet },
    ],
  },
  {
    key: 'hr-cycle',
    label: { ar: 'الموارد البشرية', en: 'Human Resources' },
    Icon: Users,
    color: { text: 'text-violet-600', border: 'border-violet-500', light: 'bg-violet-50', bg: 'bg-violet-600' },
    tabs: [
      { key: 'employees',    ar: 'ملفات الموظفين',    en: 'Employee Files', Icon: UsersRound },
      { key: 'payroll-runs', ar: 'مسيرات الرواتب',    en: 'Payroll Runs',   Icon: Wallet },
      { key: 'attendance',   ar: 'الحضور والإجازات',  en: 'Attendance',     Icon: CalendarDays },
      { key: 'advances',     ar: 'السلف والاستقطاعات', en: 'Advances',      Icon: HandCoins },
    ],
  },
  {
    key: 'accounting-cycle',
    label: { ar: 'المالية والمحاسبة', en: 'Finance & Accounting' },
    Icon: Calculator,
    color: { text: 'text-teal-600', border: 'border-teal-500', light: 'bg-teal-50', bg: 'bg-teal-600' },
    tabs: [
      { key: 'chart-accounts', ar: 'الدليل المحاسبي',   en: 'Chart of Accounts', Icon: Network },
      { key: 'accounting',     ar: 'دفتر اليومية',      en: 'Journal Entries',   Icon: BookOpen },
      { key: 'trial-balance',  ar: 'ميزان المراجعة',    en: 'Trial Balance',     Icon: Scale },
      { key: 'vat',            ar: 'ضريبة القيمة المضافة', en: 'VAT',            Icon: Shield },
      { key: 'reports',        ar: 'التقارير المالية',   en: 'Financial Reports', Icon: BarChart3 },
      { key: 'fiscal-years',   ar: 'السنوات المالية',    en: 'Fiscal Years',      Icon: CalendarRange },
      { key: 'audit',          ar: 'التحقق المحاسبي',    en: 'Accounting Audit',  Icon: ShieldQuestion },
    ],
  },
  {
    key: 'subcontractors-cycle',
    label: { ar: 'مقاولو الباطن', en: 'Subcontractors' },
    Icon: HardHat,
    color: { text: 'text-orange-600', border: 'border-orange-500', light: 'bg-orange-50', bg: 'bg-orange-600' },
    tabs: [
      { key: 'sub-registry',  ar: 'سجل المقاولين',       en: 'Registry',       Icon: HardHat },
      { key: 'sub-contracts', ar: 'عقود الباطن',         en: 'Contracts',      Icon: FileText },
      { key: 'sub-invoices',  ar: 'المستخلصات والفواتير', en: 'Invoices',       Icon: ReceiptText },
      { key: 'sub-payments',  ar: 'السداد',              en: 'Payments',       Icon: Wallet },
      { key: 'sub-penalties', ar: 'الغرامات',            en: 'Penalties',      Icon: AlertTriangle },
    ],
  },
  {
    key: 'reports-cycle',
    label: { ar: 'التقارير', en: 'Reports' },
    Icon: BarChart3,
    color: { text: 'text-indigo-600', border: 'border-indigo-500', light: 'bg-indigo-50', bg: 'bg-indigo-600' },
    tabs: [
      { key: 'report-income',   ar: 'قائمة الدخل',            en: 'Income Statement', Icon: TrendingUp },
      { key: 'report-trial',    ar: 'ميزان المراجعة',         en: 'Trial Balance',    Icon: Scale },
      { key: 'report-vat',      ar: 'ضريبة القيمة المضافة',   en: 'VAT Report',       Icon: Shield },
      { key: 'report-cashflow', ar: 'التدفق النقدي',          en: 'Cash Flow',        Icon: Waves },
      { key: 'report-projects', ar: 'تقارير المشاريع',        en: 'Project Reports',  Icon: PieChart },
    ],
  },
  {
    key: 'settings-cycle',
    label: { ar: 'الإعدادات والبيانات', en: 'Settings & Master Data' },
    Icon: Settings,
    color: { text: 'text-slate-600', border: 'border-slate-500', light: 'bg-slate-50', bg: 'bg-slate-600' },
    tabs: [
      { key: 'clients',   ar: 'العملاء',              en: 'Clients',             Icon: UsersRound },
      { key: 'suppliers', ar: 'الموردون',             en: 'Suppliers',           Icon: Package },
      { key: 'inventory', ar: 'المخزون والأصول',      en: 'Inventory',           Icon: Warehouse },
      { key: 'users',     ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions', Icon: ShieldCheck },
      { key: 'settings',  ar: 'إعدادات النظام',       en: 'System Settings',     Icon: Settings },
    ],
  },
];

export const CYCLE_BY_KEY = Object.fromEntries(CYCLES.map(c => [c.key, c]));

// Map any tab key back to the cycle that contains it.
export function cycleForTab(tabKey) {
  for (const c of CYCLES) {
    if (c.tabs.some(t => t.key === tabKey)) return c;
  }
  return null;
}