// app/components/UserManagement/page.tsx
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

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const allUsers = await databaseService.getAllUsers();
      setUsers(allUsers);
      setFilteredUsers(allUsers);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      alert("Não foi possível carregar a lista de usuários.");
    } finally {
      setLoading(false);
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

  const handleUserAdded = async () => {
    await loadUsers();
  };

  const confirmDeleteUser = async (userId: number) => {
    try {
      await databaseService.deleteUser(userId);
      await loadUsers();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onLogout={handleLogout} pageName="Gerenciador de Usuários" user={user} />
        <MenuNavigation currentPath="/admin/user-management" />
        <div className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A90A4]"></div>
          <div className="mt-3 text-base text-gray-600">Carregando usuários...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* Aplica blur apenas no conteúdo quando modal estiver aberto */}
      <div className={showAddModal ? 'blur-xs' : ''}>
        <Header onLogout={handleLogout} pageName="Gerenciador de Usuários" user={user} />
        <MenuNavigation currentPath="/admin/user-management" />

        <div className="flex-1 p-4">
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

          {/* Users List */}
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
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="bg-gray-50 rounded-lg p-4 mb-3 flex items-center justify-between border border-gray-200 shadow-sm">
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

      {/* Add User Modal - fora da div com blur */}
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