'use client';

import { ReactNode } from 'react';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserModeProvider } from '@/contexts/UserModeContext';
import { EntityProvider } from '@/contexts/EntityContext';

interface ProvidersProps {
  children: ReactNode;
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <AuthProvider>
        <UserModeProvider>
          <EntityProvider>
            {children}
          </EntityProvider>
        </UserModeProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
