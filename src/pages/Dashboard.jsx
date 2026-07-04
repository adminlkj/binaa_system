import React, { useState, useEffect } from 'react';
import {
  Building2, Truck, Users, AlertTriangle, Clock,
  TrendingUp, TrendingDown, CreditCard,
  FileText, Bell, Package, RefreshCw, ChevronRight, Wallet, Plus,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, PROJECT_STATUS } from '@/lib/utils-binaa';

// ─── KPI Card ────────────────────────────────────────────────────────────────
// eslint-disable-next-line react/prop-types
function KPICard({ title, value, subtitle, icon: Icon, tint, onClick }) {
  return (
    <Card
      className={`group relative overflow-hidden border-border/60 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className={`absolute -end-6 -top-6 size-20 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20 ${tint.glow}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold truncate">{title}</p>
            <p className="text-xl font-bold mt-1.5 text-foreground tabular-nums">{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${tint.bg}`}>
            <Icon className={`size-[18px] ${tint.icon}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Alert Item ──────────────────────────────────────────────────────────────
function AlertItem({ icon: Icon, iconColor, label, value, action, onAction, severity }) {
  const bg = severity === 'high' ? 'bg-rose-50 border-rose-200' : severity === 'warn' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';
  const textColor = severity === 'high' ? 'text-rose-700' : severity === 'warn' ? 'text-amber-700' : 'text-blue-700';
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${bg}`}>
      <Icon className={`size-4 shrink-0 ${iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${textColor}`}>{label}</p>
        {value && <p className="text-xs text-muted-foreground">{value}</p>}
      </div>
      {action && (
        <button onClick={onAction} className={`text-[11px] font-medium shrink-0 px-2 py-1 rounded hover:opacity-80 ${textColor} bg-white border border-current`}>
          {action}
        </button>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { lang, setActiveItem, setProjectContext, setClientContext } = useStore();
  const [data, setData] = useState({ projects: [], equipment: [], employees: [], invoices: [], expenses: [], purchaseOrders: [], rentalContracts: [] });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const safe = (result) => result.status === 'fulfilled' && Array.isArray(result.value) ? result.value : [];
    const results = await Promise.allSettled([
      base44.entities.Project.list('-created_date', 100),
      base44.entities.Equipment.list('-created_date', 100),
      base44.entities.Employee.filter({ isActive: true }),
      base44.entities.SalesInvoice.list('-created_date', 100),
      base44.entities.Expense.list('-created_date', 50),
      base44.entities.PurchaseOrder.list('-created_date', 50),
      base44.entities.RentalContract.list('-created_date', 50),
    ]);

    setData({
      projects: safe(results[0]),
      equipment: safe(results[1]),
      employees: safe(results[2]),
      invoices: safe(results[3]),
      expenses: safe(results[4]),
      purchaseOrders: safe(results[5]),
      rentalContracts: safe(results[6]),
    });
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const { projects, equipment, employees, invoices, expenses, purchaseOrders, rentalContracts } = data;

  // ─── Derived KPIs ────────────────────────────────────────────────────────
  const activeProjects    = projects.filter(p => p.status === 'ACTIVE');
  const totalContractVal  = projects.reduce((s, p) => s + (p.contractValue || 0), 0);
  const collectedRevenue  = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + (i.totalAmount || 0), 0);
  const pendingRevenue    = invoices.filter(i => ['SENT','PARTIALLY_PAID','OVERDUE'].includes(i.status)).reduce((s, i) => s + ((i.totalAmount || 0) - (i.paidAmount || 0)), 0);
  const totalExpenses     = expenses.reduce((s, e) => s + (e.totalAmount || 0), 0);
  const netProfit         = collectedRevenue - totalExpenses;
  const margin            = collectedRevenue > 0 ? Math.round((netProfit / collectedRevenue) * 100) : 0;
  const availableEquip    = equipment.filter(e => e.status === 'AVAILABLE').length;
  const rentedEquip       = equipment.filter(e => e.status === 'RENTED').length;
  const maintenanceEquip  = equipment.filter(e => e.status === 'MAINTENANCE').length;

  // ─── Alerts ──────────────────────────────────────────────────────────────
  const overdueInvoices   = invoices.filter(i => i.status === 'OVERDUE');
  const pendingPOs        = purchaseOrders.filter(p => p.status === 'DRAFT' || p.status === 'APPROVED');
  const activeRentals     = rentalContracts.filter(r => r.status === 'ACTIVE');
  const today             = new Date().toISOString().slice(0, 10);
  const expiredRentals    = rentalContracts.filter(r => r.status === 'ACTIVE' && r.endDate && r.endDate < today);

  const alerts = [
    ...overdueInvoices.length ? [{
      severity: 'high', icon: AlertTriangle, iconColor: 'text-rose-500',
      label: t(`${overdueInvoices.length} فاتورة متأخرة`, `${overdueInvoices.length} overdue invoices`, lang),
      value: t('يجب التحصيل فوراً', 'Collection required immediately', lang),
      action: t('عرض', 'View', lang), onAction: () => setActiveItem('sales'),
    }] : [],
    ...expiredRentals.length ? [{
      severity: 'warn', icon: Clock, iconColor: 'text-amber-500',
      label: t(`${expiredRentals.length} عقد تأجير منتهي`, `${expiredRentals.length} rental contract(s) expired`, lang),
      value: t('يحتاج تجديد أو إغلاق', 'Needs renewal or closing', lang),
      action: t('عرض', 'View', lang), onAction: () => setActiveItem('rental-contracts'),
    }] : [],
    ...maintenanceEquip ? [{
      severity: 'warn', icon: Package, iconColor: 'text-amber-500',
      label: t(`${maintenanceEquip} معدة في الصيانة`, `${maintenanceEquip} equipment in maintenance`, lang),
      value: '', action: t('عرض', 'View', lang), onAction: () => setActiveItem('equipment'),
    }] : [],
    ...pendingPOs.length ? [{
      severity: 'info', icon: FileText, iconColor: 'text-blue-500',
      label: t(`${pendingPOs.length} أمر شراء معلق`, `${pendingPOs.length} pending purchase order(s)`, lang),
      value: t('بانتظار الموافقة أو الاستلام', 'Awaiting approval or receipt', lang),
      action: t('عرض', 'View', lang), onAction: () => setActiveItem('purchase-orders'),
    }] : [],
  ];

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return t('صباح الخير', 'Good morning', lang);
    if (h < 18) return t('مساء الخير', 'Good afternoon', lang);
    return t('مساء الخير', 'Good evening', lang);
  })();
  const todayLabel = new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-5">
        <div className="h-32 bg-muted animate-pulse rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">

      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 text-white shadow-xl">
        <div className="absolute -end-16 -top-16 size-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="absolute -start-10 -bottom-20 size-56 rounded-full bg-teal-400/10 blur-3xl" />
        <div className="relative p-5 md:p-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-emerald-300/90 font-medium">{greeting} · {todayLabel}</p>
              <h1 className="text-2xl md:text-3xl font-bold mt-1">{t('مركز القيادة', 'Command Center', lang)}</h1>
              <p className="text-sm text-slate-300 mt-1">{t('نظرة عامة فورية على أداء الشركة', 'Real-time company performance overview', lang)}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={load} className="text-white hover:bg-white/10 hover:text-white shrink-0">
              <RefreshCw className="size-4" />
            </Button>
          </div>

          {/* Live financial strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3">
              <p className="text-[11px] text-slate-300">{t('الإيرادات المحصلة', 'Collected Revenue', lang)}</p>
              <p className="text-lg font-bold mt-0.5 tabular-nums">{formatCurrency(collectedRevenue, lang)}</p>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3">
              <p className="text-[11px] text-slate-300">{t('المصروفات', 'Expenses', lang)}</p>
              <p className="text-lg font-bold mt-0.5 tabular-nums text-rose-300">{formatCurrency(totalExpenses, lang)}</p>
            </div>
            <div className="rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 p-3">
              <p className="text-[11px] text-slate-300">{t('الذمم المدينة', 'Receivables', lang)}</p>
              <p className="text-lg font-bold mt-0.5 tabular-nums text-amber-300">{formatCurrency(pendingRevenue, lang)}</p>
            </div>
            <div className="rounded-xl bg-emerald-500/15 backdrop-blur-sm border border-emerald-400/30 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-emerald-200">{t('صافي الربح', 'Net Profit', lang)}</p>
                {netProfit >= 0 ? <TrendingUp className="size-3.5 text-emerald-300" /> : <TrendingDown className="size-3.5 text-rose-300" />}
              </div>
              <p className={`text-lg font-bold mt-0.5 tabular-nums ${netProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(netProfit, lang)}</p>
            </div>
          </div>

          {/* Profit margin bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] text-slate-300 mb-1.5">
              <span>{t('هامش الربح', 'Profit Margin', lang)}</span>
              <span className="font-semibold text-white tabular-nums">{margin}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${netProfit >= 0 ? 'bg-gradient-to-r from-emerald-400 to-teal-300' : 'bg-gradient-to-r from-rose-500 to-rose-400'}`}
                style={{ width: `${Math.min(Math.abs(margin), 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Alerts ────────────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Bell className="size-3.5" />
            {t('التنبيهات والإجراءات المطلوبة', 'Alerts & Required Actions', lang)}
            <span className="bg-rose-500 text-white rounded-full text-[10px] px-1.5 py-0.5">{alerts.length}</span>
          </p>
          <div className="grid sm:grid-cols-2 gap-2">
            {alerts.map((a, i) => <AlertItem key={i} {...a} />)}
          </div>
        </div>
      )}

      {/* ─── KPI Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('مشاريع نشطة', 'Active Projects', lang)}
          value={activeProjects.length}
          subtitle={`${t('إجمالي', 'Total', lang)}: ${projects.length}`}
          icon={Building2} tint={{ bg: 'bg-emerald-100', icon: 'text-emerald-600', glow: 'bg-emerald-500' }}
          onClick={() => setActiveItem('projects')}
        />
        <KPICard
          title={t('قيمة العقود', 'Contract Value', lang)}
          value={formatCurrency(totalContractVal, lang)}
          subtitle={t('جميع المشاريع', 'All projects', lang)}
          icon={FileText} tint={{ bg: 'bg-blue-100', icon: 'text-blue-600', glow: 'bg-blue-500' }}
        />
        <KPICard
          title={t('المعدات المتاحة', 'Available Equipment', lang)}
          value={availableEquip}
          subtitle={`${rentedEquip} ${t('مؤجرة', 'rented', lang)} · ${maintenanceEquip} ${t('صيانة', 'maint.', lang)}`}
          icon={Truck} tint={{ bg: 'bg-cyan-100', icon: 'text-cyan-600', glow: 'bg-cyan-500' }}
          onClick={() => setActiveItem('equipment')}
        />
        <KPICard
          title={t('الذمم المدينة', 'Receivables', lang)}
          value={formatCurrency(pendingRevenue, lang)}
          subtitle={`${overdueInvoices.length} ${t('متأخرة', 'overdue', lang)}`}
          icon={CreditCard} tint={overdueInvoices.length ? { bg: 'bg-rose-100', icon: 'text-rose-600', glow: 'bg-rose-500' } : { bg: 'bg-amber-100', icon: 'text-amber-600', glow: 'bg-amber-500' }}
          onClick={() => setActiveItem('sales')}
        />
        <KPICard
          title={t('عقود التأجير النشطة', 'Active Rentals', lang)}
          value={activeRentals.length}
          subtitle={`${expiredRentals.length} ${t('منتهية', 'expired', lang)}`}
          icon={Package} tint={expiredRentals.length ? { bg: 'bg-rose-100', icon: 'text-rose-600', glow: 'bg-rose-500' } : { bg: 'bg-purple-100', icon: 'text-purple-600', glow: 'bg-purple-500' }}
          onClick={() => setActiveItem('rental-contracts')}
        />
        <KPICard
          title={t('الموظفون', 'Employees', lang)}
          value={employees.length}
          subtitle={t('نشطون', 'Active', lang)}
          icon={Users} tint={{ bg: 'bg-violet-100', icon: 'text-violet-600', glow: 'bg-violet-500' }}
          onClick={() => setActiveItem('employees')}
        />
        <KPICard
          title={t('الإيرادات المحصلة', 'Collected Revenue', lang)}
          value={formatCurrency(collectedRevenue, lang)}
          subtitle={t('فواتير مدفوعة', 'Paid invoices', lang)}
          icon={TrendingUp} tint={{ bg: 'bg-teal-100', icon: 'text-teal-600', glow: 'bg-teal-500' }}
          onClick={() => setActiveItem('sales')}
        />
        <KPICard
          title={t('صافي الربح', 'Net Profit', lang)}
          value={formatCurrency(netProfit, lang)}
          subtitle={netProfit >= 0 ? t('ربح', 'Profit', lang) : t('خسارة', 'Loss', lang)}
          icon={Wallet} tint={netProfit >= 0 ? { bg: 'bg-emerald-100', icon: 'text-emerald-600', glow: 'bg-emerald-600' } : { bg: 'bg-rose-100', icon: 'text-rose-600', glow: 'bg-rose-600' }}
        />
      </div>

      {/* ─── Active lists + Quick actions ──────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-4">

        {/* Active projects */}
        <Card className="lg:col-span-2 border-border/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Building2 className="size-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{t('المشاريع النشطة', 'Active Projects', lang)}</p>
                  <p className="text-[11px] text-muted-foreground">{activeProjects.length} {t('مشروع قيد التنفيذ', 'in progress', lang)}</p>
                </div>
              </div>
              <button onClick={() => setActiveItem('projects')} className="text-xs font-medium text-emerald-600 hover:text-emerald-700">
                {t('عرض الكل', 'View all', lang)}
              </button>
            </div>

            {activeProjects.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">{t('لا توجد مشاريع نشطة حالياً', 'No active projects', lang)}</div>
            ) : (
              <div className="space-y-2">
                {activeProjects.slice(0, 5).map(p => {
                  const st = PROJECT_STATUS[p.status] || PROJECT_STATUS.PLANNING;
                  const pct = Math.min(Math.max(p.progressPercent || 0, 0), 100);
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setProjectContext(p.id, p.name); if (p.clientId) setClientContext(p.clientId, p.clientName); }}
                      className="w-full text-start rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-emerald-200 transition-all px-3.5 py-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm truncate">{p.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.color}`}>{lang === 'ar' ? st.ar : st.en}</span>
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[11px] font-semibold text-muted-foreground tabular-nums w-9 text-end">{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick actions + active rentals */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <p className="text-sm font-semibold mb-3">{t('إجراءات سريعة', 'Quick Actions', lang)}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'sales',            ar: 'فاتورة عميل',  en: 'Invoice',   color: 'hover:border-emerald-200 hover:bg-emerald-50 text-emerald-700' },
                  { key: 'purchase-orders',  ar: 'أمر شراء',     en: 'Purchase',  color: 'hover:border-amber-200 hover:bg-amber-50 text-amber-700' },
                  { key: 'expenses',         ar: 'مصروف',        en: 'Expense',   color: 'hover:border-rose-200 hover:bg-rose-50 text-rose-700' },
                  { key: 'rental-contracts', ar: 'عقد تأجير',    en: 'Rental',    color: 'hover:border-cyan-200 hover:bg-cyan-50 text-cyan-700' },
                  { key: 'client-payments',  ar: 'تحصيل',        en: 'Collect',   color: 'hover:border-teal-200 hover:bg-teal-50 text-teal-700' },
                  { key: 'reports',          ar: 'التقارير',     en: 'Reports',   color: 'hover:border-blue-200 hover:bg-blue-50 text-blue-700' },
                ].map(item => (
                  <button
                    key={item.key}
                    onClick={() => setActiveItem(item.key)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-2 rounded-lg border border-border/60 bg-card text-foreground transition-all ${item.color}`}
                  >
                    <Plus className="size-3.5 shrink-0 opacity-60" />
                    <span className="truncate">{lang === 'ar' ? item.ar : item.en}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="size-8 rounded-lg bg-cyan-100 flex items-center justify-center">
                    <Truck className="size-4 text-cyan-600" />
                  </div>
                  <p className="text-sm font-semibold">{t('التأجير الجاري', 'Active Rentals', lang)}</p>
                </div>
                <button onClick={() => setActiveItem('rental-contracts')} className="text-xs font-medium text-cyan-600 hover:text-cyan-700">
                  {t('الكل', 'All', lang)}
                </button>
              </div>
              {activeRentals.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">{t('لا يوجد تأجير جارٍ', 'No active rentals', lang)}</div>
              ) : (
                <div className="space-y-1.5">
                  {activeRentals.slice(0, 4).map(r => {
                    const expired = r.endDate && r.endDate < today;
                    return (
                      <div key={r.id} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 border ${expired ? 'bg-rose-50 border-rose-200' : 'bg-muted/40 border-transparent'}`}>
                        <span className="font-medium truncate">{r.equipmentName}</span>
                        <span className="ms-2 shrink-0 text-muted-foreground truncate max-w-[45%]">{r.clientName}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}