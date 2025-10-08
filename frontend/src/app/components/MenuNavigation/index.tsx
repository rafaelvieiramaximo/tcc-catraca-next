// components/MenuNavigation/index.tsx
'use client';

import { useRouter } from 'next/navigation';

interface MenuNavigationProps {
  currentPath?: string;
}

export default function MenuNavigation({ currentPath }: MenuNavigationProps) {
  const router = useRouter();

  const navItems = [
    { label: 'HOME', path: '/admin' },
    { label: 'LOGS DE AÇÕES', path: '/admin/action-logs' },
    { label: 'LOGS DE ENTRADAS', path: '/entry-logs' },
    { label: 'GERENCIAMENTO DE USUÁRIOS', path: '/admin/user-management' },
  ];

  const isActive = (path: string) => {
    return currentPath === path;
  };

  return (
    <div className="flex bg-[#C41E3A] px-5 py-3">
      {navItems.map((item) => (
        <button
          key={item.label}
          className={`mr-8 px-3 py-2 text-white text-xs font-semibold tracking-wide transition-colors ${
            isActive(item.path) 
              ? 'bg-gray-800 bg-opacity-20 rounded' 
              : 'hover:bg-red-400 hover:bg-opacity-10 rounded'
          }`}
          onClick={() => router.push(item.path)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}