// components/Header/index.tsx
'use client';

import { UsuarioCompleto } from '../../services/database-service';

interface HeaderProps {
  onLogout: () => void;
  pageName: string;
  user?: UsuarioCompleto | null;
}

export default function Header({ onLogout, pageName, user }: HeaderProps) {
  const formatUserName = (name: string) => {
    return name.split(' ')[0]; // Retorna apenas o primeiro nome
  };

  return (
    <header className="bg-[#2C5F69] py-4 px-6 shadow-md">
      <div className="flex justify-between items-center">
        {/* Logo e Nome do Sistema */}
        <div className="flex items-center space-x-4">
          <div className="text-white">
            <h1 className="text-xl font-bold">FATEC PORTARIA</h1>
            <p className="text-sm opacity-90">{pageName}</p>
          </div>
        </div>

        {/* User Info and Logout */}
        <div className="flex items-center space-x-4">
          {user && (
            <div className="text-right text-white">
              <p className="font-semibold">{formatUserName(user.nome)}</p>
              <p className="text-sm opacity-90 capitalize">{user.tipo.toLowerCase()}</p>
            </div>
          )}
          
          <button
            onClick={onLogout}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-md"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}