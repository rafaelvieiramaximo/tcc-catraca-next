// app/components/EntryLogs/index.tsx
'use client';

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogEntrada, UsuarioCompleto } from "../../services/database-service";
import { databaseService } from "../../services/database-service";
import Header from "../Header";
import MenuNavigation from "../MenuNavigation";
import NavBarRegister from "../RegisterEntry/Navbar/index";

interface EntryLogsProps {
  user: UsuarioCompleto | null;
  onLogout?: () => void;
}

interface FiltrosState {
  searchTerm: string;
  filterType: "data" | "periodo" | "dia";
  hoje: boolean;
  periodo: string;
  tipo: string;
  usuario_id?: number;
}

export default function EntryLogs({ user, onLogout }: EntryLogsProps) {
  const [logs, setLogs] = useState<LogEntrada[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filtros, setFiltros] = useState<FiltrosState>({
    searchTerm: "",
    filterType: "data",
    hoje: false,
    periodo: "",
    tipo: "",
  });
  const [limit] = useState<number>(100);
  const [offset, setOffset] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [generatingPDF, setGeneratingPDF] = useState<boolean>(false);

  const router = useRouter();

  useEffect(() => {
    loadLogs();
  }, []);

  const loadLogs = async (newOffset: number = 0) => {
    setLoading(true);
    try {
      const filtrosAPI = {
        hoje: filtros.hoje,
        periodo: filtros.periodo || undefined,
        tipo: filtros.tipo || undefined,
        usuario_id: filtros.usuario_id || undefined,
      };

      const logsData = await databaseService.getLogsEntrada(
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
      filterType: "data",
      hoje: false,
      periodo: "",
      tipo: "",
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

  const handleGeneratePDF = async () => {
    if (filteredLogs.length === 0) {
      alert("Não há dados para exportar");
      return;
    }

    setGeneratingPDF(true);
    try {
      // TODO: Implementar geração de PDF
      console.log("Gerando PDF para", filteredLogs.length, "logs");
      // Lógica de PDF seria implementada aqui
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Não foi possível gerar o PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!filtros.searchTerm) return true;
    return (
      log.nome.toLowerCase().includes(filtros.searchTerm.toLowerCase()) ||
      log.usuario_id.toString().includes(filtros.searchTerm)
    );
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR");
  };

  const formatTime = (timeString: string) => {
    return timeString.substring(0, 5);
  };

  const controle = (item: LogEntrada) => {
    return item.controle ? "Saída" : "Entrada";
  };

  const getControleStyle = (item: LogEntrada) => {
    return item.controle ? "text-red-600 font-semibold" : "text-green-600 font-semibold";
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F5F5F5] w-full">
      {/* Header Baseado no Tipo de Usuário */}
      {user && user.tipo === "ADMIN" ? (
        <Header onLogout={handleLogout} pageName="Logs de Entrada" user={user} />
      ) : (
        <NavBarRegister onLogout={handleLogout} user={user} />
      )}

      {/* Menu Navigation apenas para ADMIN */}
      {user && user.tipo === "ADMIN" && (
        <MenuNavigation currentPath="/entry-logs" />
      )}

      {/* Content Area - CORRIGIDO: Adicionado flex-col */}
      <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Search and Filters Section */}
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
              placeholder="Pesquisar por nome ou ID"
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

          {/* Filtros Expandíveis */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow-sm p-4 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Tipo de Filtro
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {["data", "periodo", "dia"].map((type) => (
                      <button
                        key={type}
                        className={`px-3 py-2 rounded-full text-sm font-medium border ${
                          filtros.filterType === type
                            ? "bg-[#4A90A4] text-white border-[#3A7A8C]"
                            : "bg-gray-100 text-gray-700 border-gray-300"
                        }`}
                        onClick={() => setFiltros(prev => ({ ...prev, filterType: type as any }))}
                      >
                        {type === "data" ? "Data" : type === "periodo" ? "Período" : "Dia"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Opções
                  </label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={filtros.hoje}
                        onChange={(e) => setFiltros(prev => ({ ...prev, hoje: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Hoje</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-semibold"
                  onClick={resetFilters}
                >
                  Limpar
                </button>
                <button
                  className="bg-[#4A90A4] hover:bg-[#3A7A8C] text-white px-4 py-2 rounded text-sm font-semibold"
                  onClick={applyFilters}
                >
                  Aplicar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Info and PDF Button */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600 text-sm">
            {filteredLogs.length} registro{filteredLogs.length !== 1 ? "s" : ""} encontrado{filteredLogs.length !== 1 ? "s" : ""}
          </span>

          <button
            className={`flex items-center px-3 py-2 rounded text-sm font-medium ${
              generatingPDF || filteredLogs.length === 0
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700"
            } text-white`}
            onClick={handleGeneratePDF}
            disabled={generatingPDF || filteredLogs.length === 0}
          >
            {generatingPDF ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Gerando...
              </>
            ) : (
              "Gerar PDF"
            )}
          </button>
        </div>

        {/* Logs List - CORRIGIDO: Estrutura de scroll igual ao ActionLogs */}
        {loading && offset === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A90A4]"></div>
            <span className="mt-4 text-gray-600">Carregando logs...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0"> {/* CORRIGIDO: Container flexível */}
            <div className="bg-white rounded-lg shadow-sm flex-1 flex flex-col min-h-0"> {/* CORRIGIDO: Flex container */}
              <div className="flex-1 overflow-y-auto"> {/* CORRIGIDO: Scroll area */}
                {filteredLogs.length > 0 ? (
                  <div className="p-4">
                    {filteredLogs.map((item) => (
                      <div key={`${item.id}-${item.created_at}`} className="bg-white rounded-lg shadow-sm p-4 mb-3 border border-gray-200">
                        {/* Log Header */}
                        <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-3">
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className="text-sm font-semibold text-[#4A90A4]">
                              {item.identificador}
                            </span>
                            <span className="text-base font-semibold text-gray-800">
                              {item.nome}
                            </span>
                          </div>
                          <div>
                            <span className={`text-sm font-semibold ${getControleStyle(item)}`}>
                              {controle(item)}
                            </span>
                          </div>
                        </div>

                        {/* Log Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 font-medium">Tipo:</span>
                            <span className="text-sm text-gray-800">{item.tipo}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 font-medium">Data:</span>
                            <span className="text-sm text-gray-800">{formatDate(item.data_entrada)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 font-medium">Horário:</span>
                            <span className="text-sm text-gray-800">{formatTime(item.horario)}</span>
                          </div>

                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600 font-medium">Período:</span>
                            <span className="text-sm text-gray-800">{item.periodo}</span>
                          </div>
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
                      Tente ajustar os filtros ou verificar se existem registros para o período selecionado.
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