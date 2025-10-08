// components/Menu/index.tsx
'use client';

import { useRouter } from 'next/navigation';
import { UsuarioCompleto } from '../../services/database-service';
import Header from '../Header';
import LogIcon from '../Icons/LogIcon';
import UserIcon from '../Icons/UserIcon';
import DoorIcon from '../Icons/DoorIcon'; // Adicione este ícone

interface MenuProps {
  user?: UsuarioCompleto | null;
  onLogout?: () => void;
}

export default function Menu({ user, onLogout }: MenuProps) {
  const router = useRouter();
  
  if (!user) {
    console.error("Menu component received undefined user");
    return (
      <div className="flex-1 bg-gray-100 flex flex-col items-center justify-center min-h-screen">
        <div className="text-red-500 text-lg mb-4">Erro: Usuário não encontrado</div>
        <button 
          onClick={() => router.push('/')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          Voltar ao Login
        </button>
      </div>
    );
  }

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      const confirmLogout = window.confirm("Deseja realmente sair do sistema?");
      if (confirmLogout && onLogout) {
        onLogout();
      }
    }
  };

  const getUserTypeTitle = () => {
    switch (user.tipo) {
      case "ADMIN":
        return "ADMINISTRADOR - SISTEMA";
      case "PORTARIA":
        return "PORTARIA - CONTROLE";
      default:
        return "SISTEMA DE ACESSO";
    }
  };

  return (
    <div className="flex-1 bg-[#F5F5F5] min-h-screen">
      <Header onLogout={handleLogout} pageName="Home" user={user} />

      {/* Main Content */}
      <div className="flex-1 p-5">
        {/* Title Section */}
        <div className="flex justify-center mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2C5F69] text-center tracking-wider">
            {getUserTypeTitle()}
          </h1>
        </div>

        {/* Cards Container */}
        <div className="flex flex-col md:flex-row flex-wrap justify-between gap-5">
          {/* Logs de Entradas Card - CORRIGIDO */}
          <div 
            className="bg-white rounded-xl p-5 w-full md:w-[calc(33.333%-20px)] min-h-[280px] flex flex-col shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => router.push('/entry-logs')}
          >
            {/* Card Header */}
            <div className="flex justify-center mb-5 py-3 bg-[#E8F4F8] rounded-lg border-l-4 border-l-[#4A90A4]">
              <h2 className="text-base font-bold text-[#2C5F69] text-center tracking-wide">
                LOGS DE ENTRADAS
              </h2>
            </div>

            {/* Card Content */}
            <div className="flex flex-col items-center mb-5 flex-1">
              <div className="bg-[#F8F9FA] rounded-full p-5 mb-4 w-20 h-20 flex items-center justify-center border-2 border-[#E9ECEF]">
                <DoorIcon /> {/* Ícone de porta para entradas */}
              </div>
              <p className="text-sm text-[#6C757D] text-center leading-5 px-2">
                Visualize todos os registros de entrada e saída do sistema
              </p>
            </div>

            {/* Card Footer */}
            <div className="mt-auto">
              <button 
                className="w-full bg-[#5CB3CC] rounded-lg py-3 text-center mb-4 shadow-lg hover:bg-[#4A90A4] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/entry-logs');
                }}
              >
                <span className="text-white text-base font-bold tracking-wide">
                  Acessar
                </span>
              </button>
            </div>
          </div>

          {/* Logs de Ações Card */}
          <div 
            className="bg-white rounded-xl p-5 w-full md:w-[calc(33.333%-20px)] min-h-[280px] flex flex-col shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
            onClick={() => router.push('/admin/action-logs')}
          >
            {/* Card Header */}
            <div className="flex justify-center mb-5 py-3 bg-[#E8F4F8] rounded-lg border-l-4 border-l-[#4A90A4]">
              <h2 className="text-base font-bold text-[#2C5F69] text-center tracking-wide">
                LOGS DE AÇÕES
              </h2>
            </div>

            {/* Card Content */}
            <div className="flex flex-col items-center mb-5 flex-1">
              <div className="bg-[#F8F9FA] rounded-full p-5 mb-4 w-20 h-20 flex items-center justify-center border-2 border-[#E9ECEF]">
                <LogIcon />
              </div>
              <p className="text-sm text-[#6C757D] text-center leading-5 px-2">
                Monitore todas as ações realizadas no sistema
              </p>
            </div>

            {/* Card Footer */}
            <div className="mt-auto">
              <button 
                className="w-full bg-[#5CB3CC] rounded-lg py-3 text-center mb-4 shadow-lg hover:bg-[#4A90A4] transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  router.push('/admin/action-logs');
                }}
              >
                <span className="text-white text-base font-bold tracking-wide">
                  Acessar
                </span>
              </button>
            </div>
          </div>

          {/* Gerenciamento de Usuários Card (apenas para ADMIN) */}
          {user.tipo === "ADMIN" && (
            <div 
              className="bg-white rounded-xl p-5 w-full md:w-[calc(33.333%-20px)] min-h-[280px] flex flex-col shadow-lg cursor-pointer hover:shadow-xl transition-shadow"
              onClick={() => router.push('/admin/user-management')}
            >
              {/* Card Header */}
              <div className="flex justify-center mb-5 py-3 bg-[#E8F4F8] rounded-lg border-l-4 border-l-[#4A90A4]">
                <h2 className="text-base font-bold text-[#2C5F69] text-center tracking-wide">
                  GERENCIAMENTO DE USUÁRIOS
                </h2>
              </div>

              {/* Card Content */}
              <div className="flex flex-col items-center mb-5 flex-1">
                <div className="bg-[#F8F9FA] rounded-full p-5 mb-4 w-20 h-20 flex items-center justify-center border-2 border-[#E9ECEF]">
                  <UserIcon />
                </div>
                <p className="text-sm text-[#6C757D] text-center leading-5 px-2">
                  Gerencie usuários, permissões e configurações do sistema
                </p>
              </div>

              {/* Card Footer */}
              <div className="mt-auto">
                <button 
                  className="w-full bg-[#5CB3CC] rounded-lg py-3 text-center mb-4 shadow-lg hover:bg-[#4A90A4] transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/admin/user-management');
                  }}
                >
                  <span className="text-white text-base font-bold tracking-wide">
                    Acessar
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}