// components/RegisterEntry/page.tsx
'use client';

import Link from 'next/link';
import { UsuarioCompleto } from '../../services/database-service';

interface RegisterEntryProps {
  user: UsuarioCompleto | null;
  onLogout: () => void;
}

export default function RegisterEntry({ user, onLogout }: RegisterEntryProps) {
  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-green-600 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Sistema Portaria - Portaria</h1>
          <div className="flex items-center space-x-4">
            <Link 
              href="/entry-logs"
              className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded"
            >
              Ver Logs
            </Link>
            <span>Olá, {user?.nome}</span>
            <button
              onClick={onLogout}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded"
            >
              Sair
            </button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto p-6">
        {/* Aqui vai o conteúdo principal do RegisterEntry */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold mb-4">Registro de Entrada/Saída</h2>
          {/* Componente de catraca virtual, etc */}
        </div>
      </div>
    </div>
  );
}