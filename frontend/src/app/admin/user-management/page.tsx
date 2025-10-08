// app/admin/user-management/page.tsx
'use client';

import { useAppAuth } from '../../contexts/app-auth-context';
import UserManagement from '../../components/UserManagement/page';

export default function UserManagementPage() {
  const { currentUser, handleLogout } = useAppAuth();

  return <UserManagement user={currentUser} onLogout={handleLogout} />;
}