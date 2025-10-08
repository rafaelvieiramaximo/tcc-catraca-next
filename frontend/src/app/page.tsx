// app/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppAuth } from './contexts/app-auth-context';
import Login from './components/auth/page';
import LoadingScreen from './components/loadingScreen';

export default function Home() {
  const { 
    isAuthenticated, 
    currentUser, 
    loading,
    handleLoginSuccess 
  } = useAppAuth();
  
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && currentUser && !loading) {
      if (currentUser.tipo === 'PORTARIA') {
        router.push('/portaria');
      } else if (currentUser.tipo === 'ADMIN') {
        router.push('/admin');
      }
    }
  }, [isAuthenticated, currentUser, loading, router]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return <LoadingScreen message="Redirecionando..." />;
}