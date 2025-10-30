// components/UserManagement/SystemUserModal.tsx
'use client';

import React, { useState } from "react";
import { databaseService } from "../../services/database-service";

interface SystemUserModalProps {
    visible: boolean;
    onClose: () => void;
    onUserAdded: () => void;
}

export default function SystemUserModal({
    visible,
    onClose,
    onUserAdded,
}: SystemUserModalProps) {
    const [formData, setFormData] = useState({
        tipo: 'PORTARIA' as 'ADMIN' | 'RH' | 'PORTARIA',
        nome: "",
        identificador: "",
        senha: "",
        confirmarSenha: ""
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!formData.nome.trim()) {
            alert("Por favor, preencha o nome do usuário.");
            return;
        }

        if (!formData.identificador.trim()) {
            alert("Por favor, preencha o identificador.");
            return;
        }

        if (!formData.senha.trim()) {
            alert("Por favor, preencha a senha.");
            return;
        }

        if (formData.senha !== formData.confirmarSenha) {
            alert("As senhas não coincidem.");
            return;
        }

        if (formData.senha.length < 6) {
            alert("A senha deve ter pelo menos 6 caracteres.");
            return;
        }

        try {
            setLoading(true);

            const result = await databaseService.createSystemUser({
                nome: formData.nome.trim(),
                tipo: formData.tipo,
                identificador: formData.identificador.trim(),
                senha: formData.senha.trim(),
            });

            if (result.success) {
                alert("Usuário do sistema criado com sucesso!");
                onUserAdded();
                onClose();
                
                // Reset form
                setFormData({
                    tipo: 'PORTARIA',
                    nome: "",
                    identificador: "",
                    senha: "",
                    confirmarSenha: ""
                });
            } else {
                alert(result.error || "Não foi possível criar o usuário do sistema.");
            }
        } catch (error: any) {
            console.error("Erro ao criar usuário do sistema:", error);
            alert(error.message || "Erro inesperado.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            tipo: 'PORTARIA',
            nome: "",
            identificador: "",
            senha: "",
            confirmarSenha: ""
        });
        onClose();
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-50">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 mx-4">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-white">
                    <div className="text-lg font-bold text-gray-800">
                        Cadastro de Usuário do Sistema
                    </div>
                    <button
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        onClick={handleClose}
                    >
                        <span className="text-xl font-bold">✕</span>
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-5">
                    {/* Tipo */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Tipo de Usuário</div>
                        <select
                            value={formData.tipo}
                            onChange={(e) => setFormData(prev => ({ ...prev, tipo: e.target.value as 'ADMIN' | 'RH' | 'PORTARIA' }))}
                            className="w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                        >
                            <option value="PORTARIA">Portaria</option>
                            <option value="RH">Recursos Humanos</option>
                            <option value="ADMIN">Administrador</option>
                        </select>
                    </div>

                    {/* Nome */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Nome</div>
                        <input
                            type="text"
                            className="w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                            value={formData.nome}
                            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Digite o nome completo"
                        />
                    </div>

                    {/* Identificador */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">
                            {formData.tipo === 'ADMIN' ? 'Usuário Admin' : 
                             formData.tipo === 'RH' ? 'Usuário RH' : 'Usuário Portaria'}
                        </div>
                        <input
                            type="text"
                            className="w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                            value={formData.identificador}
                            onChange={(e) => setFormData(prev => ({ ...prev, identificador: e.target.value }))}
                            placeholder="Digite o identificador"
                        />
                    </div>

                    {/* Senha */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Senha</div>
                        <input
                            type="password"
                            className="w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                            value={formData.senha}
                            onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                            placeholder="Digite a senha"
                        />
                    </div>

                    {/* Confirmar Senha */}
                    <div className="mb-6">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Confirmar Senha</div>
                        <input
                            type="password"
                            className="w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                            value={formData.confirmarSenha}
                            onChange={(e) => setFormData(prev => ({ ...prev, confirmarSenha: e.target.value }))}
                            placeholder="Confirme a senha"
                        />
                    </div>

                    {/* Botão Cadastrar */}
                    <button
                        className={`w-full rounded-full py-4 text-base font-bold text-white transition-colors flex items-center justify-center ${
                            loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#4A90A4] hover:bg-[#3a7a8a]"
                        }`}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                Cadastrando...
                            </>
                        ) : (
                            'Cadastrar Usuário do Sistema'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}