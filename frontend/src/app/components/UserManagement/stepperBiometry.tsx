import React from 'react';

interface BiometryStepperProps {
    currentStep: string;
    isActive: boolean;
}

const BiometryStepper: React.FC<BiometryStepperProps> = ({ currentStep, isActive }) => {
    // 🎯 MAPEAMENTO OTIMIZADO: Python → Stepper (1-5)
    const getStepNumber = (etapa: string): number => {
        const etapaLower = etapa.toLowerCase();
        
        switch(etapaLower) {
            // ETAPA 1: Início e conexão
            case 'iniciando':
            case 'conectado':
            case 'conectando':
            case 'aguardando_primeira':
            case 'inicial':
                return 1;
            
            // ETAPA 2: Primeira capturada e aguardando segunda
            case 'primeira_capturada':
            case 'verificando_existente':
            case 'aguardando_segunda':
            case 'primeira_ok':
                return 2;
            
            // ETAPA 3: Segunda capturada e validando
            case 'segunda_capturada':
            case 'validando':
            case 'validacao_ok':
            case 'comparando_digitais':
                return 3;
            
            // ETAPA 4: Salvando
            case 'salvando':
            case 'armazenando':
            case 'gravando_template':
                return 4;
            
            // ETAPA 5: Finalizado
            case 'finalizado':
            case 'sucesso':
            case 'biometria_cadastrada':
            case 'concluido':
            case 'completo':
                return 5;
            
            // ERRO
            case 'erro':
            case 'erro_inicial':
            case 'erro_conexao':
            case 'timeout':
            case 'cancelado':
            case 'error':
            case 'failed':
            case 'erro_catraca':
                return 0;
            
            default:
                // Para etapas desconhecidas, mantém no passo 1 (inicial)
                if (etapa && etapa !== 'inicial') {
                    console.log('🔍 [STEPPER] Etapa não mapeada:', etapa);
                }
                return 1;
        }
    };

    const stepNumber = getStepNumber(currentStep);

    const steps = [
        { id: 1, label: 'Conectando' },
        { id: 2, label: 'Primeira Leitura' },
        { id: 3, label: 'Segunda Leitura' },
        { id: 4, label: 'Validando' },
        { id: 5, label: 'Concluído' }
    ];

    const getStepStatus = (stepId: number) => {
        if (stepNumber === 0) return 'error';
        if (stepId < stepNumber) return 'completed';
        if (stepId === stepNumber) return 'active';
        return 'pending';
    };

    // Calcular porcentagem de progresso
    const progressPercentage = stepNumber === 0 ? 0 : ((stepNumber - 1) / 4) * 100;

    // Mensagens específicas para cada etapa
    const getStatusMessage = () => {
        if (stepNumber === 0) {
            if (currentStep.toLowerCase().includes('timeout')) {
                return '❌ Tempo esgotado - tente novamente';
            } else if (currentStep.toLowerCase().includes('cancelado')) {
                return '❌ Cadastro cancelado';
            } else if (currentStep.toLowerCase().includes('conexao')) {
                return '❌ Erro de conexão com a catraca';
            } else {
                return '❌ Erro no processo de cadastro';
            }
        }
        if (stepNumber === 1) {
            if (currentStep === 'conectado') {
                return '✅ Conectado com a catraca... Aguardando leitura';
            }
            return '🔌 Conectando com o sensor biométrico...';
        }
        if (stepNumber === 2) {
            if (currentStep === 'primeira_capturada') {
                return '✅ Primeira digital capturada! Aguardando segunda leitura';
            } else if (currentStep === 'verificando_existente') {
                return '🔍 Verificando se digital já está cadastrada...';
            }
            return '👆 Aguardando primeira leitura da digital';
        }
        if (stepNumber === 3) {
            if (currentStep === 'segunda_capturada') {
                return '✅ Segunda digital capturada! Validando...';
            } else if (currentStep === 'validando') {
                return '🔍 Comparando as duas digitais...';
            } else if (currentStep === 'validacao_ok') {
                return '✅ Digitais correspondem! Salvando...';
            }
            return '👆 Aguardando segunda leitura da digital';
        }
        if (stepNumber === 4) {
            return '💾 Salvando digital no sistema...';
        }
        if (stepNumber === 5) {
            return '🎉 Biometria cadastrada com sucesso!';
        }
        return '🔄 Iniciando processo...';
    };

    // Cor baseada no status
    const getStatusColor = () => {
        if (stepNumber === 0) return 'red';
        if (stepNumber === 5) return 'green';
        return 'blue';
    };

    const statusColor = getStatusColor();

    // Verificar se está em estado de erro
    const isErrorState = stepNumber === 0;
    const isCompleted = stepNumber === 5;
    const isInProgress = stepNumber > 0 && stepNumber < 5;

    return (
        <div className="space-y-4">
            {/* Barra de progresso principal */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium text-gray-600">
                        Etapa {stepNumber > 0 ? stepNumber : '-'} de 5
                    </span>
                    <span className={`text-xs font-semibold ${
                        statusColor === 'red' ? 'text-red-600' :
                        statusColor === 'green' ? 'text-green-600' : 'text-blue-600'
                    }`}>
                        {Math.round(progressPercentage)}%
                    </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ease-out ${
                            statusColor === 'red' ? 'bg-red-500' :
                            statusColor === 'green' ? 'bg-green-500' : 'bg-blue-500'
                        } ${isInProgress ? 'animate-pulse' : ''}`}
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            {/* Stepper com números */}
            <div className="relative">
                {/* Linha conectora de fundo */}
                <div 
                    className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" 
                    style={{ left: '10%', right: '10%' }} 
                />
                
                {/* Linha de progresso */}
                {stepNumber > 0 && (
                    <div 
                        className={`absolute top-5 h-0.5 transition-all duration-700 ease-out ${
                            statusColor === 'red' ? 'bg-red-500' :
                            statusColor === 'green' ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ 
                            left: '10%',
                            width: `${(stepNumber - 1) * 20}%`
                        }}
                    />
                )}

                {/* Steps com números */}
                <div className="flex justify-between relative px-0">
                    {steps.map((step, index) => {
                        const status = getStepStatus(step.id);
                        const isFirst = index === 0;
                        const isLast = index === steps.length - 1;
                        
                        return (
                            <div 
                                key={step.id} 
                                className={`flex flex-col items-center ${
                                    isFirst ? 'items-start' : 
                                    isLast ? 'items-end' : 
                                    'items-center'
                                }`}
                                style={{ flex: isFirst || isLast ? '0 0 auto' : '1' }}
                            >
                                {/* Círculo numerado */}
                                <div
                                    className={`
                                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold
                                        transition-all duration-500 border-2 relative z-10
                                        ${status === 'completed'
                                            ? 'bg-green-500 border-green-500 text-white scale-100'
                                            : status === 'active'
                                                ? `${
                                                    statusColor === 'red' ? 'bg-red-500 border-red-500' :
                                                    statusColor === 'green' ? 'bg-green-500 border-green-500' :
                                                    'bg-blue-500 border-blue-500'
                                                } text-white scale-110 shadow-lg ${
                                                    statusColor === 'red' ? 'shadow-red-500/50' :
                                                    statusColor === 'green' ? 'shadow-green-500/50' :
                                                    'shadow-blue-500/50'
                                                }`
                                                : status === 'error'
                                                    ? 'bg-red-500 border-red-500 text-white'
                                                    : 'bg-white border-gray-300 text-gray-400'
                                        }
                                        ${status === 'active' && isInProgress ? 'animate-pulse' : ''}
                                    `}
                                >
                                    {status === 'completed' ? '✓' : step.id}
                                </div>

                                {/* Label */}
                                <div className={`text-center mt-2 ${
                                    isFirst ? 'text-left' : 
                                    isLast ? 'text-right' : 
                                    'text-center'
                                }`} style={{ maxWidth: '80px' }}>
                                    <div className={`text-xs font-medium leading-tight ${
                                        status === 'active' ? 
                                            (statusColor === 'red' ? 'text-red-600' :
                                             statusColor === 'green' ? 'text-green-600' : 'text-blue-600') :
                                        status === 'completed' ? 'text-green-600' : 
                                        'text-gray-500'
                                    }`}>
                                        {step.label}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mensagem de status atual */}
            <div className={`
                mt-4 p-3 rounded-lg text-sm text-center font-medium transition-colors duration-300
                ${isErrorState 
                    ? 'bg-red-50 text-red-700 border border-red-200' 
                    : isCompleted
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                }
            `}>
                {getStatusMessage()}
            </div>

            {/* Indicador de atividade */}
            {isActive && isInProgress && (
                <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-2">
                    <div className={`w-2 h-2 rounded-full animate-ping ${
                        statusColor === 'red' ? 'bg-red-500' :
                        statusColor === 'green' ? 'bg-green-500' : 'bg-blue-500'
                    }`}></div>
                    <span>Processando...</span>
                </div>
            )}

            {process.env.NODE_ENV === 'development' && currentStep && currentStep !== 'inicial' && (
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
                    <div>Debug: Etapa atual = "{currentStep}"</div>
                    <div>Mapeado para: Passo {stepNumber}</div>
                    <div>Ativo: {isActive ? 'Sim' : 'Não'}</div>
                </div>
            )}
        </div>
    );
};

export default BiometryStepper;