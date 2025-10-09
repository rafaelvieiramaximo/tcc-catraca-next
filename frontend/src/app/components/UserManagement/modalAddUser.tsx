// app/components/UserManagement/modalAddUser.tsx
'use client';

import React, { useEffect, useState, useRef } from "react";
import { databaseService, UsuarioCompleto, TipoS } from "../../services/database-service";

interface AddUserModalProps {
    visible: boolean;
    onClose: () => void;
    onUserAdded: () => void;
    userToEdit: UsuarioCompleto | null;
}

export default function AddUserModal({
    visible,
    onClose,
    onUserAdded,
    userToEdit,
}: AddUserModalProps) {
    const [formData, setFormData] = useState({
        tipo: userToEdit?.tipo || ("ESTUDANTE" as TipoS),
        nome: userToEdit?.nome || "",
        identificador: userToEdit?.identificador.toString() || "",
    });
    const [imagemBase64, setImagemBase64] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [imageLoading, setImageLoading] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        if (userToEdit) {
            setFormData({
                tipo: userToEdit.tipo,
                nome: userToEdit.nome,
                identificador: userToEdit.identificador.toString(),
            });

            if (userToEdit.tem_imagem) {
                loadUserImage(userToEdit.id);
            } else {
                setImagemBase64(null);
            }
        } else {
            setFormData({
                tipo: "ESTUDANTE" as TipoS,
                nome: "",
                identificador: "",
            });
            setImagemBase64(null);
        }
    }, [userToEdit]);

    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    const loadUserImage = async (userId: number) => {
        try {
            setImageLoading(true);
            const base64 = await databaseService.getUserImageBase64(userId);
            setImagemBase64(base64);
        } catch (error) {
            console.error("Erro ao carregar imagem do usuário:", error);
            setImagemBase64(null);
        } finally {
            setImageLoading(false);
        }
    };

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
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const context = canvas.getContext('2d');
            
            // Configurar canvas com as dimensões do vídeo
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            
            // Desenhar o frame atual do vídeo no canvas
            context?.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            // Converter para base64
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            setImagemBase64(imageData);
            
            // Parar a câmera
            stopCamera();
        }
    };

    const switchCamera = async () => {
        // Parar câmera atual
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Alternar entre frontal e traseira
        setFacingMode(prev => prev === "user" ? "environment" : "user");
        
        // Reiniciar câmera com novo facingMode
        await startCamera();
    };

    const handleSelectImage = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files[0]) {
                const file = target.files[0];

                // Validar tamanho do arquivo (5MB)
                if (file.size > 5 * 1024 * 1024) {
                    alert("A imagem deve ter no máximo 5MB");
                    return;
                }

                // Validar tipo do arquivo
                if (!file.type.startsWith('image/')) {
                    alert("Por favor, selecione um arquivo de imagem válido");
                    return;
                }

                // Converter para base64
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (event.target?.result) {
                        setImagemBase64(event.target.result as string);
                    }
                };
                reader.onerror = () => {
                    alert("Erro ao processar a imagem");
                };
                reader.readAsDataURL(file);
            }
        };

        input.click();
    };

    const handleRemoveImage = () => {
        if (confirm("Deseja realmente remover a imagem?")) {
            setImagemBase64(null);
        }
    };

    const handleSubmit = async () => {
        // Validações
        if (!formData.nome.trim()) {
            alert("Por favor, preencha o nome do usuário.");
            return;
        }

        if (!formData.identificador.trim()) {
            alert("Por favor, preencha o RA/Matrícula.");
            return;
        }

        if (
            formData.tipo === "ESTUDANTE" &&
            !/^\d{13}$/.test(formData.identificador)
        ) {
            alert("O RA deve conter exatamente 13 números.");
            return;
        }

        if (
            formData.tipo === "FUNCIONARIO" &&
            !/^\d{5}$/.test(formData.identificador)
        ) {
            alert("A matrícula deve conter exatamente 5 números.");
            return;
        }

        try {
            setLoading(true);

            if (userToEdit) {
                // Editar usuário existente
                const result = await databaseService.updateUser(userToEdit.id, {
                    ...formData,
                    tipo: formData.tipo,
                    identificador: formData.identificador,
                    imagem_base64: imagemBase64,
                });

                if (result.success) {
                    alert("Usuário editado com sucesso!");
                    onUserAdded();
                    onClose();
                } else {
                    alert(result.error || "Não foi possível editar o usuário.");
                }
            } else {
                // Criar novo usuário
                const result = await databaseService.createUser({
                    nome: formData.nome.trim(),
                    tipo: formData.tipo,
                    identificador: formData.identificador.trim(),
                    imagem_base64: imagemBase64 || undefined,
                });

                if (result.success) {
                    alert("Usuário cadastrado com sucesso!");
                    onUserAdded();
                    onClose();
                } else {
                    alert(result.error || "Não foi possível cadastrar o usuário.");
                }
            }
        } catch (error: any) {
            console.error("Erro ao salvar usuário:", error);
            alert(error.message || "Erro inesperado.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        // Parar câmera se estiver ativa
        if (cameraActive) {
            stopCamera();
        }
        setImagemBase64(null);
        onClose();
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-20">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 mx-4">
                <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-white">
                    <div className="text-lg font-bold text-gray-800">
                        {userToEdit ? "Editar Usuário" : "Cadastro de Usuário"}
                    </div>
                    <button
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        onClick={handleClose}
                    >
                        <span className="text-xl font-bold">✕</span>
                    </button>
                </div>

                {/* Form */}
                <div className="max-h-[70vh] overflow-y-auto p-5">
                    {/* Seção de Imagem */}
                    <div className="mb-5">
                        <div className="text-base font-semibold text-gray-800 mb-2">Foto do Perfil</div>

                        <div className="flex justify-center">
                            {cameraActive ? (
                                // Interface da Câmera
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
                            ) : imagemBase64 ? (
                                // Preview da Imagem
                                <div className="text-center">
                                    <img
                                        src={imagemBase64}
                                        alt="Preview"
                                        className="w-30 h-30 rounded-full bg-gray-100 object-cover mb-2 mx-auto"
                                    />
                                    <div className="flex justify-center gap-2">
                                        <button
                                            className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600"
                                            onClick={handleSelectImage}
                                        >
                                            Galeria
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600"
                                            onClick={startCamera}
                                        >
                                            Câmera
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-red-500 text-white rounded-md text-sm font-medium hover:bg-red-600"
                                            onClick={handleRemoveImage}
                                        >
                                            Remover
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                // Opções para Adicionar Foto
                                <div className="text-center">
                                    <div className="w-30 h-30 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex flex-col items-center justify-center p-4 hover:border-blue-400 transition-colors mb-4 mx-auto">
                                        <div className="text-gray-400 text-2xl mb-2">📷</div>
                                        <div className="text-gray-500 text-xs text-center">
                                            Selecione uma opção
                                        </div>
                                    </div>
                                    <div className="flex justify-center gap-3">
                                        <button
                                            className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 flex items-center gap-2"
                                            onClick={handleSelectImage}
                                        >
                                            📁 Galeria
                                        </button>
                                        <button
                                            className="px-4 py-2 bg-green-500 text-white rounded-md text-sm font-medium hover:bg-green-600 flex items-center gap-2"
                                            onClick={startCamera}
                                        >
                                            📸 Câmera
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tipo */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Tipo</div>
                        <div className="flex flex-col">
                            <div className="flex justify-between gap-2">
                                <button
                                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${formData.tipo === "ESTUDANTE"
                                        ? "bg-[#4A90A4] border-[#4A90A4] text-white"
                                        : "bg-gray-50 border-gray-200 text-gray-600"
                                        }`}
                                    onClick={() => setFormData(prev => ({ ...prev, tipo: "ESTUDANTE" }))}
                                >
                                    Estudante
                                </button>
                                <button
                                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${formData.tipo === "FUNCIONARIO"
                                        ? "bg-[#4A90A4] border-[#4A90A4] text-white"
                                        : "bg-gray-50 border-gray-200 text-gray-600"
                                        }`}
                                    onClick={() => setFormData(prev => ({ ...prev, tipo: "FUNCIONARIO" }))}
                                >
                                    Funcionário
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Nome */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Nome</div>
                        <input
                            type="text"
                            className="w-full bg-gray-50 rounded-lg border border-gray-200 p-3 text-base text-gray-800 outline-none focus:border-[#4A90A4]"
                            value={formData.nome}
                            onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                            placeholder="Digite o nome completo"
                        />
                    </div>

                    {/* Identificador */}
                    <div className="mb-6">
                        <div className="text-sm font-semibold text-gray-800 mb-2">
                            {formData.tipo === "FUNCIONARIO" ? "Matrícula" : "RA"}
                        </div>
                        <input
                            type="text"
                            className="w-full bg-gray-50 rounded-lg border border-gray-200 p-3 text-base text-gray-800 outline-none focus:border-[#4A90A4]"
                            value={formData.identificador}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "");
                                setFormData(prev => ({ ...prev, identificador: value }));
                            }}
                            placeholder={formData.tipo === "FUNCIONARIO" ? "Digite a matrícula" : "Digite o RA"}
                            maxLength={formData.tipo === "FUNCIONARIO" ? 5 : 13}
                        />
                    </div>

                    {/* Botão */}
                    <button
                        className={`w-full rounded-full py-4 text-base font-bold text-white transition-colors ${loading ? "bg-gray-400" : "bg-[#4A90A4] hover:bg-[#3a7a8a]"
                            }`}
                        onClick={handleSubmit}
                        disabled={loading}
                    >
                        {loading
                            ? userToEdit
                                ? "Salvando..."
                                : "Cadastrando..."
                            : userToEdit
                                ? "Salvar"
                                : "Cadastrar"}
                    </button>
                </div>
            </div>
        </div>
    );
}