import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, Truck, Users, Package, Wrench,
  Calculator, Settings, ChevronDown, Globe, X,
  FileText, CreditCard, ShoppingCart,
  UsersRound, Wallet, ReceiptText, HardHat,
  DollarSign, Warehouse, Fuel, CalendarDays, HandCoins,
  ClipboardList, BookOpen, BarChart3, Shield, ShieldCheck, CalendarRange, Network,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { canAccess } from '@/lib/permissions';

// Sidebar philosophy: Workspace-first, not table-first.
// Groups = "What does the user want to DO?" not "What entity do they manage?"

const READY_KEYS = new Set([
  'dashboard',
  'projects', 'project-workspace', 'contracts', 'sales', 'client-payments',
  'equipment', 'equipment-workspace', 'rental-contracts', 'equipment-maintenance', 'fuel',
  'purchase-orders', 'expenses', 'subcontractors',
  'employees', 'payroll-runs',
  'chart-accounts', 'accounting', 'vat', 'reports', 'fiscal-years',
  'clients', 'suppliers', 'users', 'settings',
]);

const navGroups = [
  // ── 1. المشاريع: Workspace حول المشروع ──────────────────────────
  {
    key: 'projects-cycle',
    label: { ar: 'المشاريع', en: 'Projects' },
    Icon: Building2,
    color: { text: 'text-emerald-600', border: 'border-emerald-500', light: 'bg-emerald-50', bg: 'bg-emerald-600' },
    items: [
      { key: 'projects',        ar: 'المشاريع',         en: 'Projects',         Icon: Building2,    desc: { ar: 'إدارة المشاريع', en: 'Manage projects' } },
      { key: 'contracts',       ar: 'عقود المشاريع',    en: 'Project Contracts', Icon: FileText,     desc: { ar: 'عقود العملاء', en: 'Client contracts' } },
      { key: 'sales',           ar: 'المستخلصات والفواتير', en: 'Invoices & Claims', Icon: ReceiptText, desc: { ar: 'فواتير العملاء', en: 'Client invoices' } },
      { key: 'client-payments', ar: 'التحصيلات',        en: 'Collections',      Icon: CreditCard,   desc: { ar: 'مدفوعات العملاء', en: 'Client payments' } },
      { key: 'boq',             ar: 'جدول الكميات',     en: 'BOQ',              Icon: ClipboardList, desc: { ar: 'بنود العقد', en: 'Contract items' } },
    ],
  },

  // ── 2. المعدات: Workspace حول المعدة ────────────────────────────
  {
    key: 'rental-cycle',
    label: { ar: 'المعدات والتأجير', en: 'Equipment & Rental' },
    Icon: Truck,
    color: { text: 'text-cyan-600', border: 'border-cyan-500', light: 'bg-cyan-50', bg: 'bg-cyan-600' },
    items: [
      { key: 'equipment',           ar: 'سجل المعدات',    en: 'Equipment Registry', Icon: Truck,     desc: { ar: 'كل المعدات ووضعها', en: 'All equipment & status' } },
      { key: 'rental-contracts',    ar: 'عقود التأجير',   en: 'Rental Contracts',   Icon: FileText,  desc: { ar: 'تأجير المعدات للعملاء', en: 'Equipment rental deals' } },
      { key: 'timesheets',          ar: 'ساعات التشغيل',  en: 'Timesheets',         Icon: CalendarDays, desc: { ar: 'تتبع ساعات العمل', en: 'Track operating hours' } },
      { key: 'equipment-maintenance', ar: 'الصيانة',      en: 'Maintenance',        Icon: Wrench,    desc: { ar: 'سجل الصيانة والإصلاح', en: 'Maintenance log' } },
      { key: 'fuel',                ar: 'استهلاك الوقود', en: 'Fuel Consumption',   Icon: Fuel,      desc: { ar: 'تتبع الوقود والتكاليف', en: 'Fuel tracking & costs' } },
    ],
  },

  // ── 3. المشتريات والتكاليف: Workflow الشراء كاملاً ──────────────
  {
    key: 'costs-cycle',
    label: { ar: 'المشتريات والتكاليف', en: 'Procurement & Costs' },
    Icon: ShoppingCart,
    color: { text: 'text-amber-600', border: 'border-amber-500', light: 'bg-amber-50', bg: 'bg-amber-600' },
    items: [
      { key: 'purchase-orders',   ar: 'أوامر الشراء',       en: 'Purchase Orders',    Icon: ClipboardList, desc: { ar: 'شراء المواد والخدمات', en: 'Buy materials & services' } },
      { key: 'expenses',          ar: 'المصروفات التشغيلية', en: 'Operating Expenses', Icon: DollarSign,    desc: { ar: 'وقود، إيجار، تشغيل', en: 'Fuel, rent, operations' } },
      { key: 'subcontractors',    ar: 'مقاولو الباطن',       en: 'Subcontractors',     Icon: HardHat,       desc: { ar: 'أعمال المقاولات الفرعية', en: 'Subcontract work' } },
      { key: 'supplier-invoices', ar: 'فواتير الموردين',     en: 'Supplier Invoices',  Icon: ReceiptText,   desc: { ar: 'فواتير مستلمة من الموردين', en: 'Received supplier invoices' } },
      { key: 'supplier-payments', ar: 'سداد الموردين',       en: 'Supplier Payments',  Icon: Wallet,        desc: { ar: 'دفع فواتير الموردين', en: 'Pay supplier invoices' } },
    ],
  },

  // ── 4. الموارد البشرية: Workspace حول الموظف ────────────────────
  {
    key: 'hr-cycle',
    label: { ar: 'الموارد البشرية', en: 'Human Resources' },
    Icon: Users,
    color: { text: 'text-violet-600', border: 'border-violet-500', light: 'bg-violet-50', bg: 'bg-violet-600' },
    items: [
      { key: 'employees',   ar: 'ملفات الموظفين', en: 'Employee Files', Icon: UsersRound,   desc: { ar: 'بيانات، عقود، مستندات', en: 'Data, contracts, docs' } },
      { key: 'payroll-runs', ar: 'مسيرات الرواتب', en: 'Payroll Runs',  Icon: Wallet,       desc: { ar: 'احتساب وصرف الرواتب', en: 'Calculate & process salaries' } },
      { key: 'attendance',  ar: 'الحضور والإجازات', en: 'Attendance',   Icon: CalendarDays, desc: { ar: 'سجل الحضور والغياب', en: 'Attendance & leave records' } },
      { key: 'advances',    ar: 'السلف والاستقطاعات', en: 'Advances',   Icon: HandCoins,    desc: { ar: 'سلف الموظفين', en: 'Employee advances' } },
    ],
  },

  // ── 5. المالية والمحاسبة: طبقة للمحاسبين فقط ───────────────────
  {
    key: 'accounting-cycle',
    label: { ar: 'المالية والمحاسبة', en: 'Finance & Accounting' },
    Icon: Calculator,
    color: { text: 'text-teal-600', border: 'border-teal-500', light: 'bg-teal-50', bg: 'bg-teal-600' },
    items: [
      { key: 'chart-accounts', ar: 'الدليل المحاسبي',   en: 'Chart of Accounts', Icon: Network,    desc: { ar: 'شجرة الحسابات وأدوارها', en: 'Accounts tree & roles' } },
      { key: 'accounting', ar: 'دفتر اليومية',          en: 'Journal Entries',   Icon: BookOpen,   desc: { ar: 'القيود المحاسبية اليدوية', en: 'Manual journal entries' } },
      { key: 'vat',        ar: 'ضريبة القيمة المضافة',  en: 'VAT',               Icon: Shield,     desc: { ar: 'تقرير الضريبة للهيئة', en: 'VAT report for authority' } },
      { key: 'reports',    ar: 'التقارير المالية',       en: 'Financial Reports', Icon: BarChart3,  desc: { ar: 'أرباح، تدفقات، ميزانية', en: 'P&L, cash flow, balance' } },
      { key: 'fiscal-years', ar: 'السنوات المالية',      en: 'Fiscal Years',      Icon: CalendarRange, desc: { ar: 'الفترات المالية والإقفال', en: 'Periods & closing' } },
    ],
  },

  // ── 6. الإعدادات والبيانات الأساسية ────────────────────────────
  {
    key: 'settings-cycle',
    label: { ar: 'الإعدادات والبيانات', en: 'Settings & Master Data' },
    Icon: Settings,
    color: { text: 'text-slate-600', border: 'border-slate-500', light: 'bg-slate-50', bg: 'bg-slate-600' },
    items: [
      { key: 'clients',   ar: 'العملاء',         en: 'Clients',        Icon: UsersRound, desc: { ar: 'بيانات العملاء الأساسية', en: 'Client master data' } },
      { key: 'suppliers', ar: 'الموردون',        en: 'Suppliers',      Icon: Package,    desc: { ar: 'بيانات الموردين الأساسية', en: 'Supplier master data' } },
      { key: 'inventory', ar: 'المخزون والأصول', en: 'Inventory',      Icon: Warehouse,  desc: { ar: 'مواد، أصول، مخزون', en: 'Materials & assets' } },
      { key: 'users',     ar: 'المستخدمون والصلاحيات', en: 'Users & Permissions', Icon: ShieldCheck, desc: { ar: 'الحسابات والأدوار', en: 'Accounts & roles' } },
      { key: 'settings',  ar: 'إعدادات النظام',  en: 'System Settings', Icon: Settings,  desc: { ar: 'الشركة والفروع', en: 'Company & branches' } },
    ],
  },
];

function findCycleForItem(itemKey) {
  for (const g of navGroups) {
    if (g.items.some(i => i.key === itemKey)) return g.key;
  }
  return null;
}

export default function Sidebar({ onClose, currentUser }) {
  const { lang, toggleLang, activeItem, setActiveItem } = useStore();
  const [openGroups, setOpenGroups] = useState(new Set());

  // Filter groups/items by the current user's permissions
  const visibleGroups = navGroups
    .map(g => ({ ...g, items: g.items.filter(i => canAccess(currentUser, i.key)) }))
    .filter(g => g.items.length > 0);

  const activeCycle = findCycleForItem(activeItem);
  const isExpanded = (gKey) => gKey === activeCycle || openGroups.has(gKey);

  const toggleGroup = (gKey) => {
    if (gKey === activeCycle) return;
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(gKey)) next.delete(gKey); else next.add(gKey);
      return next;
    });
  };

  const handleItem = (key) => {
    setActiveItem(key);
    onClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-white border-e border-border w-72 overflow-y-auto">

      {/* Brand Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow">ب</div>
        <div>
          <div className="font-bold text-lg text-foreground leading-tight">بِنَاء</div>
          <div className="text-xs text-muted-foreground">{lang === 'ar' ? 'نظام إدارة المقاولات' : 'Construction ERP'}</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ms-auto size-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* Dashboard */}
      <div className="px-3 pt-3">
        <button
          onClick={() => handleItem('dashboard')}
          className={`flex items-center w-full rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors gap-2.5
            ${activeItem === 'dashboard' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          <span className="flex-1 text-start">{lang === 'ar' ? 'مركز القيادة' : 'Command Center'}</span>
        </button>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {visibleGroups.map(group => {
          const expanded = isExpanded(group.key);
          const isActive = group.key === activeCycle;
          const color = group.color;

          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className={`flex items-center w-full rounded-lg px-3 py-2 text-sm font-semibold transition-all gap-2.5
                  ${isActive
                    ? `${color.light} ${color.text} border-s-2 ${color.border}`
                    : 'text-foreground hover:bg-muted'
                  }`}
              >
                <group.Icon className={`size-4 shrink-0 ${isActive ? color.text : 'text-muted-foreground'}`} />
                <span className="flex-1 text-start">{lang === 'ar' ? group.label.ar : group.label.en}</span>
                <ChevronDown className={`size-3.5 transition-transform duration-200 ${expanded ? 'rotate-180' : ''} ${isActive ? color.text : 'text-muted-foreground'}`} />
              </button>

              {expanded && (
                <div className="ms-5 mt-0.5 mb-1 space-y-0.5 border-s-2 border-muted ps-3">
                  {group.items.map(item => {
                    const isReady = READY_KEYS.has(item.key);
                    const isItemActive = activeItem === item.key;
                    return (
                      <button
                        key={item.key}
                        onClick={() => isReady && handleItem(item.key)}
                        className={`flex items-center w-full rounded-md px-2.5 py-2 text-xs transition-colors gap-2.5 text-start
                          ${isItemActive
                            ? `${color.bg} text-white shadow-sm font-semibold`
                            : isReady
                              ? 'text-foreground hover:bg-muted font-medium'
                              : 'text-muted-foreground/60 cursor-default font-medium'
                          }`}
                      >
                        <item.Icon className={`size-3.5 shrink-0 ${isItemActive ? 'text-white' : isReady ? '' : 'text-muted-foreground/40'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{lang === 'ar' ? item.ar : item.en}</div>
                          {item.desc && !isItemActive && (
                            <div className="text-[10px] text-muted-foreground/70 truncate leading-tight mt-0.5">
                              {lang === 'ar' ? item.desc.ar : item.desc.en}
                            </div>
                          )}
                        </div>
                        {!isReady && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 font-semibold shrink-0">
                            {lang === 'ar' ? 'قريباً' : 'Soon'}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-border">
        <button
          onClick={toggleLang}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <Globe className="size-4" />
          {lang === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
    </div>
  );
}