import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { canAccess } from '@/lib/permissions';
import { CYCLE_BY_KEY, READY_TABS } from '@/lib/cycles';

// Tab content screens
import Projects from '@/pages/Projects';
import Contracts from '@/pages/Contracts';
import SalesInvoices from '@/pages/SalesInvoices';
import Equipment from '@/pages/Equipment';
import RentalContracts from '@/pages/RentalContracts';
import PurchaseOrders from '@/pages/PurchaseOrders';
import Expenses from '@/pages/Expenses';
import Subcontractors from '@/pages/Subcontractors';
import SupplierInvoices from '@/pages/SupplierInvoices';
import SupplierPayments from '@/pages/SupplierPayments';
import Employees from '@/pages/Employees';
import PayrollRuns from '@/pages/PayrollRuns';
import Attendance from '@/pages/Attendance';
import Advances from '@/pages/Advances';
import ChartAccounts from '@/pages/ChartAccounts';
import JournalEntries from '@/pages/JournalEntries';
import TrialBalance from '@/pages/TrialBalance';
import FiscalYears from '@/pages/FiscalYears';
import Inventory from '@/pages/Inventory';
import Reports from '@/pages/Reports';
import Clients from '@/pages/Clients';
import Suppliers from '@/pages/Suppliers';
import Users from '@/pages/Users';
import Settings from '@/pages/Settings';
import ComingSoon from '@/pages/ComingSoon';

const TAB_CONTENT = {
  projects: <Projects />,
  contracts: <Contracts />,
  sales: <SalesInvoices />,
  'client-payments': <ComingSoon title="التحصيلات" titleEn="Client Collections" />,
  boq: <ComingSoon title="جدول الكميات BOQ" titleEn="Bill of Quantities (BOQ)" />,
  equipment: <Equipment />,
  'rental-contracts': <RentalContracts />,
  timesheets: <ComingSoon title="ساعات التشغيل" titleEn="Timesheets" />,
  'equipment-maintenance': <ComingSoon title="الصيانة" titleEn="Maintenance" />,
  fuel: <ComingSoon title="استهلاك الوقود" titleEn="Fuel Consumption" />,
  'purchase-orders': <PurchaseOrders />,
  expenses: <Expenses />,
  subcontractors: <Subcontractors />,
  'supplier-invoices': <SupplierInvoices />,
  'supplier-payments': <SupplierPayments />,
  employees: <Employees />,
  'payroll-runs': <PayrollRuns />,
  attendance: <Attendance />,
  advances: <Advances />,
  'chart-accounts': <ChartAccounts />,
  accounting: <JournalEntries />,
  'trial-balance': <TrialBalance />,
  vat: <Reports />,
  reports: <Reports />,
  'fiscal-years': <FiscalYears />,
  clients: <Clients />,
  suppliers: <Suppliers />,
  inventory: <Inventory />,
  users: <Users />,
  settings: <Settings />,
};

export default function CycleScreen({ cycleKey }) {
  const { lang } = useStore();
  const { user: currentUser } = useAuth();
  const userLoaded = !!currentUser;
  const cycle = CYCLE_BY_KEY[cycleKey];

  // Only tabs the user is allowed to see
  const visibleTabs = useMemo(() => {
    if (!cycle) return [];
    return cycle.tabs.filter(tb => !userLoaded || canAccess(currentUser, tb.key));
  }, [cycle, currentUser, userLoaded]);

  const [activeTab, setActiveTab] = useState(visibleTabs[0]?.key);

  // Keep active tab valid when the visible set changes (e.g. cycle switch)
  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some(t => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [visibleTabs, activeTab]);

  if (!cycle) return null;

  const color = cycle.color;
  const content = TAB_CONTENT[activeTab] || <ComingSoon title="قريباً" titleEn="Coming Soon" />;

  return (
    <div className="flex flex-col h-full">
      {/* Cycle header + top tabs */}
      <div className="border-b border-border bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5 px-4 md:px-6 pt-4">
          <div className={`size-9 rounded-lg ${color.light} flex items-center justify-center`}>
            <cycle.Icon className={`size-5 ${color.text}`} />
          </div>
          <h1 className="text-lg font-bold text-foreground">{lang === 'ar' ? cycle.label.ar : cycle.label.en}</h1>
        </div>
        <div className="px-2 md:px-4 mt-2 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {visibleTabs.map(tab => {
              const isActive = tab.key === activeTab;
              const isReady = READY_TABS.has(tab.key);
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-3.5 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                    ${isActive
                      ? `${color.border} ${color.text}`
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }`}
                >
                  {tab.Icon && <tab.Icon className="size-4" />}
                  {lang === 'ar' ? tab.ar : tab.en}
                  {!isReady && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-600 font-semibold">
                      {lang === 'ar' ? 'قريباً' : 'Soon'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active tab content */}
      <div className="flex-1 min-h-0">
        {content}
      </div>
    </div>
  );
}