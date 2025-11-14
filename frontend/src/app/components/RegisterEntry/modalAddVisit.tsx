'use client';

import React, { useEffect, useState, useRef } from "react";
import { databaseService } from "../../services/database-service";
import BiometryStepper from "../UserManagement/stepperBiometry";

interface AddVisitorModalProps {
    visible: boolean;
    onClose: () => void;
    onVisitorAdded: () => void;
}

export default function AddVisitorModal({
    visible,
    onClose,
    onVisitorAdded,
}: AddVisitorModalProps) {
    const [formData, setFormData] = useState({
        nome: "",
        identificador: "",
    });
    const [imagemFile, setImagemFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

    const [catracaStatus, setCatracaStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [cadastrandoBiometria, setCadastrandoBiometria] = useState(false);
    const [etapaAtual, setEtapaAtual] = useState<string>('');

    const [visitanteCriado, setVisitanteCriado] = useState<{ id: number, nome: string, identificador: string } | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const modalAtivoRef = useRef(false);
    const pollingControllerRef = useRef<AbortController | null>(null);

    // ==================== SISTEMA DE POLLING PARA WEBHOOK ====================

    const iniciarPollingBiometria = async () => {
        let tentativas = 0;
        const maxTentativas = 300;

        const poll = async () => {
            if (!modalAtivoRef.current) {
                return;
            }

            try {
                tentativas++;

                const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

                if (pollingControllerRef.current) {
                    pollingControllerRef.current.abort();
                }

                const controller = new AbortController();
                pollingControllerRef.current = controller;

                const response = await fetch(`${API_BASE}/biometry`, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const result = await response.json();

                if (!modalAtivoRef.current) {
                    return;
                }

                if (result.etapa) {
                    setEtapaAtual(result.etapa);
                }

                const etapasFinais = ['finalizado', 'sucesso', 'biometria_cadastrada', 'completo'];
                const etapasErro = ['erro', 'cancelado', 'error', 'timeout', 'erro_conexao'];

                if (etapasFinais.includes(result.etapa)) {
                    await tratarSucessoBiometria(result);
                    return;

                } else if (etapasErro.includes(result.etapa)) {
                    await tratarErroBiometria();
                    return;

                } else if (tentativas >= maxTentativas) {
                    await tratarTimeoutBiometria();
                    return;

                } else {
                    if (modalAtivoRef.current) {
                        pollingRef.current = setTimeout(poll, 300);
                    }
                }

            } catch (error: any) {
                if (modalAtivoRef.current && tentativas < maxTentativas) {
                    pollingRef.current = setTimeout(poll, 1000);
                } else if (modalAtivoRef.current) {
                    await tratarErroConexao();
                }
            }
        };

        if (modalAtivoRef.current) {
            poll();
        }
    };

    const cancelarCadastroBiometria = async () => {
        try {
            const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

            await fetch(`${API_BASE}/cancelar-cadastro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            pararPollingBiometria();
            setCadastrandoBiometria(false);
            setEtapaAtual('cancelado');

        } catch (error) {
            console.error('❌ Erro ao cancelar cadastro:', error);
        }
    };

    const tratarSucessoBiometria = async (dados: any) => {
        pararPollingBiometria();

        if (!modalAtivoRef.current) return;

        setEtapaAtual('sucesso');

        if (visitanteCriado) {
            await databaseService.createActionLog({
                id_usuario: visitanteCriado.id,
                identificador: visitanteCriado.identificador,
                acao: 'CADASTRAR_BIOMETRIA_VISITANTE',
                status: 'SUCESSO',
                detalhes: `Biometria cadastrada com sucesso! Posição: ${dados.dados?.posicao || 'N/A'}`,
                nome_usuario: visitanteCriado.nome
            });
        }

        setCadastrandoBiometria(false);

        setTimeout(() => {
            if (modalAtivoRef.current) {
                onVisitorAdded();
                onClose();
            }
        }, 3000);
    };

    const tratarErroBiometria = async () => {
        pararPollingBiometria();

        if (modalAtivoRef.current) {
            setEtapaAtual('erro');
            setCadastrandoBiometria(false);

            if (visitanteCriado) {
                await databaseService.createActionLog({
                    id_usuario: visitanteCriado.id,
                    identificador: visitanteCriado.identificador,
                    acao: 'CADASTRAR_BIOMETRIA_VISITANTE',
                    status: 'ERRO',
                    detalhes: 'Falha no cadastro da biometria',
                    nome_usuario: visitanteCriado.nome
                });
            }
        }
    };

    const tratarTimeoutBiometria = async () => {
        pararPollingBiometria();

        if (modalAtivoRef.current) {
            setEtapaAtual('timeout');
            setCadastrandoBiometria(false);
        }
    };

    const tratarErroConexao = async () => {
        pararPollingBiometria();

        if (modalAtivoRef.current) {
            setEtapaAtual('erro_conexao');
            setCadastrandoBiometria(false);
        }
    };

    const pararPollingBiometria = () => {
        if (pollingRef.current) {
            clearTimeout(pollingRef.current);
            pollingRef.current = null;
        }
        if (pollingControllerRef.current) {
            pollingControllerRef.current.abort();
            pollingControllerRef.current = null;
        }
    };

    // ==================== CONTROLE DE ESTADO DO MODAL ====================

    useEffect(() => {
        modalAtivoRef.current = visible;

        if (visible) {
            verificarStatusCatraca();
            const interval = setInterval(verificarStatusCatraca, 30000);
            return () => {
                clearInterval(interval);
            };
        } else {
            setCadastrandoBiometria(false);
            setEtapaAtual('');
            pararPollingBiometria();
            setVisitanteCriado(null);
        }

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            pararPollingBiometria();
        };
    }, [visible]);

    useEffect(() => {
        if (visible) {
            setFormData({
                nome: "",
                identificador: "",
            });
            setImagemFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
            setVisitanteCriado(null);
            setEtapaAtual('');
        }
    }, [visible]);

    // ==================== FUNÇÕES DE CÂMERA ====================

    const startCamera = async () => {
        try {
            setCameraActive(true);
            const constraints = {
                video: {
                    facingMode: facingMode,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error("Erro ao acessar a câmera:", error);
            alert("Não foi possível acessar a câmera. Verifique as permissões.");
            setCameraActive(false);
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        setCameraActive(false);
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');

            canvas.width = videoRef.current.videoWidth;
            canvas.height = videoRef.current.videoHeight;
            context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `photo_${Date.now()}.jpg`, {
                        type: 'image/jpeg'
                    });
                    setImagemFile(file);
                    setPreviewUrl(URL.createObjectURL(blob));
                }
            }, 'image/jpeg', 0.8);

            stopCamera();
        }
    };

    const switchCamera = async () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }

        setFacingMode(prev => prev === "user" ? "environment" : "user");
        await startCamera();
    };

    const handleSelectImage = () => {
        if (visitanteCriado) {
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                const file = target.files[0];

                if (file.size > 5 * 1024 * 1024) {
                    alert("A imagem deve ter no máximo 5MB");
                    return;
                }

                if (!file.type.startsWith('image/')) {
                    alert("Por favor, selecione um arquivo de imagem válido");
                    return;
                }

                setImagemFile(file);
                const url = URL.createObjectURL(file);
                setPreviewUrl(url);
            }
        };

        input.click();
    };

    const handleRemoveImage = () => {
        if (visitanteCriado) {
            return;
        }

        if (confirm("Deseja realmente remover a imagem?")) {
            setImagemFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
        }
    };

    // ==================== FUNÇÃO CADASTRAR BIOMETRIA COM WEBHOOK ====================

    const cadastrarBiometria = async (userId: number, identificador: string, nome: string) => {
        if (!modalAtivoRef.current) {
            return false;
        }

        try {
            setCadastrandoBiometria(true);
            setEtapaAtual('iniciando');

            const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(`${API_BASE}/catraca/iniciar-cadastro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    identificador: identificador,
                    nome: nome,
                    webhook_url: `${process.env.NEXT_PUBLIC_API_URL || ''}/webhook/biometria`
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = await response.json();

            if (!modalAtivoRef.current) {
                return false;
            }

            if (result.success) {
                setEtapaAtual('conectado');
                iniciarPollingBiometria();
                return true;
            } else {
                if (modalAtivoRef.current) {
                    setEtapaAtual('erro_inicial');
                    setCadastrandoBiometria(false);

                    await databaseService.createActionLog({
                        id_usuario: userId,
                        identificador: identificador,
                        acao: 'CADASTRAR_BIOMETRIA_VISITANTE',
                        status: 'ERRO',
                        detalhes: `Falha: ${result.error}`,
                        nome_usuario: nome
                    });
                }

                return false;
            }
        } catch (error: any) {
            console.error('❌ Erro no cadastro de biometria:', error);

            if (modalAtivoRef.current) {
                setEtapaAtual('erro_conexao');
                setCadastrandoBiometria(false);
            }
            return false;
        }
    };

    // ==================== FUNÇÕES PRINCIPAIS ====================

    const handleSubmit = async () => {
        if (!formData.nome.trim()) {
            alert("Por favor, preencha o nome do visitante.");
            return;
        }

        if (!formData.identificador.trim()) {
            alert("Por favor, preencha o RG.");
            return;
        }

        if (!/^\d{8,9}$/.test(formData.identificador)) {
            alert("O RG deve conter 8 ou 9 dígitos numéricos (sem pontos ou traços).");
            return;
        }

        if (!/^[a-zA-ZÀ-ÿ\s]{2,}$/.test(formData.nome)) {
            alert("Por favor, insira um nome válido (apenas letras e espaços).");
            return;
        }

        try {
            setLoading(true);

            const result = await databaseService.createUser({
                nome: formData.nome.trim(),
                tipo: 'VISITANTE',
                identificador: formData.identificador.trim(),
            });

            if (result.success && result.userId) {
                if (imagemFile) {
                    await databaseService.processAndUploadUserImage(
                        result.userId,
                        formData.identificador.trim(),
                        imagemFile
                    );
                }

                setVisitanteCriado({
                    id: result.userId,
                    nome: formData.nome.trim(),
                    identificador: formData.identificador.trim()
                });

                await databaseService.createActionLog({
                    id_usuario: result.userId,
                    identificador: formData.identificador.trim(),
                    acao: 'CRIAR_VISITANTE',
                    status: 'SUCESSO',
                    detalhes: `Visitante ${formData.nome} cadastrado sem biometria`,
                    nome_usuario: formData.nome
                });

            } else {
                alert(result.error || "Não foi possível criar o visitante.");
            }
        } catch (error: any) {
            console.error("Erro ao salvar visitante:", error);
            alert(error.message || "Erro inesperado.");
        } finally {
            setLoading(false);
        }
    };

    const iniciarCadastroBiometria = async () => {
        if (catracaStatus !== 'online') {
            alert('❌ Catraca offline - não é possível cadastrar biometria');
            return;
        }

        if (!formData.identificador) {
            alert('❌ RG do visitante é necessário');
            return;
        }

        if (visitanteCriado) {
            await cadastrarBiometria(
                visitanteCriado.id,
                visitanteCriado.identificador,
                visitanteCriado.nome
            );
        } else {
            alert('❌ Crie o visitante primeiro antes de cadastrar a biometria');
        }
    };

    const handleClose = () => {
        modalAtivoRef.current = false;
        pararPollingBiometria();

        if (cameraActive) {
            stopCamera();
        }
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }

        setImagemFile(null);
        setPreviewUrl(null);
        setCadastrandoBiometria(false);
        setEtapaAtual('');
        setVisitanteCriado(null);

        onClose();
    };

    const handleCloseWithoutBiometry = () => {
        modalAtivoRef.current = false;
        pararPollingBiometria();
        setVisitanteCriado(null);
        setEtapaAtual('');
        onVisitorAdded();
        onClose();
    };

    const verificarStatusCatraca = async () => {
        try {
            setCatracaStatus('checking');

            const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

            const response = await fetch(`${API_BASE}/catraca/status`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();

            setCatracaStatus(result.online ? 'online' : 'offline');

        } catch (error) {
            console.error('❌ Erro ao verificar status:', error);
            setCatracaStatus('offline');
        }
    };

    if (!visible) return null;

    const camposBloqueados = !!visitanteCriado;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-50">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 mx-4">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-white">
                    <div className="text-lg font-bold text-gray-800">
                        {visitanteCriado ? "Cadastrar Biometria" : "Cadastro de Visitante"}
                    </div>
                    <button
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        onClick={handleClose}
                    >
                        <span className="text-xl font-bold">✕</span>
                    </button>
                </div>

                <div className="max-h-[70vh] overflow-y-auto p-5">
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${catracaStatus === 'online' ? 'bg-green-500' :
                                    catracaStatus === 'checking' ? 'bg-yellow-500' : 'bg-red-500'
                                    }`} />
                                <span className="text-sm font-medium">
                                    Catraca: {catracaStatus === 'online' ? 'Online' :
                                        catracaStatus === 'checking' ? 'Verificando...' : 'Offline'}
                                </span>
                            </div>
                            <button
                                onClick={verificarStatusCatraca}
                                disabled={catracaStatus === 'checking'}
                                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600 disabled:bg-gray-400"
                            >
                                Atualizar
                            </button>
                        </div>

                        {/* Indicador de Webhook */}
                        {cadastrandoBiometria && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                                    <span className="font-medium">Sistema Webhook Ativo</span>
                                </div>
                                <div className="mt-1">Recebendo etapas em tempo real da catraca</div>
                            </div>
                        )}
                    </div>

                    {/* Seção de Foto */}
                    <div className="mb-5">
                        <div className="text-base font-semibold text-gray-800 mb-2">Foto do Visitante</div>
                        <div className="flex justify-center">
                            {cameraActive ? (
                                <div className="text-center">
                                    <div className="relative bg-black rounded-lg overflow-hidden mb-4">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full max-w-xs h-64 object-cover"
                                        />
                                        <canvas ref={canvasRef} className="hidden" />
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600"
                                            onClick={stopCamera}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600"
                                            onClick={capturePhoto}
                                        >
                                            📸 Tirar Foto
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium hover:bg-gray-600"
                                            onClick={switchCamera}
                                        >
                                            🔄 {facingMode === "user" ? "Traseira" : "Frontal"}
                                        </button>
                                    </div>
                                </div>
                            ) : previewUrl ? (
                                <div className="text-center">
                                    <img
                                        src={previewUrl}
                                        alt="Preview"
                                        className="w-32 h-32 rounded-full bg-gray-100 object-cover mb-2 mx-auto border-2 border-gray-300"
                                    />
                                    <div className="flex justify-center gap-2">
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium ${camposBloqueados
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                                }`}
                                            onClick={handleSelectImage}
                                            disabled={camposBloqueados}
                                        >
                                            Galeria
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium ${camposBloqueados
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-500 text-white hover:bg-green-600'
                                                }`}
                                            onClick={startCamera}
                                            disabled={camposBloqueados}
                                        >
                                            Câmera
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium ${camposBloqueados
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-red-500 text-white hover:bg-red-600'
                                                }`}
                                            onClick={handleRemoveImage}
                                            disabled={camposBloqueados}
                                        >
                                            Remover
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <div className={`w-32 h-32 rounded-full border-2 border-dashed flex flex-col items-center justify-center p-4 mb-4 mx-auto transition-colors ${camposBloqueados
                                        ? 'bg-gray-100 border-gray-300'
                                        : 'bg-gray-50 border-gray-300 hover:border-blue-400'
                                        }`}>
                                        <div className={`text-2xl mb-2 ${camposBloqueados ? 'text-gray-400' : 'text-gray-400'
                                            }`}>📷</div>
                                        <div className={`text-xs text-center ${camposBloqueados ? 'text-gray-500' : 'text-gray-500'
                                            }`}>
                                            {camposBloqueados ? 'Foto cadastrada' : 'Selecione uma opção'}
                                        </div>
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${camposBloqueados
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-blue-500 text-white hover:bg-blue-600'
                                                }`}
                                            onClick={handleSelectImage}
                                            disabled={camposBloqueados}
                                        >
                                            📁 Galeria
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${camposBloqueados
                                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                : 'bg-green-500 text-white hover:bg-green-600'
                                                }`}
                                            onClick={startCamera}
                                            disabled={camposBloqueados}
                                        >
                                            📸 Câmera
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Nome */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Nome Completo</div>
                        <input
                            type="text"
                            className={`w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 ${camposBloqueados
                                ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                                }`}
                            value={formData.nome}
                            onChange={(e) => {
                                if (camposBloqueados) return;
                                const value = e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
                                setFormData(prev => ({ ...prev, nome: value }));
                            }}
                            placeholder="Digite o nome completo do visitante"
                            disabled={camposBloqueados}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Apenas letras e espaços
                        </p>
                    </div>

                    {/* RG */}
                    <div className="mb-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">RG</div>
                        <input
                            type="text"
                            className={`w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 ${camposBloqueados
                                ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                                }`}
                            value={formData.identificador}
                            onChange={(e) => {
                                if (camposBloqueados) return;
                                const value = e.target.value.replace(/\D/g, "").slice(0, 9);
                                setFormData(prev => ({ ...prev, identificador: value }));
                            }}
                            placeholder="Digite o RG (apenas números)"
                            maxLength={9}
                            disabled={camposBloqueados}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            8 ou 9 dígitos numéricos (sem pontos ou traços)
                        </p>
                    </div>

                    {/* Biometry Stepper */}
                    {visitanteCriado && cadastrandoBiometria && (
                        <div className="mb-4 bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-4 py-2 border-b border-gray-200">
                                <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                    <span>📊</span>
                                    Progresso do Cadastro (Webhook)
                                </h3>
                            </div>
                            <div className="p-4">
                                <BiometryStepper
                                    currentStep={etapaAtual}
                                    isActive={cadastrandoBiometria}
                                />
                            </div>
                        </div>
                    )}

                    {/* Botão de cadastrar biometria */}
                    {visitanteCriado && (
                        <div className="mb-4">
                            <button
                                onClick={iniciarCadastroBiometria}
                                disabled={cadastrandoBiometria || loading || catracaStatus !== 'online' || !formData.identificador}
                                className={`w-full py-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${(cadastrandoBiometria || loading || catracaStatus !== 'online' || !formData.identificador)
                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                    : 'bg-green-500 text-white hover:bg-green-600'
                                    }`}
                            >
                                {cadastrandoBiometria ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        Cadastrando Biometria...
                                    </>
                                ) : (
                                    <>
                                        <span>📝</span>
                                        Cadastrar Biometria
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-gray-500 mt-1 text-center">
                                {!formData.identificador
                                    ? "Preencha o RG primeiro"
                                    : catracaStatus !== 'online'
                                        ? "Aguardando conexão com a catraca"
                                        : "Clique para cadastrar a digital do visitante"}
                            </p>
                        </div>
                    )}

                    {/* Botão de cancelar cadastro ativo */}
                    {cadastrandoBiometria && (
                        <div className="mb-4">
                            <button
                                onClick={cancelarCadastroBiometria}
                                disabled={!cadastrandoBiometria}
                                className="w-full py-3 rounded-lg border border-red-500 text-red-500 bg-white hover:bg-red-50 text-sm font-medium transition-colors"
                            >
                                ❌ Cancelar Cadastro de Biometria
                            </button>
                        </div>
                    )}

                    <div className="space-y-3">
                        {!visitanteCriado && (
                            <button
                                className={`w-full rounded-full py-4 text-base font-bold text-white transition-colors flex items-center justify-center ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#4A90A4] hover:bg-[#3a7a8a]"
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
                                    'Cadastrar Visitante'
                                )}
                            </button>
                        )}

                        {visitanteCriado && (
                            <button
                                className="w-full rounded-full py-3 text-base font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                                onClick={handleCloseWithoutBiometry}
                            >
                                Fechar sem Cadastrar Biometria
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}