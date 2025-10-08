// app/portaria/page.tsx
'use client';

import { useAppAuth } from '../contexts/app-auth-context';
import RegisterEntry from '../components/RegisterEntry/page';

export default function PortariaPage() {
  const { currentUser, handleLogout } = useAppAuth();

  return <RegisterEntry user={currentUser} onLogout={handleLogout} />;
}