import React, { useState, useEffect } from 'react';
import {
  Building2, Truck, Users, AlertTriangle, Clock,
  TrendingUp, TrendingDown, DollarSign, CreditCard,
  ArrowRight, ArrowLeft, FileText, Bell,
  Package, RefreshCw, ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { useStore } from '@/lib/store';
import { t, formatCurrency, PROJECT_STATUS, EQUIPMENT_STATUS } from '@/lib/utils-binaa';

// ─── KPI Card ────────────────────────────────────────────────────────────────
// eslint-disable-next-line react/prop-types
function KPICard({ title, value, subtitle, icon: Icon, iconBg, onClick }) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${onClick ? 'cursor-pointer' : ''}`} onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground font-medium truncate">{title}</p>
            <p className="text-xl font-bold mt-1 text-foreground">{value}</p>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className="size-4 text-white" />
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

// ─── Workflow Bar ─────────────────────────────────────────────────────────────
function WorkflowBar({ steps, color, lang, setActiveItem, ArrowIcon }) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <button
            onClick={() => step.ready && setActiveItem(step.key)}
            className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors whitespace-nowrap
              ${step.ready
                ? `${color.border} ${color.bg} ${color.text} ${color.hover}`
                : 'border-slate-200 bg-slate-50 text-slate-400 cursor-default'}`}
          >
            {lang === 'ar' ? step.ar : step.en}
          </button>
          {i < steps.length - 1 && <ArrowIcon className={`size-3 shrink-0 ${color.arrow}`} />}
        </React.Fragment>
      ))}
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
    // Load in small parallel batches with a short pause between them
    // to stay under the API rate limit while keeping load times fast.
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));

    const [projects, equipment, employees] = await Promise.all([
      base44.entities.Project.list('-created_date', 100),
      base44.entities.Equipment.list('-created_date', 100),
      base44.entities.Employee.filter({ isActive: true }),
    ]);

    await sleep(400);

    const [invoices, expenses, purchaseOrders, rentalContracts] = await Promise.all([
      base44.entities.SalesInvoice.list('-created_date', 100),
      base44.entities.Expense.list('-created_date', 50),
      base44.entities.PurchaseOrder.list('-created_date', 50),
      base44.entities.RentalContract.list('-created_date', 50),
    ]);

    setData({ projects, equipment, employees, invoices, expenses, purchaseOrders, rentalContracts });
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

  // ─── Workflows ───────────────────────────────────────────────────────────
  const isRTL = lang === 'ar';
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;
  const constructionSteps = [
    { key: 'clients',          ar: 'العميل',     en: 'Client',     ready: true },
    { key: 'projects',         ar: 'المشروع',    en: 'Project',    ready: true },
    { key: 'contracts',        ar: 'العقد',      en: 'Contract',   ready: true },
    { key: 'purchase-orders',  ar: 'الشراء',     en: 'Purchasing', ready: true },
    { key: 'sales',            ar: 'الفاتورة',   en: 'Invoice',    ready: true },
    { key: 'client-payments',  ar: 'التحصيل',    en: 'Collection', ready: false },
  ];
  const rentalSteps = [
    { key: 'equipment',        ar: 'المعدة',     en: 'Equipment',  ready: true },
    { key: 'rental-contracts', ar: 'العقد',      en: 'Contract',   ready: true },
    { key: 'timesheets',       ar: 'ساعات',      en: 'Timesheets', ready: false },
    { key: 'rental-invoices',  ar: 'الفاتورة',   en: 'Invoice',    ready: false },
    { key: 'rental-payments',  ar: 'التحصيل',    en: 'Collection', ready: false },
  ];

  if (loading) {
    return (
      <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}><CardContent className="p-4"><div className="h-16 bg-muted animate-pulse rounded" /></CardContent></Card>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('مركز القيادة', 'Command Center', lang)}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('نظرة عامة فورية على أداء الشركة', 'Real-time company performance overview', lang)}</p>
        </div>
        <Button variant="outline" size="icon" onClick={load} className="size-8">
          <RefreshCw className="size-3.5" />
        </Button>
      </div>

      {/* Alerts Zone */}
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

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title={t('مشاريع نشطة', 'Active Projects', lang)}
          value={activeProjects.length}
          subtitle={`${t('إجمالي', 'Total', lang)}: ${projects.length}`}
          icon={Building2} iconBg="bg-emerald-500"
          onClick={() => setActiveItem('projects')}
        />
        <KPICard
          title={t('قيمة العقود', 'Contract Value', lang)}
          value={formatCurrency(totalContractVal, lang)}
          subtitle={t('جميع المشاريع', 'All projects', lang)}
          icon={FileText} iconBg="bg-blue-500"
        />
        <KPICard
          title={t('الإيرادات المحصلة', 'Collected Revenue', lang)}
          value={formatCurrency(collectedRevenue, lang)}
          subtitle={t('فواتير مدفوعة', 'Paid invoices', lang)}
          icon={TrendingUp} iconBg="bg-teal-500"
          onClick={() => setActiveItem('sales')}
        />
        <KPICard
          title={t('الذمم المدينة', 'Receivables', lang)}
          value={formatCurrency(pendingRevenue, lang)}
          subtitle={`${overdueInvoices.length} ${t('متأخرة', 'overdue', lang)}`}
          icon={CreditCard} iconBg={overdueInvoices.length ? 'bg-rose-500' : 'bg-amber-500'}
          onClick={() => setActiveItem('sales')}
        />
        <KPICard
          title={t('المعدات المتاحة', 'Available Equipment', lang)}
          value={availableEquip}
          subtitle={`${rentedEquip} ${t('مؤجرة', 'rented', lang)} · ${maintenanceEquip} ${t('صيانة', 'maint.', lang)}`}
          icon={Truck} iconBg="bg-cyan-500"
          onClick={() => setActiveItem('equipment')}
        />
        <KPICard
          title={t('عقود التأجير النشطة', 'Active Rentals', lang)}
          value={activeRentals.length}
          subtitle={`${expiredRentals.length} ${t('منتهية', 'expired', lang)}`}
          icon={Package} iconBg={expiredRentals.length ? 'bg-rose-500' : 'bg-purple-500'}
          onClick={() => setActiveItem('rental-contracts')}
        />
        <KPICard
          title={t('الموظفون', 'Employees', lang)}
          value={employees.length}
          subtitle={t('نشطون', 'Active', lang)}
          icon={Users} iconBg="bg-violet-500"
          onClick={() => setActiveItem('employees')}
        />
        <KPICard
          title={t('صافي الربح', 'Net Profit', lang)}
          value={formatCurrency(netProfit, lang)}
          subtitle={netProfit >= 0 ? t('ربح', 'Profit', lang) : t('خسارة', 'Loss', lang)}
          icon={netProfit >= 0 ? TrendingUp : TrendingDown}
          iconBg={netProfit >= 0 ? 'bg-emerald-600' : 'bg-rose-600'}
        />
      </div>

      {/* Dual Hub */}
      <div className="grid lg:grid-cols-2 gap-4">

        {/* Construction Hub */}
        <Card className="border-t-4 border-t-emerald-500">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                <Building2 className="size-4 text-emerald-600" />
              </div>
              <div>
                <CardTitle className="text-sm">{t('دورة المشاريع التنفيذية', 'Construction Cycle', lang)}</CardTitle>
                <p className="text-[11px] text-muted-foreground">{activeProjects.length} {t('مشروع نشط', 'active projects', lang)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <WorkflowBar steps={constructionSteps} lang={lang} setActiveItem={setActiveItem} ArrowIcon={ArrowIcon}
              color={{ border: 'border-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-700', hover: 'hover:bg-emerald-100', arrow: 'text-emerald-400' }}
            />
            {/* Financial mini */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-emerald-50 rounded-lg p-2">
                <p className="text-sm font-bold text-emerald-700">{formatCurrency(totalContractVal, lang)}</p>
                <p className="text-[10px] text-muted-foreground">{t('العقود', 'Contracts', lang)}</p>
              </div>
              <div className="bg-teal-50 rounded-lg p-2">
                <p className="text-sm font-bold text-teal-700">{formatCurrency(collectedRevenue, lang)}</p>
                <p className="text-[10px] text-muted-foreground">{t('محصّل', 'Collected', lang)}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-2">
                <p className="text-sm font-bold text-amber-700">{formatCurrency(pendingRevenue, lang)}</p>
                <p className="text-[10px] text-muted-foreground">{t('معلق', 'Pending', lang)}</p>
              </div>
            </div>
            {/* Recent active projects */}
            <div className="space-y-1">
              {activeProjects.slice(0, 4).map(p => {
                const st = PROJECT_STATUS[p.status] || PROJECT_STATUS.PLANNING;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setProjectContext(p.id, p.name); if (p.clientId) setClientContext(p.clientId, p.clientName); }}
                    className="w-full flex items-center justify-between text-xs bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 transition-colors"
                  >
                    <span className="font-medium truncate">{p.name}</span>
                    <div className="flex items-center gap-1.5 ms-2 shrink-0">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.color}`}>{lang === 'ar' ? st.ar : st.en}</span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
            <Button onClick={() => setActiveItem('projects')} className="w-full bg-emerald-600 hover:bg-emerald-700" size="sm">
              {t('إدارة المشاريع', 'Manage Projects', lang)}
            </Button>
          </CardContent>
        </Card>

        {/* Rental Hub */}
        <Card className="border-t-4 border-t-cyan-500">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="size-9 bg-cyan-100 rounded-lg flex items-center justify-center">
                <Truck className="size-4 text-cyan-600" />
              </div>
              <div>
                <CardTitle className="text-sm">{t('دورة تأجير المعدات', 'Equipment Rental Cycle', lang)}</CardTitle>
                <p className="text-[11px] text-muted-foreground">{rentedEquip} {t('معدة مؤجرة', 'rented', lang)} · {availableEquip} {t('متاحة', 'available', lang)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <WorkflowBar steps={rentalSteps} lang={lang} setActiveItem={setActiveItem} ArrowIcon={ArrowIcon}
              color={{ border: 'border-cyan-300', bg: 'bg-cyan-50', text: 'text-cyan-700', hover: 'hover:bg-cyan-100', arrow: 'text-cyan-400' }}
            />
            {/* Equipment status grid */}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(EQUIPMENT_STATUS).map(([status, cfg]) => {
                const count = equipment.filter(e => e.status === status).length;
                return (
                  <div key={status} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                    <span className="text-xs text-muted-foreground">{lang === 'ar' ? cfg.ar : cfg.en}</span>
                    <span className="text-sm font-bold">{count}</span>
                  </div>
                );
              })}
            </div>
            {/* Active rentals */}
            <div className="space-y-1">
              {activeRentals.slice(0, 3).map(r => (
                <div key={r.id} className={`flex items-center justify-between text-xs rounded-lg px-3 py-2 ${r.endDate && r.endDate < today ? 'bg-rose-50 border border-rose-200' : 'bg-muted/50'}`}>
                  <span className="font-medium truncate">{r.equipmentName}</span>
                  <span className="ms-2 shrink-0 text-muted-foreground">{r.clientName}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setActiveItem('equipment')} className="flex-1 bg-cyan-600 hover:bg-cyan-700" size="sm">
                {t('المعدات', 'Equipment', lang)}
              </Button>
              <Button onClick={() => setActiveItem('rental-contracts')} variant="outline" className="flex-1" size="sm">
                {t('عقود التأجير', 'Rentals', lang)}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t('الملخص المالي', 'Financial Summary', lang)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-[11px] text-muted-foreground mb-1">{t('إجمالي الإيرادات', 'Total Revenue', lang)}</p>
              <p className="text-lg font-bold text-emerald-700">{formatCurrency(collectedRevenue, lang)}</p>
            </div>
            <div className="text-center p-3 bg-rose-50 rounded-xl">
              <p className="text-[11px] text-muted-foreground mb-1">{t('إجمالي المصروفات', 'Total Expenses', lang)}</p>
              <p className="text-lg font-bold text-rose-700">{formatCurrency(totalExpenses, lang)}</p>
            </div>
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-[11px] text-muted-foreground mb-1">{t('ذمم مدينة', 'Receivables', lang)}</p>
              <p className="text-lg font-bold text-amber-700">{formatCurrency(pendingRevenue, lang)}</p>
            </div>
            <div className={`text-center p-3 rounded-xl ${netProfit >= 0 ? 'bg-teal-50' : 'bg-rose-50'}`}>
              <p className="text-[11px] text-muted-foreground mb-1">{t('صافي الربح', 'Net Profit', lang)}</p>
              <p className={`text-lg font-bold ${netProfit >= 0 ? 'text-teal-700' : 'text-rose-700'}`}>{formatCurrency(netProfit, lang)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">{t('إجراءات سريعة', 'Quick Actions', lang)}</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'sales',           ar: '+ فاتورة عميل',   en: '+ Client Invoice',   color: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' },
            { key: 'purchase-orders', ar: '+ أمر شراء',       en: '+ Purchase Order',   color: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' },
            { key: 'expenses',        ar: '+ مصروف',          en: '+ Expense',          color: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100' },
            { key: 'rental-contracts',ar: '+ عقد تأجير',      en: '+ Rental Contract',  color: 'bg-cyan-50 border-cyan-200 text-cyan-700 hover:bg-cyan-100' },
            { key: 'accounting',      ar: 'القيود المحاسبية', en: 'Journal Entries',    color: 'bg-teal-50 border-teal-200 text-teal-700 hover:bg-teal-100' },
            { key: 'reports',         ar: 'التقارير',         en: 'Reports',            color: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100' },
          ].map(item => (
            <button
              key={item.key}
              onClick={() => setActiveItem(item.key)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${item.color}`}
            >
              {lang === 'ar' ? item.ar : item.en}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}