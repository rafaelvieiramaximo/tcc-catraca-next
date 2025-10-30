'use client';

import React, { useEffect, useState, useRef } from "react";
import { databaseService } from "../../services/database-service";

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
        identificador: "", // RG do visitante
    });
    const [imagemFile, setImagemFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

    const [catracaStatus, setCatracaStatus] = useState<'online' | 'offline' | 'checking'>('checking');
    const [biometriaMensagem, setBiometriaMensagem] = useState<string>('');
    const [cadastrandoBiometria, setCadastrandoBiometria] = useState(false);
    
    // Estado para controlar se o visitante já foi criado
    const [visitanteCriado, setVisitanteCriado] = useState<{id: number, nome: string, identificador: string} | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Verificar status da catraca
    const verificarStatusCatraca = async () => {
        try {
            setCatracaStatus('checking');
            console.log('🔍 Verificando status da catraca...');

            const response = await fetch('/api/catraca/status');

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📨 Status da catraca:', result);

            setCatracaStatus(result.online ? 'online' : 'offline');

            if (!result.online) {
                setBiometriaMensagem('❌ Catraca offline - biometria indisponível');
            } else {
                if (!visitanteCriado) {
                    setBiometriaMensagem('✅ Catraca online - pronta para cadastro');
                    setTimeout(() => setBiometriaMensagem(''), 3000);
                }
            }
        } catch (error) {
            console.error('❌ Erro ao verificar status:', error);
            setCatracaStatus('offline');
            setBiometriaMensagem('❌ Erro ao conectar com a catraca');
        }
    };

    useEffect(() => {
        if (visible) {
            verificarStatusCatraca();
            // Verificar a cada 30 segundos
            const interval = setInterval(verificarStatusCatraca, 30000);
            return () => clearInterval(interval);
        } else {
            setBiometriaMensagem('');
            setCadastrandoBiometria(false);
            // Resetar estado quando modal fechar
            setVisitanteCriado(null);
        }

        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [visible]);

    // Resetar form quando modal abrir
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
        }
    }, [visible]);

    // Funções para câmera (iguais ao AddUserModal)
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
        // Bloquear se visitante já foi criado
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
        // Bloquear se visitante já foi criado
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

    const cadastrarBiometria = async (userId: number, identificador: string, nome: string) => {
        try {
            setCadastrandoBiometria(true);
            setBiometriaMensagem('🔄 Iniciando cadastro de biometria...');

            console.log('📤 Enviando dados para cadastro de biometria:', { userId, identificador, nome });

            const API_BASE = process.env.NODE_ENV === 'development'
                ? 'http://localhost:3001'
                : '';

            const response = await fetch(`${API_BASE}/api/catraca/iniciar-cadastro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    identificador: identificador,
                    nome: nome
                })
            });

            const result = await response.json();
            console.log('📨 Resposta do cadastro de biometria:', result);

            if (result.success) {
                setBiometriaMensagem(`✅ Biometria cadastrada com sucesso! Posição: ${result.posicao}`);

                await databaseService.createActionLog({
                    id_usuario: userId,
                    identificador: identificador,
                    acao: 'CADASTRAR_BIOMETRIA_VISITANTE',
                    status: 'SUCESSO',
                    detalhes: `Biometria de visitante cadastrada na posição ${result.posicao}`,
                    nome_usuario: nome
                });

                setTimeout(() => {
                    onVisitorAdded();
                    onClose();
                }, 2000);

                return true;
            } else {
                let mensagemErro = result.error;
                if (result.error.includes('Sensor não disponível')) {
                    mensagemErro = '❌ Sensor biométrico não está disponível. Verifique a conexão da catraca.';
                }

                setBiometriaMensagem(`❌ ${mensagemErro}`);

                await databaseService.createActionLog({
                    id_usuario: userId,
                    identificador: identificador,
                    acao: 'CADASTRAR_BIOMETRIA_VISITANTE',
                    status: 'ERRO',
                    detalhes: `Falha: ${result.error}`,
                    nome_usuario: nome
                });

                return false;
            }
        } catch (error: any) {
            console.error('❌ Erro no cadastro de biometria:', error);
            setBiometriaMensagem(`❌ Erro de conexão: ${error.message}`);
            return false;
        } finally {
            setCadastrandoBiometria(false);
        }
    };

    const handleSubmit = async () => {
        if (!formData.nome.trim()) {
            alert("Por favor, preencha o nome do visitante.");
            return;
        }

        if (!formData.identificador.trim()) {
            alert("Por favor, preencha o RG.");
            return;
        }

        // ✅ VALIDAÇÃO DO RG - Formato brasileiro comum (8-9 dígitos)
        if (!/^\d{8,9}$/.test(formData.identificador)) {
            alert("O RG deve conter 8 ou 9 dígitos numéricos (sem pontos ou traços).");
            return;
        }

        // ✅ VALIDAÇÃO DO NOME - Apenas letras e espaços
        if (!/^[a-zA-ZÀ-ÿ\s]{2,}$/.test(formData.nome)) {
            alert("Por favor, insira um nome válido (apenas letras e espaços).");
            return;
        }

        try {
            setLoading(true);

            // Criar visitante
            const result = await databaseService.createUser({
                nome: formData.nome.trim(),
                tipo: 'VISITANTE',
                identificador: formData.identificador.trim(),
            });

            if (result.success && result.userId) {
                // Fazer upload da imagem, se houver
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

                setBiometriaMensagem('✅ Visitante criado com sucesso! Agora cadastre a biometria.');

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
            setBiometriaMensagem('');
        } finally {
            setLoading(false);
        }
    };

    const iniciarCadastroBiometria = async () => {
        if (catracaStatus !== 'online') {
            setBiometriaMensagem('❌ Catraca offline - não é possível cadastrar biometria');
            return;
        }

        if (!formData.identificador) {
            setBiometriaMensagem('❌ RG do visitante é necessário');
            return;
        }

        if (visitanteCriado) {
            const sucesso = await cadastrarBiometria(
                visitanteCriado.id,
                visitanteCriado.identificador,
                visitanteCriado.nome
            );

            if (sucesso) {
                // O modal será fechado automaticamente após o sucesso
            }
        } else {
            setBiometriaMensagem('❌ Crie o visitante primeiro antes de cadastrar a biometria');
        }
    };

    const handleClose = () => {
        if (cameraActive) {
            stopCamera();
        }
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setImagemFile(null);
        setPreviewUrl(null);
        setBiometriaMensagem('');
        setCadastrandoBiometria(false);
        setVisitanteCriado(null);
        onClose();
    };

    const handleCloseWithoutBiometry = () => {
        setVisitanteCriado(null);
        onVisitorAdded();
        onClose();
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
                                <div className={`w-3 h-3 rounded-full ${
                                    catracaStatus === 'online' ? 'bg-green-500' :
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

                        {biometriaMensagem && (
                            <div className={`text-sm p-2 rounded mt-2 ${
                                biometriaMensagem.includes('❌') ? 'bg-red-100 text-red-700 border border-red-200' :
                                biometriaMensagem.includes('✅') ? 'bg-green-100 text-green-700 border border-green-200' :
                                biometriaMensagem.includes('🔄') ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                                'bg-gray-100 text-gray-700 border border-gray-200'
                            }`}>
                                {biometriaMensagem}
                            </div>
                        )}
                    </div>

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
                                            className={`px-4 py-2 rounded-md text-sm font-medium ${
                                                camposBloqueados 
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                            }`}
                                            onClick={handleSelectImage}
                                            disabled={camposBloqueados}
                                        >
                                            Galeria
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium ${
                                                camposBloqueados 
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                    : 'bg-green-500 text-white hover:bg-green-600'
                                            }`}
                                            onClick={startCamera}
                                            disabled={camposBloqueados}
                                        >
                                            Câmera
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium ${
                                                camposBloqueados 
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
                                    <div className={`w-32 h-32 rounded-full border-2 border-dashed flex flex-col items-center justify-center p-4 mb-4 mx-auto transition-colors ${
                                        camposBloqueados 
                                            ? 'bg-gray-100 border-gray-300' 
                                            : 'bg-gray-50 border-gray-300 hover:border-blue-400'
                                    }`}>
                                        <div className={`text-2xl mb-2 ${
                                            camposBloqueados ? 'text-gray-400' : 'text-gray-400'
                                        }`}>📷</div>
                                        <div className={`text-xs text-center ${
                                            camposBloqueados ? 'text-gray-500' : 'text-gray-500'
                                        }`}>
                                            {camposBloqueados ? 'Foto cadastrada' : 'Selecione uma opção'}
                                        </div>
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                                                camposBloqueados 
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                                                    : 'bg-blue-500 text-white hover:bg-blue-600'
                                            }`}
                                            onClick={handleSelectImage}
                                            disabled={camposBloqueados}
                                        >
                                            📁 Galeria
                                        </button>
                                        <button
                                            className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                                                camposBloqueados 
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
                            className={`w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 ${
                                camposBloqueados
                                    ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                            }`}
                            value={formData.nome}
                            onChange={(e) => {
                                if (camposBloqueados) return;
                                // ✅ MÁSCARA: Apenas letras e espaços
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
                            className={`w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 ${
                                camposBloqueados
                                    ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                                    : "bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                            }`}
                            value={formData.identificador}
                            onChange={(e) => {
                                if (camposBloqueados) return;
                                // ✅ MÁSCARA: Apenas números (8-9 dígitos)
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

                    {visitanteCriado && (
                        <div className="mb-4">
                            <button
                                onClick={iniciarCadastroBiometria}
                                disabled={cadastrandoBiometria || loading || catracaStatus !== 'online' || !formData.identificador}
                                className={`w-full py-3 rounded-lg border text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                                    (cadastrandoBiometria || loading || catracaStatus !== 'online' || !formData.identificador)
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

                    <div className="space-y-3">
                        {!visitanteCriado && (
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