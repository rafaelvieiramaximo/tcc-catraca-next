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
            <h1 className="text-xl font-bold">FATEC SISTEMA DE CONTROLE DE ACESSO</h1>
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
            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg font-semibold transition-colors shadow-md flex items-center justify-center"
            title="Sair do sistema"
          >
            {/* Ícone SVG de logout como fallback */}
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                d="M9 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H9" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M16 17L21 12L16 7" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
              <path 
                d="M21 12H9" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}