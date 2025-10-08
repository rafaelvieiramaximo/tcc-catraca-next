'use client';

import { useAppAuth } from '../contexts/app-auth-context';
import EntryLogs from '../components/EntryLogs/page';

export default function EntryLogsPage() {
  const { currentUser, handleLogout } = useAppAuth();

  return <EntryLogs user={currentUser} onLogout={handleLogout} />;
}