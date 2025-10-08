// app/entry-logs/page.tsx
'use client';

import { useAppAuth } from '../contexts/app-auth-context';
import EntryLogs from '../components/EntryLogs/page';
import LoadingScreen from '../components/loadingScreen';

export default function EntryLogsPage() {
  const { currentUser, handleLogout, loading } = useAppAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-500 text-lg">Erro: Usuário não autenticado</div>
      </div>
    );
  }

  return <EntryLogs user={currentUser} onLogout={handleLogout} />;
}