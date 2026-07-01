// Simple global state using React context + localStorage
import { createContext, useContext, useState, useEffect } from 'react';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('binaa-lang') || 'ar');
  const [activeItem, setActiveItem] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleLang = () => {
    const next = lang === 'ar' ? 'en' : 'ar';
    setLang(next);
    localStorage.setItem('binaa-lang', next);
  };

  return (
    <StoreContext.Provider value={{ lang, toggleLang, activeItem, setActiveItem, sidebarOpen, setSidebarOpen }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}