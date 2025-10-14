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
    { label: 'LOGS DE ENTRADAS', path: '/entry-logs' },
    { label: 'LOGS DE AÇÕES', path: '/admin/action-logs' },
    { label: 'GERENCIAMENTO DE USUÁRIOS', path: '/usermanage' },
  ];

  const isActive = (path: string) => {
    return currentPath === path;
  };

  return (
    <div className="flex bg-[#e2e2e2ff] px-5 py-3">
      {navItems.map((item) => (
        <button
          key={item.label}
          className={`mr-8 px-3 py-2 text-black text-xs font-semibold tracking-wide transition-colors ${
            isActive(item.path) 
              ? 'bg-gray-300 bg-opacity-20 rounded' 
              : 'hover:bg-gray-400 hover:bg-opacity-10 rounded'
          }`}
          onClick={() => router.push(item.path)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}