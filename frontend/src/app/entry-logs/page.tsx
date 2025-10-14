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



  return <EntryLogs user={currentUser} onLogout={handleLogout} />;
}