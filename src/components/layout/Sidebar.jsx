import React, { useState } from 'react';
import {
  LayoutDashboard, Building2, Truck, Users, Package, Wrench,
  Calculator, Settings, ChevronDown, Globe, X,
  FileText, ClipboardList, TrendingUp, Clock, CreditCard,
  FuelIcon, UsersRound, CalendarDays, Banknote,
  PackageCheck, FilePlus, ReceiptText, Cog, Network,
  Receipt, ArrowRightLeft, ListChecks, HardHat,
  DollarSign, Warehouse, Link2, Wallet, Circle,
  TrendingDown, CalendarRange, HandCoins, Coins, FileSignature,
  ShieldCheck, Fuel,
} from 'lucide-react';
import { useStore } from '@/lib/store';

const navGroups = [
  {
    key: 'projects-cycle',
    label: { ar: 'دورة المشاريع', en: 'Projects Cycle' },
    Icon: Building2,
    color: { text: 'text-emerald-600', border: 'border-emerald-500', light: 'bg-emerald-50', bg: 'bg-emerald-600' },
    items: [
      { key: 'projects', ar: 'المشاريع', en: 'Projects', Icon: Building2 },
      { key: 'contracts', ar: 'العقود', en: 'Contracts', Icon: FileText },
      { key: 'boq', ar: 'جدول الكميات BOQ', en: 'Bill of Quantities', Icon: ListChecks },
      { key: 'sales', ar: 'فواتير العملاء', en: 'Client Invoices', Icon: Receipt },
      { key: 'client-payments', ar: 'التحصيلات', en: 'Collections', Icon: CreditCard },
    ],
  },
  {
    key: 'rental-cycle',
    label: { ar: 'دورة تأجير المعدات', en: 'Equipment Rental Cycle' },
    Icon: Truck,
    color: { text: 'text-cyan-600', border: 'border-cyan-500', light: 'bg-cyan-50', bg: 'bg-cyan-600' },
    items: [
      { key: 'equipment', ar: 'المعدات', en: 'Equipment', Icon: Truck },
      { key: 'rental-contracts', ar: 'عقود التأجير', en: 'Rental Contracts', Icon: FileText },
      { key: 'delivery-orders', ar: 'أوامر التوصيل', en: 'Delivery Orders', Icon: ArrowRightLeft },
      { key: 'timesheets', ar: 'ساعات التشغيل', en: 'Timesheets', Icon: Clock },
      { key: 'rental-invoices', ar: 'فواتير التأجير', en: 'Rental Invoices', Icon: Receipt },
      { key: 'rental-payments', ar: 'تحصيلات التأجير', en: 'Rental Collections', Icon: CreditCard },
      { key: 'equipment-maintenance', ar: 'الصيانة', en: 'Maintenance', Icon: Wrench },
      { key: 'fuel', ar: 'الوقود', en: 'Fuel', Icon: Fuel },
    ],
  },
  {
    key: 'costs-cycle',
    label: { ar: 'دورة التكاليف', en: 'Costs & Expenses Cycle' },
    Icon: Wallet,
    color: { text: 'text-amber-600', border: 'border-amber-500', light: 'bg-amber-50', bg: 'bg-amber-600' },
    items: [
      { key: 'purchase-requests', ar: 'طلبات الشراء', en: 'Purchase Requests', Icon: FilePlus },
      { key: 'purchase-orders', ar: 'أوامر الشراء', en: 'Purchase Orders', Icon: ClipboardList },
      { key: 'supplier-invoices', ar: 'فواتير الموردين', en: 'Supplier Invoices', Icon: ReceiptText },
      { key: 'supplier-payments', ar: 'سداد الموردين', en: 'Supplier Payments', Icon: CreditCard },
      { key: 'expenses', ar: 'المصروفات العامة', en: 'General Expenses', Icon: DollarSign },
      { key: 'petty-cash', ar: 'الصندوق النقدي', en: 'Petty Cash', Icon: Wallet },
    ],
  },
  {
    key: 'subcontractors-cycle',
    label: { ar: 'دورة مقاولي الباطن', en: 'Subcontractors Cycle' },
    Icon: HardHat,
    color: { text: 'text-orange-600', border: 'border-orange-500', light: 'bg-orange-50', bg: 'bg-orange-600' },
    items: [
      { key: 'subcontractors', ar: 'مقاولو الباطن', en: 'Subcontractors', Icon: HardHat },
    ],
  },
  {
    key: 'hr-cycle',
    label: { ar: 'دورة الموارد البشرية', en: 'HR Cycle' },
    Icon: Users,
    color: { text: 'text-violet-600', border: 'border-violet-500', light: 'bg-violet-50', bg: 'bg-violet-600' },
    items: [
      { key: 'employees', ar: 'الموظفون', en: 'Employees', Icon: Users },
      { key: 'attendance', ar: 'الحضور والانصراف', en: 'Attendance', Icon: CalendarDays },
      { key: 'payroll-runs', ar: 'مسيرات الرواتب', en: 'Payroll Runs', Icon: Wallet },
      { key: 'advances', ar: 'السلف', en: 'Advances', Icon: HandCoins },
    ],
  },
  {
    key: 'accounting-cycle',
    label: { ar: 'دورة المحاسبة', en: 'Accounting Cycle' },
    Icon: Calculator,
    color: { text: 'text-teal-600', border: 'border-teal-500', light: 'bg-teal-50', bg: 'bg-teal-600' },
    items: [
      { key: 'accounting', ar: 'دفتر اليومية', en: 'Journal Entries', Icon: Calculator },
      { key: 'vat', ar: 'ضريبة القيمة المضافة', en: 'VAT', Icon: ReceiptText },
      { key: 'reports', ar: 'التقارير المالية', en: 'Financial Reports', Icon: TrendingUp },
    ],
  },
  {
    key: 'settings-cycle',
    label: { ar: 'الإعدادات', en: 'Settings' },
    Icon: Settings,
    color: { text: 'text-slate-600', border: 'border-slate-500', light: 'bg-slate-50', bg: 'bg-slate-600' },
    items: [
      { key: 'clients', ar: 'العملاء', en: 'Clients', Icon: Users },
      { key: 'suppliers', ar: 'الموردون', en: 'Suppliers', Icon: Package },
      { key: 'inventory', ar: 'المخزون', en: 'Inventory', Icon: Warehouse },
      { key: 'settings', ar: 'إعدادات النظام', en: 'System Settings', Icon: Settings },
    ],
  },
];

function findCycleForItem(itemKey) {
  for (const g of navGroups) {
    if (g.items.some(i => i.key === itemKey)) return g.key;
  }
  return null;
}

export default function Sidebar({ onClose }) {
  const { lang, toggleLang, activeItem, setActiveItem } = useStore();
  const [openGroups, setOpenGroups] = useState(new Set());

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

  const isRTL = lang === 'ar';

  return (
    <div className="flex flex-col h-full bg-white border-e border-border w-72 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg shadow">ب</div>
        <div>
          <div className="font-bold text-lg text-foreground leading-tight">بِنَاء</div>
          <div className="text-xs text-muted-foreground">نظام إدارة المقاولات</div>
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
          className={`flex items-center w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors gap-2.5 ${activeItem === 'dashboard' ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted'}`}
        >
          <LayoutDashboard className="size-4 shrink-0" />
          {lang === 'ar' ? 'لوحة التحكم' : 'Dashboard'}
        </button>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 px-3 py-2 space-y-1">
        {navGroups.map(group => {
          const expanded = isExpanded(group.key);
          const isActive = group.key === activeCycle;
          const color = group.color;

          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className={`flex items-center w-full rounded-lg px-3 py-2 text-sm font-medium transition-all gap-2 ${isActive ? `${color.light} ${color.text} border-s-2 ${color.border}` : 'text-foreground hover:bg-muted'}`}
              >
                <group.Icon className={`size-4 shrink-0 ${isActive ? color.text : ''}`} />
                <span className="flex-1 text-start">{lang === 'ar' ? group.label.ar : group.label.en}</span>
                <ChevronDown className={`size-3.5 transition-transform ${expanded ? 'rotate-180' : ''} ${isActive ? color.text : 'text-muted-foreground'}`} />
              </button>

              {expanded && (
                <div className="ms-4 mt-0.5 space-y-0.5 border-s-2 border-muted ps-3">
                  {group.items.map(item => (
                    <button
                      key={item.key}
                      onClick={() => handleItem(item.key)}
                      className={`flex items-center w-full rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors gap-2 ${activeItem === item.key ? `${color.bg} text-white shadow-sm` : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                    >
                      <item.Icon className="size-3.5 shrink-0" />
                      <span>{lang === 'ar' ? item.ar : item.en}</span>
                    </button>
                  ))}
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