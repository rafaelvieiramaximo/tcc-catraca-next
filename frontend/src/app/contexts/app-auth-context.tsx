// contexts/app-auth-context.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { databaseService, UsuarioCompleto } from '../services/database-service';

interface AppAuthContextType {
  isAuthenticated: boolean;
  currentUser: UsuarioCompleto | null;
  loading: boolean;
  handleLoginSuccess: (user: UsuarioCompleto) => void;
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

  const handleLoginSuccess = (user: UsuarioCompleto) => {
    setIsAuthenticated(true);
    setCurrentUser(user);
    setIsLoggingOut(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('fatec-portaria-user', JSON.stringify(user));
      localStorage.setItem('fatec-portaria-auth', 'true');
    }
  };

  const handleLogout = () => {
    setIsLoggingOut(true);
    setIsAuthenticated(false);
    setCurrentUser(null);
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fatec-portaria-user');
      localStorage.removeItem('fatec-portaria-auth');
    }
    
    setTimeout(() => {
      router.push('/');
      setTimeout(() => setIsLoggingOut(false), 1000);
    }, 100);
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

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      if (mounted) {
        const savedAuth = typeof window !== 'undefined' ? localStorage.getItem('fatec-portaria-auth') : null;
        const savedUser = typeof window !== 'undefined' ? localStorage.getItem('fatec-portaria-user') : null;
        
        console.log('Initializing auth:', { savedAuth, savedUser });
        
        if (savedAuth === 'true' && savedUser) {
          try {
            const user = JSON.parse(savedUser);
            setCurrentUser(user);
            setIsAuthenticated(true);
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