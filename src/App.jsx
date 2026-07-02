import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { StoreProvider, useStore } from '@/lib/store';
import AppShell from '@/components/layout/AppShell';
import { canAccess } from '@/lib/permissions';
import { ShieldAlert } from 'lucide-react';

// Pages
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import ProjectWorkspace from '@/pages/ProjectWorkspace';
import Equipment from '@/pages/Equipment';
import EquipmentWorkspace from '@/pages/EquipmentWorkspace';
import Clients from '@/pages/Clients';
import Suppliers from '@/pages/Suppliers';
import Employees from '@/pages/Employees';
import EmployeeWorkspace from '@/pages/EmployeeWorkspace';
import Contracts from '@/pages/Contracts';
import RentalContracts from '@/pages/RentalContracts';
import SalesInvoices from '@/pages/SalesInvoices';
import PurchaseOrders from '@/pages/PurchaseOrders';
import Expenses from '@/pages/Expenses';
import Subcontractors from '@/pages/Subcontractors';
import JournalEntries from '@/pages/JournalEntries';
import ChartAccounts from '@/pages/ChartAccounts';
import PayrollRuns from '@/pages/PayrollRuns';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';
import Users from '@/pages/Users';
import Profile from '@/pages/Profile';
import ComingSoon from '@/pages/ComingSoon';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import { Navigate } from 'react-router-dom';

// Access-denied fallback for unauthorized modules
function AccessDenied() {
  const { lang } = useStore();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <ShieldAlert className="size-14 text-amber-500 mb-4" />
      <h2 className="text-lg font-bold">{lang === 'ar' ? 'لا تملك صلاحية الوصول' : 'Access Denied'}</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-md">
        {lang === 'ar' ? 'ليس لديك صلاحية للوصول إلى هذه الوحدة. تواصل مع مدير النظام.' : 'You don\'t have permission to access this module. Contact your administrator.'}
      </p>
    </div>
  );
}

// Page map for sidebar navigation
function MainApp() {
  const { activeItem } = useStore();
  const { user: currentUser } = useAuth();
  // Only enforce per-module permissions once we have a resolved user. Before that
  // (preview/anonymous session), allow content so the app isn't blocked.
  const userLoaded = !!currentUser;

  const pageMap = {
    dashboard: <Dashboard />,
    // Projects cycle
    projects: <Projects />,
    'project-workspace': <ProjectWorkspace />,
    contracts: <Contracts />,
    boq: <ComingSoon title="جدول الكميات BOQ" titleEn="Bill of Quantities (BOQ)" />,
    sales: <SalesInvoices />,
    'client-payments': <ComingSoon title="التحصيلات" titleEn="Client Collections" />,
    // Rental cycle
    equipment: <Equipment />,
    'equipment-workspace': <EquipmentWorkspace />,
    'rental-contracts': <RentalContracts />,
    'delivery-orders': <ComingSoon title="أوامر التوصيل" titleEn="Delivery Orders" />,
    timesheets: <ComingSoon title="ساعات التشغيل" titleEn="Timesheets" />,
    'rental-invoices': <ComingSoon title="فواتير التأجير" titleEn="Rental Invoices" />,
    'rental-payments': <ComingSoon title="تحصيلات التأجير" titleEn="Rental Collections" />,
    'equipment-maintenance': <ComingSoon title="الصيانة" titleEn="Maintenance" />,
    fuel: <ComingSoon title="الوقود" titleEn="Fuel Log" />,
    // Costs cycle
    'purchase-requests': <ComingSoon title="طلبات الشراء" titleEn="Purchase Requests" />,
    'purchase-orders': <PurchaseOrders />,
    'supplier-invoices': <ComingSoon title="فواتير الموردين" titleEn="Supplier Invoices" />,
    'supplier-payments': <ComingSoon title="سداد الموردين" titleEn="Supplier Payments" />,
    timesheets: <ComingSoon title="ساعات التشغيل" titleEn="Timesheets" />,
    advances: <ComingSoon title="السلف والاستقطاعات" titleEn="Employee Advances" />,
    inventory: <ComingSoon title="المخزون والأصول" titleEn="Inventory & Assets" />,
    boq: <ComingSoon title="جدول الكميات BOQ" titleEn="Bill of Quantities (BOQ)" />,
    expenses: <Expenses />,
    'petty-cash': <ComingSoon title="الصندوق النقدي" titleEn="Petty Cash" />,
    // Subcontractors
    subcontractors: <Subcontractors />,
    // HR cycle
    employees: <Employees />,
    'employee-workspace': <EmployeeWorkspace />,
    attendance: <ComingSoon title="الحضور والانصراف" titleEn="Attendance" />,
    'payroll-runs': <PayrollRuns />,
    advances: <ComingSoon title="السلف" titleEn="Employee Advances" />,
    // Accounting
    'chart-accounts': <ChartAccounts />,
    accounting: <JournalEntries />,
    vat: <Reports />,
    reports: <Reports />,
    // Settings
    clients: <Clients />,
    suppliers: <Suppliers />,
    inventory: <ComingSoon title="المخزون" titleEn="Inventory" />,
    users: <Users />,
    profile: <Profile />,
    settings: <Settings />,
  };

  const resolvedPage = pageMap[activeItem] || <Dashboard />;
  // Always-allowed keys, plus permission check for the rest
  const alwaysAllowed = activeItem === 'dashboard' || activeItem === 'profile';
  const allowed = alwaysAllowed || !userLoaded || canAccess(currentUser, activeItem);
  const currentPage = allowed ? resolvedPage : <AccessDenied />;

  return (
    <AppShell>
      {currentPage}
    </AppShell>
  );
}

// Auth routes are always available so the in-app login/register pages render.
const AuthRoutes = () => (
  <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Show the in-app login page instead of redirecting to the hosted login.
      return <AuthRoutes />;
    }
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/register" element={<Navigate to="/" replace />} />
      <Route path="/*" element={<MainApp />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <StoreProvider>
          <Router>
            <ScrollToTop />
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </StoreProvider>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;