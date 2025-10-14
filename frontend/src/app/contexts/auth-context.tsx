'use client';

import React, { createContext, useContext, useState } from 'react';
import { UsuarioCompleto } from '../services/database-service';

interface AuthContextType {
  currentUser: UsuarioCompleto | null;
  setCurrentUser: (user: UsuarioCompleto | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UsuarioCompleto | null>(null);

  return (
    <AuthContext.Provider value={{ currentUser, setCurrentUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}