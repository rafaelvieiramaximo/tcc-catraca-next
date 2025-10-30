// components/RegisterEntry/index.tsx (COM WEBSOCKET CORRIGIDO)
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { databaseService, UsuarioCompleto, LogEntrada, Usuario } from '../../services/database-service';
import { webSocketService, WebSocketMessage } from '../../services/websocket-service';
import { EntradaWebSocket, EstatisticasWebSocket } from '../../types/websocket-types';
import NavBarRegister from './Navbar';
import AddVisitorModal from './modalAddVisit';

interface RegisterProps {
    user: UsuarioCompleto | null;
    onLogout?: () => void;
}

interface DailyStats {
    total: number;
    entradas: number;
    saidas: number;
}

export default function RegisterEntry({ user, onLogout }: RegisterProps) {
    const [latestEntry, setLatestEntry] = useState<LogEntrada | null>(null);
    const [imgUser, setImgUser] = useState<UsuarioCompleto | null>(null);
    const [recentEntries, setRecentEntries] = useState<LogEntrada[]>([]);
    const [dailyStats, setDailyStats] = useState<DailyStats>({ total: 0, entradas: 0, saidas: 0 });
    const [loading, setLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const [hoveredHistoryItem, setHoveredHistoryItem] = useState<number | null>(null);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    const [showAddVisitorModal, setShowAddVisitorModal] = useState(false);
    const [webSocketStatus, setWebSocketStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
    const [connectionAttempts, setConnectionAttempts] = useState(0);

    // Estados WebSocket
    const [webSocketError, setWebSocketError] = useState<string | null>(null);
    const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

    const router = useRouter();

    // Carregar dados iniciais via REST (apenas uma vez)
    const loadInitialData = useCallback(async () => {
        try {
            setLoading(true);
            console.log('📊 Carregando dados iniciais...');

            const [logs, allTodayLogs] = await Promise.all([
                databaseService.getLogsEntrada(10, 0, { hoje: true }),
                databaseService.getLogsEntrada(1000, 0, { hoje: true })
            ]);

            console.log('📋 Logs carregados:', logs?.length);
            console.log('📈 Todos os logs de hoje:', allTodayLogs?.length);

            if (logs && logs.length > 0) {
                const sortedLogs = [...logs].sort((a, b) => {
                    const dateA = new Date(`${a.data_entrada}T${a.horario}`);
                    const dateB = new Date(`${b.data_entrada}T${b.horario}`);
                    return dateB.getTime() - dateA.getTime();
                });

                const latestFour = sortedLogs.slice(0, 4);
                setRecentEntries(latestFour);

                const newEntry = sortedLogs[0];
                setLatestEntry(newEntry);

                // Buscar imagem do usuário
                try {
                    const userId = parseInt(newEntry.usuario_id);
                    if (!isNaN(userId)) {
                        console.log('🖼️ Buscando imagem do usuário ID:', userId);
                        const userData = await databaseService.getUserById(userId, true);
                        setImgUser(userData);
                    }
                } catch (error) {
                    console.error('❌ Erro ao carregar imagem do usuário:', error);
                }
            }

            if (allTodayLogs && allTodayLogs.length > 0) {
                const stats: DailyStats = {
                    total: allTodayLogs.length,
                    entradas: allTodayLogs.filter(log => !log.controle).length,
                    saidas: allTodayLogs.filter(log => log.controle).length
                };
                setDailyStats(stats);
                console.log('📊 Estatísticas calculadas:', stats);
            } else {
                console.log('ℹ️ Nenhum registro encontrado para hoje');
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados iniciais:', error);
            setWebSocketError('Erro ao carregar dados iniciais');
        } finally {
            setLoading(false);
        }
    }, []);

    const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
        console.log('🎯 Mensagem WebSocket recebida:', message.tipo, message.dados);

        switch (message.tipo) {
            case 'AUTH_SUCCESS':
                console.log('✅ Autenticação WebSocket bem-sucedida');
                setWebSocketStatus('connected');
                setWebSocketError(null);
                break;

            case 'AUTH_ERROR':
                console.error('❌ Erro de autenticação WebSocket:', message.dados);
                setWebSocketStatus('error');
                setWebSocketError('Falha na autenticação WebSocket');
                break;

            case 'ENTRADA':
            case 'SAIDA':
                console.log('🔄 Atualizando interface com dados em tempo real');
                const entradaData: EntradaWebSocket = message.dados;

                // ✅ CRIAR NOVA ENTRADA
                const novaEntrada: LogEntrada = {
                    id: entradaData.id,
                    usuario_id: entradaData.usuario_id,
                    identificador: entradaData.identificador,
                    nome: entradaData.nome,
                    tipo: entradaData.tipo,
                    periodo: entradaData.periodo,
                    data_entrada: entradaData.data_entrada,
                    horario: entradaData.horario,
                    controle: entradaData.controle,
                    created_at: entradaData.created_at
                };

                console.log('📝 Nova entrada processada:', novaEntrada);

                // ✅ ATUALIZAR ÚLTIMO REGISTRO IMEDIATAMENTE
                setLatestEntry(novaEntrada);

                // ✅ ATUALIZAR LISTA DE RECENTES
                setRecentEntries(prev => {
                    const newEntries = [novaEntrada, ...prev.filter(entry => entry.id !== novaEntrada.id)];
                    return newEntries.slice(0, 4); // Manter apenas os 4 mais recentes
                });

                // ✅ BUSCAR IMAGEM DO USUÁRIO (se for entrada)
                if (!novaEntrada.controle) {
                    const userId = parseInt(novaEntrada.usuario_id);
                    if (!isNaN(userId)) {
                        console.log('🖼️ Buscando imagem para usuário ID:', userId);
                        databaseService.getUserById(userId, true)
                            .then(userData => {
                                setImgUser(userData);
                                console.log('✅ Imagem carregada com sucesso');
                            })
                            .catch(error => {
                                console.error('❌ Erro ao carregar imagem:', error);
                            });
                    }
                }

                // ✅ ANIMAÇÃO DE SUCESSO
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
                break;

            case 'ESTATISTICAS':
                console.log('📈 Atualizando estatísticas em tempo real:', message.dados);
                const estatisticas: EstatisticasWebSocket = message.dados;
                setDailyStats({
                    total: estatisticas.total,
                    entradas: estatisticas.entradas,
                    saidas: estatisticas.saidas
                });
                break;

            case 'HEARTBEAT':
                console.log('❤️ WebSocket heartbeat - Conexão ativa');
                break;

            case 'ERRO':
                console.error('❌ Erro do WebSocket:', message.dados);
                setWebSocketError(`Erro: ${message.dados.mensagem}`);
                setWebSocketStatus('error');
                break;

            default:
                console.warn('⚠️ Tipo de mensagem não reconhecido:', message.tipo);
        }
    }, []);

    // ✅ MELHORAR O HANDLER DE ERROS
    const handleWebSocketError = useCallback((error: string) => {
        console.error('❌ Erro WebSocket:', error);
        setWebSocketError(error);
        setWebSocketStatus('error');
        setIsWebSocketConnected(false);
    }, []);

    // ✅ MELHORAR O EFFECT DO WEBSOCKET
    useEffect(() => {
        let mounted = true;
        let reconnectTimeout: NodeJS.Timeout;

        const initializeWebSocket = async () => {
            if (!mounted) return;

            console.log('🚀 Inicializando WebSocket...');
            setWebSocketStatus('connecting');

            try {
                // ✅ CARREGAR DADOS INICIAIS PRIMEIRO
                await loadInitialData();

                if (mounted) {
                    // ✅ CONECTAR WEBSOCKET
                    console.log('🔗 Conectando ao WebSocket...');
                    const connected = await webSocketService.connect();

                    if (connected && mounted) {
                        console.log('✅ WebSocket conectado, registrando handlers...');

                        // ✅ REGISTRAR HANDLERS
                        webSocketService.onMessage(handleWebSocketMessage);
                        webSocketService.onError(handleWebSocketError);

                        setWebSocketStatus('connected');
                        setIsWebSocketConnected(true);
                        setWebSocketError(null);
                    } else if (mounted) {
                        console.error('❌ Falha na conexão WebSocket');
                        setWebSocketStatus('error');
                        setWebSocketError('Não foi possível conectar ao servidor em tempo real');

                        // ✅ TENTAR RECONECTAR APÓS 5 SEGUNDOS
                        if (connectionAttempts < 3) {
                            reconnectTimeout = setTimeout(() => {
                                setConnectionAttempts(prev => prev + 1);
                                initializeWebSocket();
                            }, 5000);
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Erro na inicialização do WebSocket:', error);
                if (mounted) {
                    setWebSocketStatus('error');
                    setWebSocketError('Erro ao inicializar conexão em tempo real');
                }
            }
        };

        initializeWebSocket();

        return () => {
            console.log('🧹 Limpando WebSocket...');
            mounted = false;
            if (reconnectTimeout) clearTimeout(reconnectTimeout);
            webSocketService.disconnect();
        };
    }, [loadInitialData, handleWebSocketMessage, handleWebSocketError, connectionAttempts]);

    // Funções de formatação
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR');
    };

    const formatTime = (timeString: string) => {
        return timeString.substring(0, 5);
    };

    const getStatusText = (controle: boolean) => {
        return controle ? 'Saída registrada!' : 'Entrada registrada!';
    };

    const getStatusColor = (controle: boolean) => {
        return controle ? '#e74c3c' : '#27ae60';
    };

    const getStatusIcon = (controle: boolean) => {
        return controle ? '↩️' : '✅';
    };

    const getWebSocketStatusText = () => {
        switch (webSocketStatus) {
            case 'connected': return '🔴 LIVE';
            case 'connecting': return '🟡 Conectando...';
            case 'error': return '🔴 Offline';
            default: return '⚪ Desconectado';
        }
    };

    if (loading) {
        return (
            <div className="h-screen overflow-hidden flex flex-col bg-gray-50">
                <NavBarRegister onLogout={onLogout} user={user} />
                <div className="flex-1 flex flex-col">
                    <div className="flex flex-col items-center justify-center h-40vh text-gray-500">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                        <span className="text-sm font-medium">Carregando dados iniciais...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col bg-gray-50 relative">

            {webSocketError && (
                <div className="fixed top-2 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium z-50 max-w-md text-center">
                    ⚠️ {webSocketError}
                </div>
            )}

            <div className={showAddVisitorModal ? 'blur-sm transition-all duration-300' : ''}>
                <NavBarRegister onLogout={onLogout} user={user} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-gray-50 scroll-smooth">
                    {/* Admin Header */}
                    <div className="bg-gray-800 text-white p-3 rounded-lg mb-5 shadow-sm text-center">
                        <div className="mb-3">
                            <div className="text-3xl font-bold mb-1 tracking-wide">FATEC ITU</div>
                        </div>
                        <h1 className="text-xl font-normal opacity-90 m-0">
                            PORTARIA - SISTEMA {getWebSocketStatusText()}
                        </h1>
                    </div>

                    {/* Dashboard */}
                    <div className="flex flex-col lg:flex-row gap-5 items-start">
                        {/* Main Card */}
                        <div className="flex-2 min-w-80 bg-white p-5 rounded-lg shadow-sm border border-gray-200 transition-all duration-200">
                            <h2 className="text-gray-800 text-lg font-semibold mb-4 border-b border-gray-200 pb-2">
                                ÚLTIMO REGISTRO {webSocketStatus === 'connected' && '🎯'}
                                {webSocketStatus === 'connecting' && '⏳'}
                                {webSocketStatus === 'error' && '⚠️'}
                            </h2>

                            {!latestEntry ? (
                                <div className="text-center py-8 px-4 text-gray-500">
                                    <div className="text-4xl mb-3 opacity-50">📋</div>
                                    <h2 className="text-gray-700 text-lg font-semibold mb-2">Nenhum registro hoje</h2>
                                    <p className="text-sm opacity-80">Aguardando primeira entrada do dia...</p>
                                </div>
                            ) : (
                                <div className={`bg-white border border-gray-200 rounded p-4 mb-4 shadow-sm transition-all duration-200 ${showSuccess ? 'border-l-4 border-l-green-500 shadow-green-100' : ''
                                    }`}>
                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                                            {imgUser?.imagem_url ? (
                                                <img
                                                    className="w-24 h-24 rounded-full object-cover"
                                                    src={imgUser.imagem_url}
                                                    alt={`Foto de ${latestEntry.nome}`}
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        target.style.display = 'none';
                                                    }}
                                                />
                                            ) : (
                                                <div className="w-24 h-24 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                    {latestEntry.nome.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                </div>
                                            )}
                                        </div>

                                        {/* User Info */}
                                        <div className="flex-1 min-w-50">
                                            <div className="font-semibold text-gray-800 text-lg mb-2">
                                                {latestEntry.nome}
                                            </div>
                                            <div className="text-gray-600 text-sm mb-1">
                                                <strong>ID:</strong> {latestEntry.identificador}
                                            </div>
                                            <div className="text-gray-600 text-sm mb-1">
                                                <strong>Tipo:</strong> {latestEntry.tipo}
                                            </div>
                                            <div className="text-gray-600 text-sm mb-1">
                                                <strong>Período:</strong> {latestEntry.periodo}
                                            </div>
                                            <div className="text-gray-600 text-sm">
                                                <strong>Data:</strong> {formatDate(latestEntry.data_entrada)} às {formatTime(latestEntry.horario)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Message */}
                                    <div
                                        className="p-3 rounded text-white flex items-center justify-center font-semibold text-center text-sm mt-3 h-10 w-60 mx-auto"
                                        style={{ backgroundColor: getStatusColor(latestEntry.controle) }}
                                    >
                                        {getStatusIcon(latestEntry.controle)} {getStatusText(latestEntry.controle)}
                                    </div>
                                </div>
                            )}

                            {/* Histórico dos últimos 4 registros */}
                            <div className="mt-5 pt-4 border-t border-gray-200">
                                <h3 className="text-gray-800 text-base font-semibold mb-3">
                                    ÚLTIMOS REGISTROS {isWebSocketConnected && '🔄'}
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {recentEntries.length > 0 ? (
                                        recentEntries.map((entry, index) => (
                                            <div
                                                key={`${entry.id}-${entry.horario}`}
                                                className={`flex items-center p-3 bg-gray-50 rounded border border-gray-200 transition-all duration-200 cursor-pointer ${hoveredHistoryItem === index ? 'bg-white border-blue-400 shadow-sm' : ''
                                                    }`}
                                                onMouseEnter={() => setHoveredHistoryItem(index)}
                                                onMouseLeave={() => setHoveredHistoryItem(null)}
                                            >
                                                <div className="text-lg mr-3 w-5 text-center">
                                                    {getStatusIcon(entry.controle)}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="font-semibold text-gray-800 text-sm mb-1">{entry.nome}</div>
                                                    <div className="text-gray-500 text-xs">
                                                        {formatTime(entry.horario)} - {entry.controle ? 'Saída' : 'Entrada'}
                                                    </div>
                                                </div>
                                                <div
                                                    className="w-2 h-2 rounded-full ml-3 flex-shrink-0"
                                                    style={{ backgroundColor: getStatusColor(entry.controle) }}
                                                ></div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="text-center py-5 text-gray-500 italic text-sm">
                                            <div className="text-2xl mb-2">📝</div>
                                            <p>Nenhum registro recente</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="flex-1 min-w-64 flex flex-col gap-4">
                            {/* Logs Card */}
                            <div
                                className="bg-white text-gray-800 p-5 rounded text-center shadow-sm border border-gray-200 transition-all duration-200"
                                onMouseEnter={() => setIsSidebarHovered(true)}
                                onMouseLeave={() => setIsSidebarHovered(false)}
                            >
                                <div className="text-3xl mb-3 opacity-80">📊</div>
                                <h3 className="text-gray-800 text-lg font-semibold mb-2">LOG DE ENTRADAS</h3>
                                <p className="text-gray-500 mb-4 leading-relaxed text-sm">
                                    Visualize todos os registros de entrada e saída
                                </p>
                                <button
                                    className={`w-60 bg-gray-800 border-none text-white py-2 px-4 rounded font-semibold cursor-pointer transition-all duration-200 text-sm ${isSidebarHovered ? 'bg-gray-700 transform -translate-y-0.5' : ''
                                        }`}
                                    onClick={() => router.push('/entry-logs')}
                                >
                                    Acessar Logs
                                </button>
                            </div>

                            {/* Stats Card */}
                            <div className="bg-white text-gray-800 p-5 rounded text-center shadow-sm border border-gray-200">
                                <div className="text-3xl mb-3 opacity-80">📈</div>
                                <h3 className="text-gray-800 text-lg font-semibold mb-2">
                                    ESTATÍSTICAS DO DIA {isWebSocketConnected && '📡'}
                                </h3>
                                <div className="grid grid-cols-3 gap-3 mt-3">
                                    <div className="flex flex-col items-center p-3 bg-gray-50 rounded border border-gray-200">
                                        <span className="text-gray-800 text-xl font-bold mb-1">{dailyStats.total}</span>
                                        <span className="text-gray-500 text-xs font-medium">Total</span>
                                    </div>
                                    <div className="flex flex-col items-center p-3 bg-gray-50 rounded border border-gray-200">
                                        <span className="text-gray-800 text-xl font-bold mb-1">{dailyStats.entradas}</span>
                                        <span className="text-gray-500 text-xs font-medium">Entradas</span>
                                    </div>
                                    <div className="flex flex-col items-center p-3 bg-gray-50 rounded border border-gray-200">
                                        <span className="text-gray-800 text-xl font-bold mb-1">{dailyStats.saidas}</span>
                                        <span className="text-gray-500 text-xs font-medium">Saídas</span>
                                    </div>
                                </div>
                            </div>

                            {/* Adicionar Visitante */}
                            <div className="bg-white text-gray-800 p-5 rounded text-center shadow-sm border border-gray-200">
                                <div className="text-3xl mb-3 opacity-80">👤</div>
                                <h3 className="text-gray-800 text-lg font-semibold mb-2">CADASTRAR VISITANTE</h3>
                                <p className="text-gray-500 mb-4 leading-relaxed text-sm">
                                    Cadastre visitantes temporários com foto e biometria
                                </p>
                                <button
                                    className="w-60 bg-purple-600 border-none text-white py-2 px-4 rounded font-semibold cursor-pointer transition-all duration-200 text-sm hover:bg-purple-700"
                                    onClick={() => setShowAddVisitorModal(true)}
                                >
                                    ➕ Adicionar Visitante
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Success Animation */}
            {showSuccess && (
                <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white p-4 rounded flex items-center gap-3 z-50 shadow-lg border border-green-600">
                    <div className="text-xl">🎉</div>
                    <span className="font-semibold text-sm">Novo registro em tempo real!</span>
                </div>
            )}

            {/* Modal de Visitante */}
            <AddVisitorModal
                visible={showAddVisitorModal}
                onClose={() => setShowAddVisitorModal(false)}
                onVisitorAdded={loadInitialData}
            />
        </div>
    );
}