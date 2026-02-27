'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserMode = 'business' | 'personal';

interface UserModeContextType {
  mode: UserMode;
  setMode: (mode: UserMode) => void;
  toggleMode: () => void;
  isBusiness: boolean;
  isPersonal: boolean;
}

const UserModeContext = createContext<UserModeContextType | undefined>(undefined);

const STORAGE_KEY = 'books_user_mode';

export function UserModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<UserMode>('business');
  const [isHydrated, setIsHydrated] = useState(false);

  // Load mode from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'personal' || stored === 'business') {
      setModeState(stored);
    }
    setIsHydrated(true);
  }, []);

  // Save mode to localStorage when it changes
  const setMode = (newMode: UserMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);
  };

  const toggleMode = () => {
    const newMode = mode === 'business' ? 'personal' : 'business';
    setMode(newMode);
  };

  const value: UserModeContextType = {
    mode,
    setMode,
    toggleMode,
    isBusiness: mode === 'business',
    isPersonal: mode === 'personal',
  };

  // Prevent hydration mismatch by not rendering until client-side
  if (!isHydrated) {
    return null;
  }

  return (
    <UserModeContext.Provider value={value}>
      {children}
    </UserModeContext.Provider>
  );
}

export function useUserMode() {
  const context = useContext(UserModeContext);
  if (context === undefined) {
    throw new Error('useUserMode must be used within a UserModeProvider');
  }
  return context;
}

// Hook that returns just the default is_business value (safe to use in forms)
export function useDefaultIsBusiness(): boolean {
  const context = useContext(UserModeContext);
  // Default to true (business) if context not available
  return context?.isBusiness ?? true;
}
