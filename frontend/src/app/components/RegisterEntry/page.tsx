// components/RegisterEntry/index.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { databaseService, UsuarioCompleto, LogEntrada, Usuario } from '../../services/database-service';
import NavBarRegister from './Navbar';

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
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [hoveredHistoryItem, setHoveredHistoryItem] = useState<number | null>(null);
    const [isSidebarHovered, setIsSidebarHovered] = useState(false);
    
    const router = useRouter();

    useEffect(() => {
        loadLatestEntries();
        loadDailyStats();
        const interval = setInterval(() => {
            loadLatestEntries();
            loadDailyStats();
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    const loadLatestEntries = async () => {
        try {
            setLoading(true);
            const logs = await databaseService.getLogsEntrada(10, 0, { hoje: true });
            
            if (logs && logs.length > 0) {
                const sortedLogs = [...logs].sort((a, b) => {
                    const dateA = new Date(`${a.data_entrada}T${a.horario}`);
                    const dateB = new Date(`${b.data_entrada}T${b.horario}`);
                    return dateB.getTime() - dateA.getTime();
                });
                
                const latestFour = sortedLogs.slice(0, 4);
                setRecentEntries(latestFour);
                
                const newEntry = sortedLogs[0];
                if (!latestEntry || newEntry.id !== latestEntry.id) {
                    setLatestEntry(newEntry);
                    
                    // Buscar imagem pelo usuario_id correto
                    try {
                        const userId = parseInt(newEntry.usuario_id);
                        if (!isNaN(userId)) {
                            const userData = await databaseService.getUserById(userId, true);
                            setImgUser(userData);
                        } else {
                            setImgUser(null);
                        }
                    } catch (error) {
                        console.error('Erro ao carregar imagem do usuário:', error);
                        setImgUser(null);
                    }
                    
                    if (latestEntry) {
                        setShowSuccess(true);
                        setTimeout(() => setShowSuccess(false), 3000);
                    }
                }
            } else {
                setRecentEntries([]);
                setLatestEntry(null);
                setImgUser(null);
            }
        } catch (error) {
            console.error('Erro ao carregar entradas recentes:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadDailyStats = async () => {
        try {
            const allTodayLogs = await databaseService.getLogsEntrada(1000, 0, { hoje: true });
            
            if (allTodayLogs && allTodayLogs.length > 0) {
                const stats: DailyStats = {
                    total: allTodayLogs.length,
                    entradas: allTodayLogs.filter(log => !log.controle).length,
                    saidas: allTodayLogs.filter(log => log.controle).length
                };
                setDailyStats(stats);
            } else {
                setDailyStats({ total: 0, entradas: 0, saidas: 0 });
            }
        } catch (error) {
            console.error('Erro ao carregar estatísticas do dia:', error);
        }
    };

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

    if (loading && !latestEntry) {
        return (
            <div className="h-screen overflow-hidden flex flex-col bg-gray-50">
                <NavBarRegister onLogout={onLogout} user={user} />
                <div className="flex-1 flex flex-col">
                    <div className="flex flex-col items-center justify-center h-40vh text-gray-500">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                        <span className="text-sm font-medium">Aguardando registros...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen overflow-hidden flex flex-col bg-gray-50">
            <NavBarRegister onLogout={onLogout} user={user} />

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 bg-gray-50 scroll-smooth">
                {/* Admin Header */}
                <div className="bg-gray-800 text-white p-3 rounded-lg mb-5 shadow-sm text-center">
                    <div className="mb-3">
                        <div className="text-3xl font-bold mb-1 tracking-wide">FATEC ITU</div>
                    </div>
                    <h1 className="text-xl font-normal opacity-90 m-0">PORTARIA - SISTEMA</h1>
                </div>

                {/* Dashboard */}
                <div className="flex flex-col lg:flex-row gap-5 items-start">
                    {/* Main Card */}
                    <div className="flex-2 min-w-80 bg-white p-5 rounded-lg shadow-sm border border-gray-200 transition-all duration-200">
                        <h2 className="text-gray-800 text-lg font-semibold mb-4 border-b border-gray-200 pb-2">
                            ÚLTIMO REGISTRO
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
                                    {/* User Avatar */}
                                    <div className="w-12 h-12 bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                                        {imgUser?.imagem_base64 ? (
                                            <img 
                                                className="w-12 h-12 rounded-full object-cover"
                                                src={imgUser.imagem_base64} 
                                                alt={`Foto de ${latestEntry.nome}`}
                                                onError={(e) => {
                                                    const target = e.target as HTMLImageElement;
                                                    target.style.display = 'none';
                                                }}
                                            />
                                        ) : (
                                            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                                {latestEntry.nome.split(' ').map(n => n[0]).join('').toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    {/* User Info */}
                                    <div className="flex-1 min-w-50">
                                        {/* First Row - Name */}
                                        <div className="flex gap-4 mb-3 flex-wrap">
                                            <div className="flex-1 min-w-24">
                                                <h2 className="text-gray-800 text-xl font-bold mb-1 leading-tight">{latestEntry.nome}</h2>
                                                <p className="text-gray-500 text-xs m-0 italic">Nome Completo</p>
                                            </div>
                                        </div>

                                        {/* Second Row - Type and Period */}
                                        <div className="flex gap-4 mb-3 flex-wrap">
                                            <div className="flex-1 min-w-24">
                                                <h3 className="text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wide">Tipo</h3>
                                                <p className="text-gray-800 text-sm font-medium m-0">{latestEntry.tipo}</p>
                                            </div>

                                            <div className="flex-1 min-w-24">
                                                <h3 className="text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wide">Período</h3>
                                                <p className="text-gray-800 text-sm font-medium m-0">{latestEntry.periodo}</p>
                                            </div>
                                        </div>

                                        {/* Third Row - Register and Date */}
                                        <div className="flex gap-4 mb-3 flex-wrap">
                                            <div className="flex-1 min-w-24">
                                                <h3 className="text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wide">Registro</h3>
                                                <p className="text-gray-800 text-sm font-medium m-0">{latestEntry.identificador}</p>
                                            </div>

                                            <div className="flex-1 min-w-24">
                                                <h3 className="text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wide">Data</h3>
                                                <p className="text-gray-800 text-sm font-medium m-0">{formatDate(latestEntry.data_entrada)}</p>
                                            </div>
                                        </div>

                                        {/* Fourth Row - Status and Time */}
                                        <div className="flex gap-4 mb-3 flex-wrap">
                                            <div className="flex-1 min-w-24">
                                                <h3 className="text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wide">Status</h3>
                                                <p className={`text-sm font-bold m-0 ${
                                                    latestEntry.controle ? 'text-red-600' : 'text-green-600'
                                                }`}>
                                                    {latestEntry.controle ? 'Saída' : 'Entrada'}
                                                </p>
                                            </div>

                                            <div className="flex-1 min-w-24">
                                                <h3 className="text-gray-500 text-xs font-semibold mb-1 uppercase tracking-wide">Horário</h3>
                                                <p className="text-gray-800 text-sm font-medium m-0">{formatTime(latestEntry.horario)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Status Message */}
                                <div 
                                    className="p-3 rounded text-white flex items-center justify-center font-semibold text-center ml-100 text-sm mt-3 h-10 w-100"
                                    style={{ backgroundColor: getStatusColor(latestEntry.controle) }}
                                >
                                    {getStatusIcon(latestEntry.controle)} {getStatusText(latestEntry.controle)}
                                </div>
                            </div>
                        )}

                        {/* Histórico dos últimos 4 registros */}
                        <div className="mt-5 pt-4 border-t border-gray-200">
                            <h3 className="text-gray-800 text-base font-semibold mb-3">ÚLTIMOS REGISTROS</h3>
                            <div className="flex flex-col gap-2">
                                {recentEntries.length > 0 ? (
                                    recentEntries.map((entry, index) => (
                                        <div 
                                            key={entry.id} 
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
                                className={`w-60 bg-gray-800 border-none text-white py-2 px-4 rounded font-semibold cursor-pointer transition-all duration-200 text-sm ${
                                    isSidebarHovered ? 'bg-gray-700 transform -translate-y-0.5' : ''
                                }`}
                                onClick={() => router.push('/entry-logs')}
                            >
                                Acessar Logs
                            </button>
                        </div>

                        {/* Stats Card */}
                        <div className="bg-white text-gray-800 p-5 rounded text-center shadow-sm border border-gray-200">
                            <div className="text-3xl mb-3 opacity-80">📈</div>
                            <h3 className="text-gray-800 text-lg font-semibold mb-2">ESTATÍSTICAS DO DIA</h3>
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
                    </div>
                </div>

                {/* Success Animation */}
                {showSuccess && (
                    <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white p-4 rounded flex items-center gap-3 z-50 shadow-lg border border-green-600">
                        <div className="text-xl">🎉</div>
                        <span className="font-semibold text-sm">Novo registro!</span>
                    </div>
                )}
            </div>
        </div>
    );
}