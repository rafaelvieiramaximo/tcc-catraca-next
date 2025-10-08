// app/admin/page.tsx
'use client';

import { useAppAuth } from '../contexts/app-auth-context';
import Menu from '../components/Menu';
import LoadingScreen from '../components/loadingScreen';

export default function AdminPage() {
  const { currentUser, handleLogout, loading } = useAppAuth();

  // Mostra loading enquanto verifica autenticação
  if (loading) {
    return <LoadingScreen />;
  }

  // Se não há usuário após o loading, mostra erro
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-lg">Erro: Usuário não autenticado</div>
      </div>
    );
  }

  return <Menu user={currentUser} onLogout={handleLogout} />;
}