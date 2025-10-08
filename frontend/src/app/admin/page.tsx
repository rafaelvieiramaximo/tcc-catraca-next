// app/admin/page.tsx
'use client';

import { useAppAuth } from '../contexts/app-auth-context';
import Menu from '../components/Menu';

export default function AdminPage() {
  const { currentUser, handleLogout } = useAppAuth();

  return <Menu user={currentUser} onLogout={handleLogout} />;
}