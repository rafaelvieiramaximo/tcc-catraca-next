// components/ActionLogs/index.tsx
'use client';

import React, { useState, useEffect } from "react";
import { LogAction, UsuarioCompleto } from "../../services/database-service";
import { databaseService } from "../../services/database-service";
import Header from "../Header";
import MenuNavigation from "../MenuNavigation";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ActionLogsProps {
  onLogout?: () => void;
  user: UsuarioCompleto | null;
  currentUser: UsuarioCompleto | null;
}

interface FiltrosState {
  searchTerm: string;
  filterType: "todos" | "data-especifica" | "range-datas" | "periodo-rapido";
  dataEspecifica: string;
  dataInicio: string;
  dataFim: string;
  periodoRapido: "semana" | "quinzena" | "mes" | "";
  acao?: string;
  usuario_id?: number;
}

export default function ActionLogs({ onLogout, user, currentUser }: ActionLogsProps) {
  const [logs, setLogs] = useState<LogAction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [filtros, setFiltros] = useState<FiltrosState>({
    searchTerm: "",
    filterType: "todos", // Mudei para "todos" como padrão
    dataEspecifica: "",
    dataInicio: "",
    dataFim: "",
    periodoRapido: "",
    acao: "",
  });
  const [limit] = useState<number>(100);
  const [offset, setOffset] = useState<number>(0);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [generatingPDF, setGeneratingPDF] = useState<boolean>(false);

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

      // Para filtro "data-especifica" - usar backend
      if (filtros.filterType === "data-especifica" && filtros.dataEspecifica) {
        filtrosAPI.data_acao = filtros.dataEspecifica;
      }

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

  // Nova função para carregar todos os logs para filtros locais
  const loadAllLogs = async () => {
    setLoading(true);
    try {
      const logsData = await databaseService.getActionLogs(10000, 0, {});
      setLogs(logsData);
      setOffset(0);
    } catch (error) {
      alert("Não foi possível carregar os logs");
      console.error("Erro ao carregar logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = async () => {
    setOffset(0);

    // Se for filtro "todos" ou "data-especifica", usa o backend
    if (filtros.filterType === "todos" ||
      (filtros.filterType === "data-especifica" && filtros.dataEspecifica)) {
      await loadLogs(0);
    } else {
      // Para outros filtros, carrega tudo e filtra no frontend
      await loadAllLogs();
    }
    setShowFilters(false);
  };

  const resetFilters = () => {
    setFiltros({
      searchTerm: "",
      filterType: "todos", // Mudei para "todos"
      dataEspecifica: "",
      dataInicio: "",
      dataFim: "",
      periodoRapido: "",
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

  // Filtragem local avançada
  const filteredLogs = logs.filter((log) => {
    // Filtro de busca por nome/ID
    if (filtros.searchTerm && !(
      (log.nome_usuario || '').toLowerCase().includes(filtros.searchTerm.toLowerCase()) ||
      (log.acao || '').toLowerCase().includes(filtros.searchTerm.toLowerCase()) ||
      (log.status || '').toLowerCase().includes(filtros.searchTerm.toLowerCase()) ||
      (log.detalhes && log.detalhes.toLowerCase().includes(filtros.searchTerm.toLowerCase()))
    )) {
      return false;
    }

    // Filtro por data específica (quando carregado via loadAllLogs)
    if (filtros.filterType === "data-especifica" && filtros.dataEspecifica) {
      const logDate = new Date(log.data_hora);
      const logDateFormatted = logDate.toISOString().split('T')[0];

      if (logDateFormatted !== filtros.dataEspecifica) {
        return false;
      }
    }

    // Filtro por range de datas
    if (filtros.filterType === "range-datas" && filtros.dataInicio && filtros.dataFim) {
      const logDate = new Date(log.data_hora);
      const logDateFormatted = logDate.toISOString().split('T')[0];

      if (logDateFormatted < filtros.dataInicio || logDateFormatted > filtros.dataFim) {
        return false;
      }
    }

    // Filtro por período rápido
    if (filtros.filterType === "periodo-rapido" && filtros.periodoRapido) {
      const logDate = new Date(log.data_hora);
      const today = new Date();

      switch (filtros.periodoRapido) {
        case "semana":
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 6);
          if (logDate < weekAgo) return false;
          break;

        case "quinzena":
          const fortnightAgo = new Date(today);
          fortnightAgo.setDate(today.getDate() - 14);
          if (logDate < fortnightAgo) return false;
          break;

        case "mes":
          const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
          if (logDate < firstDayOfMonth) return false;
          break;
      }
    }

    // Filtro por ação (mantido do sistema existente)
    if (filtros.acao && log.acao !== filtros.acao) {
      return false;
    }

    return true;
  });

  const handleGeneratePDF = async () => {


    if (filteredLogs.length === 0) {
      alert("Não há dados para exportar");
      return;
    }

    setGeneratingPDF(true);
    try {
      const getImageDataUrl = async (url: string) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error('Erro ao carregar imagem');
        const blob = await res.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      };

      let logoDataUrl: string | null = null;
      try {
        logoDataUrl = await getImageDataUrl('/assets/images/logo_fatec.png');
      } catch (err) {
        console.warn('Não foi possível carregar logo para o PDF:', err);
        logoDataUrl = null;
      }

      const doc = new jsPDF();

      const headerHeight = 30;
      const startY = headerHeight + 5;

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', 14, 8, 28, 14);
      }

      // Adicionar título
      doc.setFontSize(16);
      doc.setTextColor(44, 95, 105);
      doc.text("Relatório de Logs de Ações - FATEC", 50, 16);

      // Informações de geração
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);

      let yPosition = startY;

      const now = new Date();
      doc.text(`Relatório gerado em: ${now.toLocaleString('pt-BR')}`, 14, yPosition);
      yPosition += 5;

      doc.text("Filtros aplicados:", 14, yPosition);
      yPosition += 5;

      if (filtros.searchTerm) {
        doc.text(`• Pesquisa: "${filtros.searchTerm}"`, 20, yPosition);
        yPosition += 4;
      }

      if (filtros.acao) {
        doc.text(`• Ação: ${filtros.acao}`, 20, yPosition);
        yPosition += 4;
      }

      // Novos filtros no PDF
      if (filtros.filterType === "todos") {
        doc.text(`• Filtro: Todos os logs`, 20, yPosition);
        yPosition += 4;
      }

      if (filtros.filterType === "data-especifica" && filtros.dataEspecifica) {
        doc.text(`• Data específica: ${new Date(filtros.dataEspecifica).toLocaleDateString('pt-BR')}`, 20, yPosition);
        yPosition += 4;
      }

      if (filtros.filterType === "range-datas" && filtros.dataInicio && filtros.dataFim) {
        doc.text(`• Range: ${new Date(filtros.dataInicio).toLocaleDateString('pt-BR')} à ${new Date(filtros.dataFim).toLocaleDateString('pt-BR')}`, 20, yPosition);
        yPosition += 4;
      }

      if (filtros.filterType === "periodo-rapido" && filtros.periodoRapido) {
        const periodoText = {
          semana: "Esta Semana",
          quinzena: "Esta Quinzena",
          mes: "Este Mês"
        }[filtros.periodoRapido];
        doc.text(`• Período rápido: ${periodoText}`, 20, yPosition);
        yPosition += 4;
      }

      if (filtros.usuario_id) {
        doc.text(`• ID do usuário: ${filtros.usuario_id}`, 20, yPosition);
        yPosition += 4;
      }

      doc.text(`• Total de registros: ${filteredLogs.length}`, 20, yPosition);
      yPosition += 8;

      // Preparar dados da tabela
      const tableData = filteredLogs.map((log, index) => [
        (index + 1).toString(),
        log.nome_usuario || 'N/A',
        formatDateTime(log.data_hora),
        log.acao || 'N/A',
        log.status || 'N/A',
        log.detalhes || 'N/A'
      ]);

      // Adicionar tabela
      autoTable(doc, {
        head: [['#', 'Usuário', 'Data/Hora', 'Ação', 'Status', 'Detalhes']],
        body: tableData,
        startY: yPosition + 5,
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [44, 95, 105],
          textColor: 255,
          fontStyle: 'bold'
        },
        alternateRowStyles: {
          fillColor: [240, 240, 240]
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 30 },
          2: { cellWidth: 35 },
          3: { cellWidth: 35 },
          4: { cellWidth: 20 },
          5: { cellWidth: 60 },
        },
        margin: { top: 10 },
        didDrawPage: function (data) {
          // Adicionar número da página
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(
            `Página ${data.pageNumber} de ${pageCount}`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
          );
        }
      });

      const pdfBlob = doc.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
      // revogar URL após um minuto para liberar memória
      setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);

    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Não foi possível gerar o PDF");
    } finally {
      setGeneratingPDF(false);
    }
  };

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
    return status === "SUCESSO" || status === "INICIADO" ? "text-green-600 font-semibold" : "text-red-600 font-semibold";
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

      {/* Content Area */}
      <div className="flex-1 flex flex-col p-6 max-w-7xl mx-auto w-full">
        {/* Search and Filters */}
        <div className="mb-4">
          <div className="flex items-center bg-white rounded-lg shadow-sm px-4 py-2">
            <button
              className="p-2 text-[#4A90A4] font-medium mr-2 cursor-pointer hover:bg-gray-100 rounded"
              onClick={() => setShowFilters(!showFilters)}
            >
              ☰ Filtros Avançados
            </button>

            <input
              type="text"
              className="flex-1 mx-2 p-2 text-gray-700 focus:outline-none border border-gray-300 rounded"
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
            </button>
          </div>

          {showFilters && (
            <div className="bg-white rounded-lg shadow-sm p-4 mt-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Tipo de Filtro
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { value: "todos", label: "Todos" },
                      { value: "data-especifica", label: "Data Específica" },
                      { value: "range-datas", label: "Período de Datas" },
                      { value: "periodo-rapido", label: "Período Rápido" }
                    ].map((type) => (
                      <button
                        key={type.value}
                        className={`px-3 py-2 rounded text-sm font-medium border ${filtros.filterType === type.value
                          ? "bg-[#4A90A4] text-gray-100 border-[#3A7A8C]"
                          : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                          }`}
                        onClick={() => setFiltros(prev => ({
                          ...prev,
                          filterType: type.value as any
                        }))}
                      >
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data Específica */}
                {filtros.filterType === "data-especifica" && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Data Específica
                    </label>
                    <input
                      type="date"
                      value={filtros.dataEspecifica}
                      onChange={(e) => setFiltros(prev => ({ ...prev, dataEspecifica: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-700"
                    />
                  </div>
                )}

                {filtros.filterType === "range-datas" && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Período de Datas
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">De:</label>
                        <input
                          type="date"
                          value={filtros.dataInicio}
                          onChange={(e) => setFiltros(prev => ({ ...prev, dataInicio: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Até:</label>
                        <input
                          type="date"
                          value={filtros.dataFim}
                          onChange={(e) => setFiltros(prev => ({ ...prev, dataFim: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-700"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Período Rápido */}
                {filtros.filterType === "periodo-rapido" && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Período Rápido
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {[
                        { value: "semana", label: "Esta Semana" },
                        { value: "quinzena", label: "Esta Quinzena" },
                        { value: "mes", label: "Este Mês" }
                      ].map((periodo) => (
                        <button
                          key={periodo.value}
                          className={`px-3 py-2 rounded text-sm font-medium border ${filtros.periodoRapido === periodo.value
                            ? "bg-[#4A90A4] text-white border-[#3A7A8C]"
                            : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200"
                            }`}
                          onClick={() => setFiltros(prev => ({
                            ...prev,
                            periodoRapido: periodo.value as any
                          }))}
                        >
                          {periodo.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtro por Ação (mantido do sistema existente) */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ação
                  </label>
                  <select
                    value={filtros.acao || ""}
                    onChange={(e) =>
                      setFiltros((prev) => ({ ...prev, acao: e.target.value }))
                    }
                    className="w-full p-2 border border-gray-300 rounded-md text-gray-700"
                  >
                    {acoesOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
                  onClick={resetFilters}
                >
                  Limpar Tudo
                </button>
                <button
                  className="bg-[#4A90A4] hover:bg-[#3A7A8C] text-white px-4 py-2 rounded text-sm font-semibold transition-colors"
                  onClick={applyFilters}
                >
                  Aplicar Filtros
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Info and PDF Button */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-gray-600 text-sm">
            {filteredLogs.length} log{filteredLogs.length !== 1 ? "s" : ""} encontrado{filteredLogs.length !== 1 ? "s" : ""}
          </span>

          <button
            className={`flex items-center px-4 py-2 rounded text-sm font-medium ${generatingPDF || filteredLogs.length === 0
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-green-800 hover:bg-green-700"
              } text-white transition-colors`}
            onClick={handleGeneratePDF}
            disabled={generatingPDF || filteredLogs.length === 0}
          >
            {generatingPDF ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Gerando PDF...
              </>
            ) : (
              <>
                📄 Exportar PDF
              </>
            )}
          </button>
        </div>

        {/* Logs List */}
        {loading && offset === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[200px]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4A90A4]"></div>
            <span className="mt-4 text-gray-600">Carregando logs...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="bg-gray-50 rounded-xl p-3 shadow-sm flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto">
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

                    {loading && offset > 0 && (
                      <div className="flex justify-center items-center p-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#4A90A4] mr-2"></div>
                        <span className="text-gray-600 text-sm">Carregando mais...</span>
                      </div>
                    )}

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