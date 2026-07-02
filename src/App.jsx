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

// Pages
import Dashboard from '@/pages/Dashboard';
import Projects from '@/pages/Projects';
import Equipment from '@/pages/Equipment';
import Clients from '@/pages/Clients';
import Suppliers from '@/pages/Suppliers';
import Employees from '@/pages/Employees';
import Contracts from '@/pages/Contracts';
import RentalContracts from '@/pages/RentalContracts';
import SalesInvoices from '@/pages/SalesInvoices';
import PurchaseOrders from '@/pages/PurchaseOrders';
import Expenses from '@/pages/Expenses';
import Subcontractors from '@/pages/Subcontractors';
import JournalEntries from '@/pages/JournalEntries';
import PayrollRuns from '@/pages/PayrollRuns';

// Page map for sidebar navigation
function MainApp() {
  const { activeItem } = useStore();

  const pageMap = {
    dashboard: <Dashboard />,
    projects: <Projects />,
    contracts: <Contracts />,
    sales: <SalesInvoices />,
    equipment: <Equipment />,
    'rental-contracts': <RentalContracts />,
    employees: <Employees />,
    'payroll-runs': <PayrollRuns />,
    'purchase-orders': <PurchaseOrders />,
    expenses: <Expenses />,
    subcontractors: <Subcontractors />,
    clients: <Clients />,
    suppliers: <Suppliers />,
    accounting: <JournalEntries />,
  };

  const currentPage = pageMap[activeItem] || <Dashboard />;

  return (
    <AppShell>
      {currentPage}
    </AppShell>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

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
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
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