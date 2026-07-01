import React from 'react';
import { Menu, Bell, User } from 'lucide-react';
import Sidebar from './Sidebar';
import { useStore } from '@/lib/store';

export default function AppShell({ children }) {
  const { sidebarOpen, setSidebarOpen, lang } = useStore();

  return (
    <div className="flex h-screen bg-background overflow-hidden" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:flex flex-shrink-0">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 start-0 z-50 lg:hidden">
            <Sidebar onClose={() => setSidebarOpen(false)} />
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
          <button className="size-9 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground">
            <Bell className="size-5" />
          </button>
          <button className="size-9 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-sm">
            A
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-muted/30">
          {children}
        </main>
      </div>
    </div>
  );
}