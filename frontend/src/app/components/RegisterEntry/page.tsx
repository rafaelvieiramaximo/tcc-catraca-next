// components/RegisterEntry/index.tsx (POLLING CORRIGIDO - SEM LOOP INFINITO)
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { databaseService, UsuarioCompleto, LogEntrada } from '../../services/database-service';
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
    const [showAddVisitorModal, setShowAddVisitorModal] = useState(false);
    const [hoveredHistoryItem, setHoveredHistoryItem] = useState<number | null>(null);

    // ✅ USAR useRef PARA EVITAR RE-RENDERS DESNECESSÁRIOS
    const lastChangeCountRef = useRef<number>(0);
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const router = useRouter();

    // ✅ FUNÇÃO PARA CARREGAR DADOS (SEM DEPENDÊNCIAS PROBLEMÁTICAS)
    const loadData = useCallback(async (showAnimation: boolean = false) => {
        try {
            console.log('📊 Carregando dados...');

            const entries = await databaseService.getRecentEntries(10);

            if (entries && entries.length > 0) {
                const sortedEntries = [...entries].sort((a, b) => {
                    const dateA = new Date(`${a.data_entrada}T${a.horario}`);
                    const dateB = new Date(`${b.data_entrada}T${b.horario}`);
                    return dateB.getTime() - dateA.getTime();
                });

                setRecentEntries(sortedEntries.slice(0, 4));
                setLatestEntry(sortedEntries[0]);

                // Buscar imagem do usuário
                const userId = parseInt(sortedEntries[0].usuario_id);
                if (!isNaN(userId)) {
                    const userData = await databaseService.getUserById(userId, true);
                    setImgUser(userData);
                }

                // Calcular estatísticas
                const stats: DailyStats = {
                    total: sortedEntries.length,
                    entradas: sortedEntries.filter(entry => !entry.controle).length,
                    saidas: sortedEntries.filter(entry => entry.controle).length
                };
                setDailyStats(stats);

                // Mostrar animação se solicitado
                if (showAnimation) {
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 2000);
                }
            }

            setLoading(false);
        } catch (error) {
            console.error('❌ Erro ao carregar dados:', error);
            setLoading(false);
        }
    }, []); // ✅ SEM DEPENDÊNCIAS!

    // ✅ FUNÇÃO DE POLLING (VERIFICA MUDANÇAS)
    const checkForUpdates = useCallback(async () => {
        try {
            const result = await databaseService.checkForNewEntries(
                new Date().toISOString(),
                lastChangeCountRef.current
            );

            console.log('🔄 Verificação:', {
                hasChanges: result.has_changes,
                lastCount: lastChangeCountRef.current,
                newCount: result.change_count
            });

            if (result.has_changes) {
                console.log('🎯 MUDANÇAS DETECTADAS! Atualizando...');
                
                // ✅ ATUALIZAR REF (NÃO CAUSA RE-RENDER)
                lastChangeCountRef.current = result.change_count;
                
                // ✅ CARREGAR DADOS COM ANIMAÇÃO
                await loadData(true);
            }
        } catch (error) {
            console.error('❌ Erro ao verificar atualizações:', error);
        }
    }, [loadData]); // ✅ APENAS loadData como dependência

    // ✅ EFFECT INICIAL (EXECUTA UMA VEZ)
    useEffect(() => {
        console.log('🚀 Inicializando RegisterEntry...');
        
        // Carregar dados iniciais
        const initialize = async () => {
            await loadData(false);
            
            // Obter contador inicial
            const initialCheck = await databaseService.checkForNewEntries(
                new Date().toISOString(),
                0
            );
            lastChangeCountRef.current = initialCheck.change_count;
            console.log('✅ Contador inicial:', lastChangeCountRef.current);
        };

        initialize();

        // ✅ INICIAR POLLING (VERIFICA A CADA 3 SEGUNDOS)
        pollingIntervalRef.current = setInterval(() => {
            checkForUpdates();
        }, 3000);

        // ✅ CLEANUP
        return () => {
            console.log('🧹 Limpando polling...');
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []); // ✅ ARRAY VAZIO = EXECUTA UMA VEZ!

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
            {/* Indicador de Sistema Ativo */}
            {/* <div className="fixed top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium z-50 flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                Atualização Automática
            </div> */}

            <div className={showAddVisitorModal ? 'blur-sm transition-all duration-300' : ''}>
                <NavBarRegister onLogout={onLogout} user={user} />

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-gray-50 scroll-smooth">
                    {/* Admin Header */}
                    <div className="bg-gray-800 text-white p-3 rounded-lg mb-5 shadow-sm text-center">
                        <div className="mb-3">
                            <div className="text-3xl font-bold mb-1 tracking-wide">FATEC ITU</div>
                        </div>
                        <h1 className="text-xl font-normal opacity-90 m-0">
                            PORTARIA - SISTEMA 🟢 ATIVO
                        </h1>
                        <div className="text-sm opacity-70 mt-1">
                            Atualização automática via trigger
                        </div>
                    </div>

                    {/* Dashboard */}
                    <div className="flex flex-col lg:flex-row gap-5 items-start">
                        {/* Main Card */}
                        <div className="flex-2 min-w-80 bg-white p-5 rounded-lg shadow-sm border border-gray-200 transition-all duration-200">
                            <h2 className="text-gray-800 text-lg font-semibold mb-4 border-b border-gray-200 pb-2">
                                ÚLTIMO REGISTRO 🔄
                            </h2>

                            {!latestEntry ? (
                                <div className="text-center py-8 px-4 text-gray-500">
                                    <div className="text-4xl mb-3 opacity-50">📋</div>
                                    <h2 className="text-gray-700 text-lg font-semibold mb-2">Nenhum registro hoje</h2>
                                    <p className="text-sm opacity-80">Aguardando primeira entrada do dia...</p>
                                </div>
                            ) : (
                                <div className={`bg-white border border-gray-200 rounded p-4 mb-4 shadow-sm transition-all duration-200 ${
                                    showSuccess ? 'border-l-4 border-l-green-500 shadow-green-100' : ''
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

                            {/* Histórico */}
                            <div className="mt-5 pt-4 border-t border-gray-200">
                                <h3 className="text-gray-800 text-base font-semibold mb-3">
                                    ÚLTIMOS REGISTROS 🔄
                                </h3>
                                <div className="flex flex-col gap-2">
                                    {recentEntries.length > 0 ? (
                                        recentEntries.map((entry, index) => (
                                            <div
                                                key={`${entry.id}-${entry.horario}`}
                                                className={`flex items-center p-3 bg-gray-50 rounded border border-gray-200 transition-all duration-200 cursor-pointer ${
                                                    hoveredHistoryItem === index ? 'bg-white border-blue-400 shadow-sm' : ''
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
                            {/* Stats Card */}
                            <div className="bg-white text-gray-800 p-5 rounded text-center shadow-sm border border-gray-200">
                                <div className="text-3xl mb-3 opacity-80">📈</div>
                                <h3 className="text-gray-800 text-lg font-semibold mb-2">
                                    ESTATÍSTICAS DO DIA 📡
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

                            {/* Logs Card */}
                            <div className="bg-white text-gray-800 p-5 rounded text-center shadow-sm border border-gray-200">
                                <div className="text-3xl mb-3 opacity-80">📊</div>
                                <h3 className="text-gray-800 text-lg font-semibold mb-2">LOG DE ENTRADAS</h3>
                                <p className="text-gray-500 mb-4 leading-relaxed text-sm">
                                    Visualize todos os registros
                                </p>
                                <button
                                    className="w-60 bg-gray-800 text-white py-2 px-4 rounded font-semibold cursor-pointer transition-all duration-200 text-sm hover:bg-gray-700"
                                    onClick={() => router.push('/entry-logs')}
                                >
                                    Acessar Logs
                                </button>
                            </div>

                            {/* Visitante Card */}
                            <div className="bg-white text-gray-800 p-5 rounded text-center shadow-sm border border-gray-200">
                                <div className="text-3xl mb-3 opacity-80">👤</div>
                                <h3 className="text-gray-800 text-lg font-semibold mb-2">CADASTRAR VISITANTE</h3>
                                <p className="text-gray-500 mb-4 leading-relaxed text-sm">
                                    Cadastre visitantes temporários
                                </p>
                                <button
                                    className="w-60 bg-purple-600 text-white py-2 px-4 rounded font-semibold cursor-pointer transition-all duration-200 text-sm hover:bg-purple-700"
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
                <div className="fixed top-4 right-4 bg-green-500 text-white p-3 rounded flex items-center gap-2 z-50 shadow-lg animate-bounce">
                    <div className="text-lg">🔄</div>
                    <span className="font-semibold text-sm">Novo registro!</span>
                </div>
            )}

            {/* Modal */}
            <AddVisitorModal
                visible={showAddVisitorModal}
                onClose={() => setShowAddVisitorModal(false)}
                onVisitorAdded={() => loadData(false)}
            />
        </div>
    );
}