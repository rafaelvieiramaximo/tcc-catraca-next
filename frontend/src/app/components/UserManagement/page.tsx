'use client';

import React, { useState, useEffect } from "react";
import { databaseService, UsuarioCompleto } from "../../services/database-service";
import Header from "../Header";
import MenuNavigation from "../MenuNavigation";
import AddUserModal from "./modalAddUser";

interface UserManagementProps {
  onLogout?: () => void;
  user: UsuarioCompleto | null;
}

export default function UserManagement({ onLogout, user }: UserManagementProps) {
  const [users, setUsers] = useState<UsuarioCompleto[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UsuarioCompleto[]>([]);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editUser, setEditUser] = useState<UsuarioCompleto | null>(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  // Estados para scroll infinito
  const [limit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(true);

  useEffect(() => {
    loadUsers(0, false);
  }, []);

  const loadUsers = async (newOffset: number = 0, append: boolean = false) => {
    try {
      setLoading(true);
      const allUsers = await databaseService.getAllUsers();

      // Simular paginação
      const startIndex = newOffset;
      const endIndex = startIndex + limit;
      const paginatedUsers = allUsers.slice(startIndex, endIndex);

      if (append) {
        setUsers(prev => [...prev, ...paginatedUsers]);
        setFilteredUsers(prev => [...prev, ...paginatedUsers]);
      } else {
        setUsers(paginatedUsers);
        setFilteredUsers(paginatedUsers);
      }

      setOffset(newOffset);
      setHasMore(endIndex < allUsers.length);

    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      alert("Não foi possível carregar a lista de usuários.");
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    if (!loading && hasMore) {
      loadUsers(offset + limit, true);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Chegou perto do final (50px do fim)
    if (scrollHeight - scrollTop <= clientHeight + 50) {
      loadMore();
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  const filterUsers = (text: string) => {
    setSearchText(text);

    if (!text.trim()) {
      setFilteredUsers(users);
      return;
    }

    const filtered = users.filter(
      (u) =>
        u.nome.toLowerCase().includes(text.toLowerCase()) ||
        u.identificador.toString().includes(text)
    );
    setFilteredUsers(filtered);
  };

  const handleAddUser = () => {
    setShowAddModal(true);
  };

  const handleEditUser = (userId: number) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setEditUser(user);
      setShowAddModal(true);
    }
  };

  const logUserDeletion = async (user: UsuarioCompleto, success: boolean) => {
    try {
      await databaseService.createActionLog({
        id_usuario: user.id,
        identificador: user.identificador,
        acao: 'EXCLUSAO_USUARIO',
        status: success ? 'SUCESSO' : 'ERRO',
        detalhes: `Usuário "${user.nome}" (tipo=${user.tipo}) ${success ? 'excluído com sucesso' : 'falha na exclusão'}`,
        nome_usuario: user.nome
      });
    } catch (error) {
      console.error('Erro ao registrar log de exclusão:', error);
    }
  };

  const handleUserAdded = async () => {
    await loadUsers(0, false); // Recarrega do início
  };

  const confirmDeleteUser = async (userId: number) => {
    try {
      await logUserDeletion(users.find(u => u.id === userId)!, true);
      await databaseService.deleteUser(userId);
      await loadUsers(0, false); // Recarrega do início
      setShowDeleteSuccess(true);
      setTimeout(() => setShowDeleteSuccess(false), 3000);
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);
      alert("Não foi possível excluir o usuário.");
    }
  };

  const handleDeleteUser = (userId: number, userName: string) => {
    const confirmed = window.confirm(
      `Deseja realmente excluir o usuário "${userName}"?`
    );

    if (confirmed) {
      confirmDeleteUser(userId);
    }
  };

  if (loading && offset === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onLogout={handleLogout} pageName="Gerenciador de Usuários" user={user} />
        {user?.tipo === 'ADMIN' && (
          <MenuNavigation currentPath="/usermanage" />
        )}
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A90A4]"></div>
          <div className="mt-3 text-base text-gray-600">Carregando usuários...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <div className={showAddModal ? 'blur-xs' : ''}>
        <Header onLogout={handleLogout} pageName="Gerenciador de Usuários" user={user} />
        {user?.tipo === 'ADMIN' && (
          <MenuNavigation currentPath="/usermanage" />
        )}

        <div className="flex-1 p-4 overflow-y-auto mx-4 my-2">
          {/* Search Bar */}
          <div className="flex items-center bg-white rounded-lg px-3 mb-4 shadow-sm border">
            <input
              type="text"
              className="flex-1 h-12 text-base text-gray-800 outline-none"
              placeholder="Pesquise por nome ou identificador"
              value={searchText}
              onChange={(e) => filterUsers(e.target.value)}
            />
            <button
              className="p-2"
              onClick={() => filterUsers(searchText)}
            >
              <span className="text-xl">🔍</span>
            </button>
          </div>

          <div className="bg-white rounded-lg p-4 mb-4 shadow-sm border">
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10">
                <div className="text-base text-gray-600 text-center">
                  {searchText
                    ? "Nenhum usuário encontrado"
                    : "Nenhum usuário cadastrado"}
                </div>
              </div>
            ) : (
              <div
                className="space-y-3 max-h-[60vh] "
                onScroll={handleScroll}
              >
                {filteredUsers.map((user) => (
                  <div key={user.id} className="bg-gray-50 rounded-lg p-4 mb-3 flex items-center justify-between border border-gray-200 shadow-sm">
                    <img
                      src={user.imagem_url ?? undefined}
                      alt={user.nome}
                      className="w-12 h-12 rounded-full mr-4 object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                    <div className="flex flex-1">
                      <div className="flex-1 pr-2">
                        <div className="text-xs font-semibold text-gray-600 mb-1">Identificador</div>
                        <div className="text-sm text-gray-800 font-medium">{user.identificador}</div>
                      </div>

                      <div className="flex-1 pr-2">
                        <div className="text-xs font-semibold text-gray-600 mb-1">Nome</div>
                        <div className="text-sm text-gray-800 font-medium">{user.nome}</div>
                      </div>

                      <div className="flex-1 pr-2">
                        <div className="text-xs font-semibold text-gray-600 mb-1">Tipo</div>
                        <div className="text-sm text-gray-800 font-medium">{user.tipo}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                        onClick={() => handleEditUser(user.id)}
                      >
                        <span className="text-base">✏️</span>
                      </button>

                      <button
                        className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors"
                        onClick={() => handleDeleteUser(user.id, user.nome)}
                      >
                        <span className="text-base">❌</span>
                      </button>
                    </div>
                  </div>
                ))}

                {/* Loading indicator para mais dados */}
                {loading && offset > 0 && (
                  <div className="flex justify-center items-center p-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#4A90A4] mr-2"></div>
                    <span className="text-gray-600 text-sm">Carregando mais usuários...</span>
                  </div>
                )}

                {/* Botão Carregar Mais */}
                {!loading && hasMore && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={loadMore}
                      className="bg-[#4A90A4] hover:bg-[#3A7A8C] text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      Carregar Mais
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            className="fixed bottom-5 right-5 bg-black rounded-full w-15 h-15 flex items-center justify-center shadow-lg hover:shadow-xl transition-shadow"
            onClick={handleAddUser}
          >
            <span className="text-2xl text-white font-bold">+</span>
          </button>
        </div>

        {showDeleteSuccess && (
          <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 bg-red-500 rounded-lg px-4 py-3 shadow-lg">
            <div className="text-white font-bold text-center text-sm">
              Usuário excluído com sucesso!
            </div>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      <AddUserModal
        visible={showAddModal}
        onClose={() => {
          setEditUser(null);
          setShowAddModal(false);
        }}
        onUserAdded={handleUserAdded}
        userToEdit={editUser}
      />
    </div>
  );
}