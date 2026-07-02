import React from 'react';
import { Menu, LogOut, User, ChevronDown } from 'lucide-react';
import Sidebar from './Sidebar';
import ContextBar from '@/components/shared/ContextBar';
import { useStore } from '@/lib/store';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { t } from '@/lib/utils-binaa';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function AppShell({ children }) {
  const { sidebarOpen, setSidebarOpen, lang, setActiveItem } = useStore();
  // Reuse the already-resolved user from AuthContext (MainApp only renders after
  // auth finished loading), avoiding a second me() call and its race condition.
  const { user } = useAuth();
  // Only filter the menu by permissions once we actually have a resolved user.
  // While the user is unresolved (e.g. preview/anonymous session), show the full
  // menu — the page-level guard still protects the content.
  const userLoaded = !!user;

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const handleLogout = () => {
    base44.auth.logout('/login');
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar currentUser={user} userLoaded={userLoaded} />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 start-0 z-50 lg:hidden">
            <Sidebar onClose={() => setSidebarOpen(false)} currentUser={user} userLoaded={userLoaded} />
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-white flex items-center px-4 gap-3 shrink-0">
          <button
            className="lg:hidden size-9 flex items-center justify-center rounded-lg hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <div className="flex-1" />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted transition-colors">
                <div className="size-8 rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm flex items-center justify-center">
                  {initials}
                </div>
                <span className="text-sm font-medium hidden sm:block max-w-[120px] truncate">
                  {user?.full_name || (lang === 'ar' ? 'المستخدم' : 'User')}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-2 py-1.5">
                <p className="text-xs font-medium">{user?.full_name || '—'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || '—'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setActiveItem('profile')} className="gap-2 cursor-pointer">
                <User className="size-4" />
                {t('ملفي الشخصي', 'My Profile', lang)}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-rose-600 gap-2 cursor-pointer">
                <LogOut className="size-4" />
                {lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <ContextBar />
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}