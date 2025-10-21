// app/admin/page.tsx
'use client';

import { useAppAuth } from '../../contexts/app-auth-context';
import LoadingScreen from '../../components/loadingScreen';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import ActionLogs from '@/app/components/ActionLogs/page';

export default function AdminPage() {
  const { currentUser, handleLogout, loading, isAuthenticated } = useAppAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <LoadingScreen />;
  }
  if (!currentUser || currentUser.tipo !== 'ADMIN') {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
          <div className="text-red-500 text-lg mb-4">Erro: Usuário não autenticado</div>
          <button
            onClick={() => window.location.href = '/'}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Voltar ao Login
          </button>
        </div>
    )
  }

  return <ActionLogs user={currentUser} onLogout={handleLogout} />;
}