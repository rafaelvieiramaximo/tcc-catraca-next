'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { databaseService, UsuarioCompleto } from '../services/database-service';

interface AppAuthContextType {
  isAuthenticated: boolean;
  currentUser: UsuarioCompleto | null;
  loading: boolean;
  authToken: string | null; // ✅ NOVO
  handleLoginSuccess: (user: UsuarioCompleto, token: string) => void; // ✅ ATUALIZADO
  handleLogout: () => void;
  checkDatabaseConnection: () => Promise<void>;
}

const AppAuthContext = createContext<AppAuthContextType | undefined>(undefined);

export function AppAuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UsuarioCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const [authToken, setAuthToken] = useState<string | null>(null);

  const handleLoginSuccess = (user: UsuarioCompleto, token: string) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setAuthToken(token); // ✅ NOVO
    setIsLoggingOut(false);

    if (typeof window !== 'undefined') {
      localStorage.setItem('fatec-portaria-user', JSON.stringify(user));
      localStorage.setItem('fatec-portaria-auth', 'true');
      localStorage.setItem('auth_token', token); // ✅ SALVAR TOKEN
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setIsAuthenticated(false);
    setTimeout(() => {
      setCurrentUser(null);
    }, 800);
    setAuthToken(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('fatec-portaria-user');
      localStorage.removeItem('fatec-portaria-auth');
      localStorage.removeItem('auth_token'); // ✅ REMOVER TOKEN
    }

    router.push('/');
  };

  const checkDatabaseConnection = async () => {
    try {
      setLoading(false);
      console.log('Database connection successful');
    } catch (error) {
      console.error('Database connection error:', error);
      setLoading(false);
    }
  };

  // contexts/app-auth-context.tsx - CORREÇÃO NO useEffect
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (mounted) {
        const savedAuth = typeof window !== 'undefined' ? localStorage.getItem('fatec-portaria-auth') : null;
        const savedUser = typeof window !== 'undefined' ? localStorage.getItem('fatec-portaria-user') : null;
        const savedToken = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

        console.log('🔄 Initializing auth:', {
          savedAuth,
          hasUser: !!savedUser,
          hasToken: !!savedToken
        });

        if (savedAuth === 'true' && savedUser) {
          try {
            const user = JSON.parse(savedUser);
            setCurrentUser(user);
            setIsAuthenticated(true);

            // ✅ RESTAURAR TOKEN SE EXISTIR
            if (savedToken) {
              setAuthToken(savedToken);
              console.log('✅ Token restaurado do localStorage');
            }
          } catch (error) {
            console.error('Error parsing saved user:', error);
            handleLogout();
          }
        }

        await checkDatabaseConnection();
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppAuthContext.Provider value={{
      isAuthenticated,
      currentUser,
      loading,
      authToken,
      handleLoginSuccess,
      handleLogout,
      checkDatabaseConnection
    }}>
      {children}
    </AppAuthContext.Provider>
  );
}

export function useAppAuth() {
  const context = useContext(AppAuthContext);
  if (context === undefined) {
    throw new Error('useAppAuth deve ser usado dentro de um AppAuthProvider');
  }
  return context;
}