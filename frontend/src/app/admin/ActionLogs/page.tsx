// app/admin/action-logs/page.tsx
'use client';

import { useAppAuth } from '../../contexts/app-auth-context';
import ActionLogs from '../../components/ActionLogs/page';

export default function ActionLogsPage() {
  const { currentUser, handleLogout } = useAppAuth();

  return <ActionLogs user={currentUser} onLogout={handleLogout} />;
}