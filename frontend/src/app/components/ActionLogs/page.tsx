// components/ActionLogs/index.tsx
'use client';

import React, { useState, useEffect } from "react";
import { LogAction, UsuarioCompleto } from "../../services/database-service";
import { databaseService } from "../../services/database-service";
import Header from "../Header";
import MenuNavigation from "../MenuNavigation";

interface ActionLogsProps {
  onLogout?: () => void;
  user: UsuarioCompleto | null;
}

interface FiltrosState {
  searchTerm: string;
  dataInicio?: string;
  dataFim?: string;
  acao?: string;
  usuario_id?: number;
}

export default function ActionLogs({ onLogout, user }: ActionLogsProps) {
  const [logs, setLogs] = useState<LogAction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filtros, setFiltros] = useState<FiltrosState>({
    searchTerm: "",
  });
  const [limit, setLimit] = useState<number>(100);
  const [offset, setOffset] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  // Opções para o select de ações
  const acoesOptions = [
    { label: "Selecione uma ação", value: "" },
    { label: "CRIAR_USUARIO", value: "CRIAR_USUARIO" },
    { label: "ATUALIZAR_USUARIO", value: "ATUALIZAR_USUARIO" },
    { label: "EXCLUIR_USUARIO", value: "EXCLUIR_USUARIO" },
  ];

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async (newOffset: number = 0) => {
    setLoading(true);
    try {
      // Preparar filtros para a API
      const filtrosAPI: any = {};

      if (filtros.dataInicio) filtrosAPI.data_acao = filtros.dataInicio;
      if (filtros.acao) filtrosAPI.acao = filtros.acao;
      if (filtros.usuario_id) filtrosAPI.usuario_id = filtros.usuario_id;

      const logsData = await databaseService.getActionLogs(
        limit,
        newOffset,
        filtrosAPI
      );

      if (newOffset === 0) {
        setLogs(logsData);
      } else {
        setLogs((prev) => [...prev, ...logsData]);
      }

      setOffset(newOffset);
    } catch (error) {
      alert("Não foi possível carregar os logs");
      console.error("Erro ao carregar logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    setOffset(0);
    await loadLogs(0);
    setShowFilters(false);
  };

  const resetFilters = () => {
    setFiltros({
      searchTerm: "",
      dataInicio: "",
      dataFim: "",
      acao: "",
      usuario_id: undefined,
    });
    setOffset(0);
    loadLogs(0);
    setShowFilters(false);
  };

  const loadMore = () => {
    if (!loading) {
      loadLogs(offset + limit);
    }
  };

  // Filtro local para busca em tempo real
  const filteredLogs = logs.filter((log) => {
    if (!filtros.searchTerm) return true;

    const searchTerm = filtros.searchTerm.toLowerCase();
    return (
      log.nome_usuario.toLowerCase().includes(searchTerm) ||
      log.acao.toLowerCase().includes(searchTerm) ||
      log.status.toLowerCase().includes(searchTerm) ||
      (log.detalhes && log.detalhes.toLowerCase().includes(searchTerm))
    );
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString("pt-BR") +
      " " +
      date.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  };

  const getStatusColor = (status: string) => {
    return status === "SUCESSO" ? "text-green-600 font-semibold" : "text-red-600 font-semibold";
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5] w-full">
      {/* Header */}
      <Header onLogout={handleLogout} pageName="Logs de Ações" user={user} />

      <MenuNavigation currentPath="/admin/action-logs" />

      {/* Content Area - CORRIGIDO: Adicionado flex-col e flex-1 */}
      <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Search and Filters */}
        <div className="mb-4">
          <div className="flex items-center bg-white rounded-lg shadow-sm px-4 py-2">
            <button
              className="p-2 text-[#4A90A4] font-medium mr-2"
              onClick={() => setShowFilters(!showFilters)}
            >
              ☰ Filtros
            </button>

            <input
              type="text"
              className="flex-1 mx-2 p-2 text-gray-700 focus:outline-none"
              placeholder="Pesquisar por usuário, ação ou detalhes..."
              value={filtros.searchTerm}
              onChange={(e) =>
                setFiltros((prev) => ({ ...prev, searchTerm: e.target.value }))
              }
            />

            <button
              className="p-2 text-gray-600 text-xl"
              onClick={applyFilters}
            >
              🔍
            </button>
          </div>

          {/* Filtros expandíveis */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow-sm p-4 mt-3">
              <h3 className="text-gray-800 text-base font-semibold mb-3">Filtros Avançados:</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data Início:
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-100 rounded p-2 text-sm text-gray-700 h-10"
                    placeholder="YYYY-MM-DD"
                    value={filtros.dataInicio || ""}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, dataInicio: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Data Fim:
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-100 rounded p-2 text-sm text-gray-700 h-10"
                    placeholder="YYYY-MM-DD"
                    value={filtros.dataFim || ""}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, dataFim: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ação:
                  </label>
                  <select
                    value={filtros.acao || ""}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, acao: e.target.value }))
                    }
                    className="w-full bg-gray-100 rounded p-2 text-sm text-gray-700 h-10 border-none"
                  >
                    {acoesOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Limite:
                  </label>
                  <input
                    type="number"
                    className="w-full bg-gray-100 rounded p-2 text-sm text-gray-700 h-10"
                    value={limit}
                    onChange={(e) => setLimit(parseInt(e.target.value) || 100)}
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-semibold"
                  onClick={resetFilters}
                >
                  Limpar Filtros
                </button>
                <button
                  className="bg-[#4A90A4] hover:bg-[#3A7A8C] text-white px-4 py-2 rounded text-sm font-semibold"
                  onClick={applyFilters}
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Info */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600 text-sm">
            {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""} encontrado{filteredLogs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Logs List - CORRIGIDO: Estrutura de scroll */}
        {loading && offset === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A90A4]"></div>
            <span className="mt-4 text-gray-600">Carregando logs...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0"> {/* CORRIGIDO: Container flexível */}
            <div className="bg-gray-50 rounded-xl p-3 shadow-sm flex-1 flex flex-col min-h-0"> {/* CORRIGIDO: Flex container */}
              <div className="flex-1 overflow-y-auto"> {/* CORRIGIDO: Scroll area */}
                {filteredLogs.length > 0 ? (
                  <div className="space-y-3">
                    {filteredLogs.map((item) => (
                      <div key={`${item.id_log}-${item.data_hora}`} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                        {/* Log Header */}
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-3">
                          <div className="flex items-center">
                            <span className="text-gray-800 font-semibold text-base">
                              {item.nome_usuario}
                            </span>
                          </div>
                          <div>
                            <span className={`text-sm font-semibold ${getStatusColor(item.status)}`}>
                              {item.status}
                            </span>
                          </div>
                        </div>

                        {/* Log Details */}
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 font-medium">Data/Hora:</span>
                            <span className="text-sm text-gray-800 flex-1 ml-2 text-right">
                              {formatDateTime(item.data_hora)}
                            </span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 font-medium">Ação:</span>
                            <span className="text-sm text-gray-800 flex-1 ml-2 text-right">
                              {item.acao}
                            </span>
                          </div>

                          {item.detalhes && (
                            <div className="flex justify-between">
                              <span className="text-sm text-gray-600 font-medium">Detalhes:</span>
                              <span className="text-sm text-gray-800 flex-1 ml-2 text-right">
                                {item.detalhes}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* Load More */}
                    {loading && offset > 0 && (
                      <div className="flex justify-center items-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#4A90A4] mr-2"></div>
                        <span className="text-gray-600 text-sm">Carregando mais...</span>
                      </div>
                    )}

                    {/* Load More Button */}
                    {!loading && logs.length >= limit && (
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
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-gray-500 h-full">
                    <span className="text-4xl mb-4">📋</span>
                    <span className="text-lg font-semibold text-gray-600 mb-2 text-center">
                      Nenhum log encontrado
                    </span>
                    <span className="text-center text-gray-500">
                      {filtros.searchTerm || filtros.dataInicio || filtros.acao
                        ? "Tente ajustar os filtros ou verificar se existem registros para o período selecionado."
                        : "Nenhum log de ação registrado."}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}