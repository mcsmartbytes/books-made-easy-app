'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isEmbedded: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Allowed parent origins for postMessage auth
const ALLOWED_PARENT_ORIGINS = [
  'https://sealn-super-site.vercel.app',
  'http://localhost:3000',
];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const authProcessed = useRef(false);

  // Check if running in embedded mode
  const isEmbedded = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('embedded') === 'true';

  // Authenticate using token from parent
  const authenticateWithToken = useCallback(async (token: string) => {
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: token,
        refresh_token: '',
      });

      if (error) {
        console.error('Token auth failed:', error.message);
        return false;
      }

      if (data.session) {
        setSession(data.session);
        setUser(data.session.user);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token auth error:', error);
      return false;
    }
  }, []);

  // Handle postMessage auth from parent window
  useEffect(() => {
    if (!isEmbedded) return;

    const handleMessage = async (event: MessageEvent) => {
      // Validate origin
      if (!ALLOWED_PARENT_ORIGINS.includes(event.origin)) {
        return;
      }

      // Handle auth token from parent
      if (event.data?.type === 'AUTH_TOKEN' && !authProcessed.current) {
        authProcessed.current = true;
        const success = await authenticateWithToken(event.data.token);
        if (success) {
          // Confirm auth to parent
          window.parent.postMessage({ type: 'AUTH_CONFIRMED' }, event.origin);
          setLoading(false);
        } else {
          // Fall back to session check
          const { data: { session } } = await supabase.auth.getSession();
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);
        }
      }

      // Handle token refresh
      if (event.data?.type === 'AUTH_TOKEN_REFRESH') {
        await authenticateWithToken(event.data.token);
      }
    };

    window.addEventListener('message', handleMessage);

    // Signal to parent that we're ready for auth
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'EMBEDDED_APP_READY' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, [isEmbedded, authenticateWithToken]);

  // Handle initial authentication (non-embedded or fallback)
  useEffect(() => {
    const initAuth = async () => {
      if (isEmbedded) {
        // In embedded mode, wait for postMessage auth with timeout fallback
        const timeout = setTimeout(async () => {
          if (!authProcessed.current) {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
          }
        }, 3000);
        return () => clearTimeout(timeout);
      } else {
        // Get initial session for standalone mode
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isEmbedded]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isEmbedded, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
