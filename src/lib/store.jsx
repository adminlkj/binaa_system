// Simple global state using React context + localStorage
import { createContext, useContext, useState } from 'react';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('binaa-lang') || 'ar');
  const [activeItem, setActiveItem] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ─── Context Engine: السياق النشط أثناء التنقل ────────────────────────────
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeProjectName, setActiveProjectName] = useState(null);
  const [activeClientId, setActiveClientId] = useState(null);
  const [activeClientName, setActiveClientName] = useState(null);

  const setProjectContext = (id, name) => {
    setActiveProjectId(id);
    setActiveProjectName(name);
    // عند اختيار مشروع، امسح سياق العميل السابق إن وجد
    if (!id) { setActiveClientId(null); setActiveClientName(null); }
  };

  const setClientContext = (id, name) => {
    setActiveClientId(id);
    setActiveClientName(name);
  };

  const clearContext = () => {
    setActiveProjectId(null);
    setActiveProjectName(null);
    setActiveClientId(null);
    setActiveClientName(null);
  };

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    localStorage.setItem('binaa-lang', next);
  };

  return (
    <StoreContext.Provider value={{
      lang, toggleLang,
      activeItem, setActiveItem,
      sidebarOpen, setSidebarOpen,
      // Context Engine
      activeProjectId, activeProjectName,
      activeClientId, activeClientName,
      setProjectContext, setClientContext, clearContext,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}