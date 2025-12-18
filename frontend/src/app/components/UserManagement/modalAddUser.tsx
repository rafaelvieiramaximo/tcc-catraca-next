'use client';

import React, { useEffect, useState, useRef } from "react";
import { databaseService, UsuarioCompleto, TipoS } from "../../services/database-service";
import BiometryStepper from "./stepperBiometry";
import ErrorDisplay from "../Error/ErrorDisplay";

interface AddUserModalProps {
    visible: boolean;
    onClose: () => void;
    onUserAdded: () => void;
    userToEdit: UsuarioCompleto | null;
    user: UsuarioCompleto | null;
    currentUser?: UsuarioCompleto | null;
    onOpenSystemModal?: () => void;
}

export default function AddUserModal({
    visible,
    onClose,
    onUserAdded,
    userToEdit,
    user,
    onOpenSystemModal,
    currentUser
}: AddUserModalProps) {
    const [formData, setFormData] = useState({
        tipo: userToEdit?.tipo || ("ESTUDANTE" as TipoS),
        nome: userToEdit?.nome || "",
        identificador: userToEdit?.identificador.toString() || "",
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
    const [erroBiometria, setErroBiometria] = useState<string | null>(null);
    const [detalhesErro, setDetalhesErro] = useState<string | null>(null);

    const [usuarioCriado, setUsuarioCriado] = useState<{ id: number, nome: string, identificador: string } | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const modalAtivoRef = useRef(false);
    const pollingControllerRef = useRef<AbortController | null>(null);

    // ==================== SISTEMA DE POLLING PARA WEBHOOK ====================

    const iniciarPollingBiometria = async () => {
        // console.log('🔄 [WEBHOOK] Iniciando polling para status da biometria...');
        console.log('🚀 [POLLING] 🔥 INICIANDO SISTEMA DE POLLING 🔥');
        console.log('📱 Modal ativo:', modalAtivoRef.current);
        console.log('🔧 Cadastrando biometria:', cadastrandoBiometria);
        let tentativas = 0;
        const maxTentativas = 300;

        const poll = async () => {
            if (!modalAtivoRef.current) {
                // console.log('🛑 Polling interrompido - modal fechado');
                return;
            }

            try {
                tentativas++;
                // console.log(`🔍 [WEBHOOK] Polling biometria - tentativa ${tentativas}, etapa atual: ${etapaAtual}`);

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
                // console.log('📊 [WEBHOOK] Resposta da biometria:', {
                //     etapa: result.etapa,
                //     mensagem: result.mensagem,
                //     dados: result.dados
                // });

                if (!modalAtivoRef.current) {
                    // console.log('🛑 Modal fechado durante o polling');
                    return;
                }

                // ✅ CORREÇÃO: ATUALIZAR ETAPA MESMO SE FOR A MESMA (para garantir sincronização)
                if (result.etapa) {
                    // console.log('💬 [WEBHOOK] Nova etapa detectada:', result.etapa);
                    setEtapaAtual(result.etapa);

                    // ✅ ATUALIZAR MENSAGEM TAMBÉM SE DISPONÍVEL
                    if (result.mensagem) {
                        // console.log('💬 Mensagem:', result.mensagem);
                    }
                }

                // ✅ CORREÇÃO: EXPANDIR CONDIÇÕES DE PARADA
                const etapasFinais = ['finalizado', 'sucesso', 'biometria_cadastrada', 'completo'];
                const etapasErro = ['erro', 'cancelado', 'error', 'timeout', 'erro_conexao'];

                if (etapasFinais.includes(result.etapa)) {
                    // console.log('✅ [WEBHOOK] Cadastro de biometria concluído com sucesso!');
                    await tratarSucessoBiometria(result);
                    return;

                } else if (etapasErro.includes(result.etapa)) {
                    // console.error('❌ [WEBHOOK] Erro no cadastro de biometria');
                    await tratarErroBiometria();
                    return;

                } else if (tentativas >= maxTentativas) {
                    // console.error('⏰ [WEBHOOK] Timeout no cadastro de biometria');
                    await tratarTimeoutBiometria();
                    return;

                } else {
                    // ✅ CORREÇÃO: INTERVALO MAIS CURTO PARA CAPTURAR TODAS AS ETAPAS
                    if (modalAtivoRef.current) {
                        pollingRef.current = setTimeout(poll, 300); // ✅ 300ms em vez de 500ms
                    }
                }

            } catch (error: any) {
                // console.error('❌ [WEBHOOK] Erro no polling de biometria:', error);

                if (modalAtivoRef.current && tentativas < maxTentativas) {
                    pollingRef.current = setTimeout(poll, 1000);
                } else if (modalAtivoRef.current) {
                    // console.error('🔴 [WEBHOOK] Máximo de tentativas atingido');
                    await tratarErroConexao();
                }
            }
        };

        if (modalAtivoRef.current) {
            poll(); // ✅ INICIAR IMEDIATAMENTE
        }
    };

    // ==================== FUNÇÃO DE POLLING QUE FALTAVA ====================

    const verificarEstadoBiometria = async () => {
        // ✅ SEMPRE verificar se o modal ainda está ativo
        if (!modalAtivoRef.current) {
            console.log('🛑 [POLLING] Modal fechado - parando polling');
            return;
        }

        try {
            console.log('🔄 [POLLING] Verificando estado...');

            const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
            const response = await fetch(`${API_BASE}/biometry`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('📊 [POLLING] Etapa recebida:', result.etapa);

            // ✅ ATUALIZAR ETAPA SEMPRE
            setEtapaAtual(result.etapa);

            // ✅ VERIFICAR SE É ERRO
            if (result.etapa === 'erro' || !result.success) {
                console.log('❌ [POLLING] Erro detectado');
                await tratarErroBiometria(result);
                return;
            }

            // ✅ VERIFICAR SE É ETAPA FINAL
            const etapasFinais = ['finalizado', 'sucesso', 'biometria_cadastrada'];
            if (etapasFinais.includes(result.etapa)) {
                console.log('✅ [POLLING] Etapa final alcançada - parando polling');
                await tratarSucessoBiometria(result);
                return;
            }

            // ✅ CONTINUAR POLLING (mesmo se der erro, mas modal ainda ativo)
            if (modalAtivoRef.current) {
                console.log('⏰ [POLLING] Agendando próximo check em 300ms');
                pollingRef.current = setTimeout(verificarEstadoBiometria, 300);
            }

        } catch (error: any) {
            console.error('💥 [POLLING] Erro:', error);

            // ✅ CONTINUAR POLLING MESMO COM ERRO (tentar reconectar)
            if (modalAtivoRef.current) {
                console.log('🔄 [POLLING] Tentando reconectar em 1s...');
                pollingRef.current = setTimeout(verificarEstadoBiometria, 1000);
            }
        }
    };

    // ✅ TRATAMENTO DE SUCESSO
    const tratarSucessoBiometria = async (dados: any) => {
        pararPollingBiometria();

        if (!modalAtivoRef.current) return;

        setEtapaAtual('sucesso');

        // Registrar log de sucesso
        if (usuarioCriado) {
            await databaseService.createActionLog({
                id_usuario: usuarioCriado.id,
                identificador: usuarioCriado.identificador,
                acao: 'CADASTRAR_BIOMETRIA',
                status: 'SUCESSO',
                detalhes: `Biometria cadastrada com sucesso! Posição: ${dados.dados?.posicao || 'N/A'} -  Autor:${currentUser?.nome} `,
                nome_usuario: usuarioCriado.nome
            });
        }

        setCadastrandoBiometria(false);

        // Fechar modal após sucesso (apenas para novos usuários)
        if (!userToEdit) {
            setTimeout(() => {
                if (modalAtivoRef.current) {
                    onUserAdded();
                    onClose();
                }
            }, 3000);
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

            // console.log('🛑 Cadastro de biometria cancelado pelo usuário');

        } catch (error) {
            console.error('❌ Erro ao cancelar cadastro:', error);
        }
    };
    const tratarErroBiometria = async (dadosErro?: any) => {
        console.log('🎯 [FRONTEND] tratarErroBiometria CHAMADO - dadosRecebidos:', dadosErro);

        pararPollingBiometria();

        if (!modalAtivoRef.current) {
            console.log('⚠️ Modal fechado - ignorando erro');
            return;
        }

        setEtapaAtual('erro');
        // setCadastrandoBiometria(false);

        // EXTRAIR MENSAGEM DE MÚLTIPLAS FONTES POSSÍVEIS
        let mensagemErro = 'Erro, tente novamenente.';
        let detalhes = '';

        // Fonte 1: mensagem direta do webhook
        if (dadosErro?.mensagem) {
            mensagemErro = dadosErro.mensagem;
            console.log('✅ Usando mensagem do webhook:', mensagemErro);
        }
        // Fonte 2: erro técnico dos dados
        else if (dadosErro?.dados?.erro_tecnico) {
            mensagemErro = dadosErro.dados.erro_tecnico;
            console.log('✅ Usando erro_tecnico dos dados:', mensagemErro);
        }
        // Fonte 3: etapa com erro
        else if (dadosErro?.etapa === 'erro') {
            mensagemErro = 'Erro durante o processo de cadastro';
            console.log('✅ Erro detectado pela etapa');
        }

        // Coletar detalhes para debug
        if (dadosErro?.dados) {
            detalhes = JSON.stringify(dadosErro.dados, null, 2);
        } else if (dadosErro) {
            detalhes = JSON.stringify(dadosErro, null, 2);
        }

        console.log('🎯 [FRONTEND] Mensagem final do erro:', mensagemErro);

        setErroBiometria(mensagemErro);
        setDetalhesErro(detalhes);

        // Log no banco
        if (usuarioCriado) {
            try {
                await databaseService.createActionLog({
                    id_usuario: usuarioCriado.id,
                    identificador: usuarioCriado.identificador,
                    acao: 'CADASTRAR_BIOMETRIA',  // ✅ CORRIGIDO
                    status: 'ERRO',
                    detalhes: `Falha: ${mensagemErro}`,
                    nome_usuario: usuarioCriado.nome
                });
            } catch (logError) {
                console.error('❌ Erro ao salvar log:', logError);
            }
        }
    };

    // ⏰ TRATAMENTO DE TIMEOUT
    const tratarTimeoutBiometria = async () => {
        pararPollingBiometria();

        if (modalAtivoRef.current) {
            setEtapaAtual('timeout');
            setErroBiometria('Timeout - O processo de cadastro demorou muito tempo');
            setDetalhesErro('O cadastro não foi concluído dentro do tempo esperado.');
        }
    };

    const limparErroETentarNovamente = () => {
        setErroBiometria(null);
        setDetalhesErro(null);
        setEtapaAtual('');
        setCadastrandoBiometria(false);

        // Dar um pequeno delay antes de tentar novamente
        setTimeout(() => {
            if (modalAtivoRef.current) {
                iniciarCadastroBiometria();
            }
        }, 500);
    };

    // 🔌 TRATAMENTO DE ERRO DE CONEXÃO
    const tratarErroConexao = async () => {
        pararPollingBiometria();

        if (modalAtivoRef.current) {
            setEtapaAtual('erro_conexao');
            setCadastrandoBiometria(false);
        }
    };

    const cancelarELimparErro = () => {
        setErroBiometria(null);
        setDetalhesErro(null);
        setEtapaAtual('');
        setCadastrandoBiometria(false);
    };

    const pararPollingBiometria = () => {
        // console.log('🛑 [WEBHOOK] Parando polling de biometria...');
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
        // console.log(`📱 Modal ${visible ? 'ABERTO' : 'FECHADO'}`);

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
            setUsuarioCriado(null);
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
        if (userToEdit) {
            // console.log('📥 Carregando usuário para edição:', userToEdit);
            setFormData({
                tipo: userToEdit.tipo,
                nome: userToEdit.nome,
                identificador: userToEdit.identificador.toString(),
            });

            setImagemFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
            }

            if (userToEdit.tem_imagem || userToEdit.imagem_path) {
                loadUserImage(userToEdit);
            }
            setUsuarioCriado(null);
        } else {
            // console.log('🆕 Modo criação - resetando formulário');
            setFormData({
                tipo: "ESTUDANTE" as TipoS,
                nome: "",
                identificador: "",
            });
            setImagemFile(null);
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
            setPreviewUrl(null);
            setUsuarioCriado(null);
        }
    }, [userToEdit, visible]);

    const loadUserImage = async (user: UsuarioCompleto) => {
        try {
            setImageLoading(true);
            const imageUrl = databaseService.getUserImageUrl(user);

            if (imageUrl) {
                setPreviewUrl(imageUrl);
            } else {
                setPreviewUrl(null);
            }
        } catch (error) {
            console.error("Erro ao carregar imagem do usuário:", error);
            setPreviewUrl(null);
        } finally {
            setImageLoading(false);
        }
    };

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
        if (usuarioCriado && !userToEdit) {
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
        if (usuarioCriado && !userToEdit) {
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
            // console.log('🛑 Cadastro de biometria cancelado - modal fechado');
            return false;
        }

        try {
            setCadastrandoBiometria(true);
            setEtapaAtual('iniciando');

            // console.log('📤 [WEBHOOK] Enviando dados para cadastro de biometria:', { userId, identificador, nome });

            const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            // ✅ CORREÇÃO: ADICIONAR WEBHOOK_URL
            const response = await fetch(`${API_BASE}/catraca/iniciar-cadastro`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_id: userId,
                    identificador: identificador,
                    nome: nome,
                    webhook_url: `${process.env.NEXT_PUBLIC_API_URL || ''}/webhook/biometria` // ✅ ADICIONAR ESTA LINHA
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            const result = await response.json();
            // console.log('📨 [WEBHOOK] Resposta do cadastro de biometria:', result);

            if (!modalAtivoRef.current) {
                // console.log('🛑 Cadastro de biometria interrompido - modal fechado');
                return false;
            }

            if (result.success) {
                setEtapaAtual('conectado');

                // ✅ CORREÇÃO: INICIAR POLLING IMEDIATAMENTE
                // console.log('🎯 Iniciando polling imediato para webhook...');
                iniciarPollingBiometria(); // ✅ REMOVER O setTimeout

                return true;
            } else {
                if (modalAtivoRef.current) {
                    setEtapaAtual('erro_inicial');
                    setCadastrandoBiometria(false);

                    await databaseService.createActionLog({
                        id_usuario: userId,
                        identificador: identificador,
                        acao: 'CADASTRAR_BIOMETRIA',
                        status: 'ERRO',
                        detalhes: `Falha: ${result.error}`,
                        nome_usuario: nome
                    });
                }

                return false;
            }
        } catch (error: any) {
            console.error('❌ [WEBHOOK] Erro no cadastro de biometria:', error);

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
            alert("Por favor, preencha o nome do usuário.");
            return;
        }

        if (!formData.identificador.trim()) {
            alert("Por favor, preencha o RA/Matrícula.");
            return;
        }

        if (formData.tipo === "ESTUDANTE" && !/^\d{13}$/.test(formData.identificador)) {
            alert("O RA deve conter exatamente 13 números.");
            return;
        }

        if (formData.tipo === "FUNCIONARIO" && !/^\d{5}$/.test(formData.identificador)) {
            alert("A matrícula deve conter exatamente 5 números.");
            return;
        }

        try {
            setLoading(true);

            if (userToEdit) {
                const result = await databaseService.updateUser(userToEdit.id, {
                    ...formData,
                    tipo: formData.tipo,
                    identificador: formData.identificador,
                });

                if (imagemFile) {
                    await databaseService.processAndUploadUserImage(
                        userToEdit.id,
                        formData.identificador,
                        imagemFile
                    );
                }

                if (result.success) {
                    alert("Usuário editado com sucesso!");
                    onUserAdded();
                    onClose();
                } else {
                    alert(result.error || "Não foi possível editar o usuário.");
                }
            } else {
                const result = await databaseService.createUser({
                    nome: formData.nome.trim(),
                    tipo: formData.tipo,
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

                    setUsuarioCriado({
                        id: result.userId,
                        nome: formData.nome.trim(),
                        identificador: formData.identificador.trim()
                    });

                    await databaseService.createActionLog({
                        id_usuario: result.userId,
                        identificador: formData.identificador.trim(),
                        acao: 'CRIAR_USUARIO',
                        status: 'SUCESSO',
                        detalhes: `${formData.tipo} ${formData.nome} cadastrado sem biometria - Autor: ${currentUser?.nome}`,
                        nome_usuario: formData.nome
                    });

                } else {
                    alert(result.error || "Não foi possível criar o usuário.");
                }
            }
        } catch (error: any) {
            console.error("Erro ao salvar usuário:", error);
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
            alert('❌ Identificador do usuário é necessário');
            return;
        }

        if (userToEdit) {
            await cadastrarBiometria(
                userToEdit.id,
                formData.identificador,
                formData.nome
            );
        } else if (usuarioCriado) {
            await cadastrarBiometria(
                usuarioCriado.id,
                usuarioCriado.identificador,
                usuarioCriado.nome
            );
        } else {
            alert('❌ Crie o usuário primeiro antes de cadastrar a biometria');
        }
    };

    const handleClose = () => {
        // console.log('🚪 Fechando modal - iniciando limpeza...');

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
        setUsuarioCriado(null);

        onClose();
    };

    const handleCloseWithoutBiometry = () => {
        // console.log('🚪 Fechando sem biometria - iniciando limpeza...');

        modalAtivoRef.current = false;
        pararPollingBiometria();
        setUsuarioCriado(null);
        setEtapaAtual('');
        onUserAdded();
        onClose();
    };

    const verificarStatusCatraca = async () => {
        try {
            setCatracaStatus('checking');
            // console.log('🔍 Verificando status da catraca...');

            const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

            const response = await fetch(`${API_BASE}/catraca/status`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            // console.log('📨 Status da catraca:', result);

            setCatracaStatus(result.online ? 'online' : 'offline');

        } catch (error) {
            console.error('❌ Erro ao verificar status:', error);
            setCatracaStatus('offline');
        }
    };

    if (!visible) return null;

    const camposBloqueados = !!usuarioCriado && !userToEdit;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-opacity-50">
            <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-hidden shadow-2xl border border-gray-200 mx-4">
                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-gray-200 bg-white">
                    <div className="text-lg font-bold text-gray-800">
                        {userToEdit ? "Editar Usuário" :
                            usuarioCriado ? "Cadastrar Biometria" : "Cadastro de Usuário"}
                    </div>
                    <button
                        className="w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
                        onClick={() => {
                            handleClose();
                            cancelarCadastroBiometria();
                        }}
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
                        <div className="text-base font-semibold text-gray-800 my-5">Foto do Perfil</div>
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
                                        {/* <button
                                            className="px-4 py-2 bg-gray-500 text-white rounded-md text-sm font-medium hover:bg-gray-600"
                                            onClick={switchCamera}
                                        >
                                            🔄 {facingMode === "user" ? "Traseira" : "Frontal"}
                                        </button> */}
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

                    {/* Tipo */}
                    <div className="mb-5">
                        <div className="text-sm font-semibold text-gray-800 mb-2">Tipo</div>
                        <div className="flex flex-col">
                            <div className="flex justify-between gap-2">
                                <button
                                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${formData.tipo === "ESTUDANTE"
                                        ? camposBloqueados
                                            ? "bg-gray-400 border-gray-400 text-white cursor-not-allowed"
                                            : "bg-[#4A90A4] border-[#4A90A4] text-white"
                                        : camposBloqueados
                                            ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                        }`}
                                    onClick={() => !camposBloqueados && setFormData(prev => ({ ...prev, tipo: "ESTUDANTE" }))}
                                    disabled={camposBloqueados}
                                >
                                    Estudante
                                </button>
                                <button
                                    className={`flex-1 py-3 rounded-lg border text-sm font-medium transition-colors ${formData.tipo === "FUNCIONARIO"
                                        ? camposBloqueados
                                            ? "bg-gray-400 border-gray-400 text-white cursor-not-allowed"
                                            : "bg-[#4A90A4] border-[#4A90A4] text-white"
                                        : camposBloqueados
                                            ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                        }`}
                                    onClick={() => !camposBloqueados && setFormData(prev => ({ ...prev, tipo: "FUNCIONARIO" }))}
                                    disabled={camposBloqueados}
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
                            className={`w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 ${camposBloqueados
                                ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                                }`}
                            value={formData.nome}
                            onChange={(e) => {
                                setFormData(prev => ({ ...prev, nome: e.target.value }));
                                const value = e.target.value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '');
                                setFormData(prev => ({ ...prev, nome: value }));
                            }}
                            placeholder="Digite o nome completo"
                            disabled={camposBloqueados}
                        />
                    </div>

                    {/* Identificador */}
                    <div className="mb-4">
                        <div className="text-sm font-semibold text-gray-800 mb-2">
                            {formData.tipo === "FUNCIONARIO" ? "Matrícula" : "RA"}
                        </div>
                        <input
                            type="text"
                            className={`w-full rounded-lg border p-3 text-base outline-none focus:ring-2 focus:ring-opacity-20 ${camposBloqueados
                                ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                                : "bg-gray-50 border-gray-200 text-gray-800 focus:border-[#4A90A4] focus:ring-[#4A90A4]"
                                }`}
                            value={formData.identificador}
                            onChange={(e) => {
                                if (camposBloqueados) return;
                                const value = e.target.value.replace(/\D/g, "");
                                setFormData(prev => ({ ...prev, identificador: value }));
                            }}
                            placeholder={formData.tipo === "FUNCIONARIO" ? "Digite a matrícula" : "Digite o RA"}
                            maxLength={formData.tipo === "FUNCIONARIO" ? 5 : 13}
                            disabled={camposBloqueados}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            {formData.tipo === "FUNCIONARIO"
                                ? "5 dígitos numéricos"
                                : "13 dígitos numéricos"
                            }
                        </p>
                    </div>

                    {/* Biometry Stepper */}
                    {(userToEdit || usuarioCriado) && cadastrandoBiometria && (
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
                                {erroBiometria && (
                                    <ErrorDisplay
                                        error={erroBiometria}
                                        details={detalhesErro || undefined}
                                        showDetails={process.env.NODE_ENV === 'development'}
                                        onRetry={limparErroETentarNovamente}
                                        onCancel={cancelarELimparErro}
                                    />
                                )}
                            </div>
                        </div>
                    )}

                    {/* Botão de cadastrar biometria */}
                    {(userToEdit || usuarioCriado) && (
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
                                        {userToEdit ? 'Cadastrar/Atualizar Biometria' : 'Cadastrar Biometria'}
                                    </>
                                )}
                            </button>
                            <p className="text-xs text-gray-500 mt-1 text-center">
                                {!formData.identificador
                                    ? "Preencha o identificador primeiro"
                                    : catracaStatus !== 'online'
                                        ? "Aguardando conexão com a catraca"
                                        : userToEdit
                                            ? "Clique para cadastrar a digital na catraca"
                                            : "Clique para cadastrar a digital do novo usuário"}
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
                        {!usuarioCriado && (
                            <button
                                className={`w-full rounded-full py-4 text-base font-bold text-white transition-colors flex items-center justify-center ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-[#4A90A4] hover:bg-[#3a7a8a]"
                                    }`}
                                onClick={handleSubmit}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                        {userToEdit ? "Salvando..." : "Cadastrando..."}
                                    </>
                                ) : (
                                    userToEdit ? "Salvar Alterações" : "Cadastrar Usuário"
                                )}
                            </button>
                        )}

                        {usuarioCriado && !userToEdit && (
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