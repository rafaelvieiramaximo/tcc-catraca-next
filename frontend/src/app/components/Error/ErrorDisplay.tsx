import React from 'react';

interface ErrorDisplayProps {
    error: string;
    onRetry?: () => void;
    onCancel?: () => void;
    showDetails?: boolean;
    details?: string;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ 
    error, 
    onRetry, 
    onCancel, 
    showDetails = false,
    details 
}) => {
    const getErrorMessage = (errorMsg: string) => {
        const errorLower = errorMsg.toLowerCase();
        
        if (errorLower.includes('timeout')) {
            return {
                title: '⏰ Tempo Esgotado',
                message: 'O tempo para cadastrar a biometria expirou.',
                suggestion: 'Verifique se o sensor está funcionando e tente novamente.'
            };
        }
        
        if (errorLower.includes('digital já cadastrada')) {
            return {
                title: '📝 Digital Já Existe',
                message: 'Esta digital já está cadastrada no sistema.',
                suggestion: 'Use um dedo diferente ou verifique se o usuário já possui biometria.'
            };
        }
        
        if (errorLower.includes('digitais não correspondem')) {
            return {
                title: '👆 Digitais Diferentes',
                message: 'As duas leituras não correspondem.',
                suggestion: 'Use o mesmo dedo nas duas leituras e pressione com a mesma força.'
            };
        }
        
        if (errorLower.includes('disconnected') || errorLower.includes('conexão')) {
            return {
                title: '🔌 Problema no Sensor',
                message: 'Houve um problema de conexão com o sensor biométrico.',
                suggestion: 'Verifique se o sensor está conectado e tente novamente.'
            };
        }
        
        if (errorLower.includes('sensor') || errorLower.includes('device')) {
            return {
                title: '🔧 Erro no Sensor',
                message: 'O sensor biométrico apresentou um erro.',
                suggestion: 'Reinicie o sensor e tente novamente.'
            };
        }
        
        return {
            title: '❌ Erro no Cadastro',
            message: errorMsg,
            suggestion: 'Tente novamente ou contate o suporte técnico.'
        };
    };

    const errorInfo = getErrorMessage(error);

    return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 animate-fade-in">
            <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                    !
                </div>
                <div className="flex-1">
                    <h3 className="text-red-800 font-semibold text-sm mb-1">
                        {errorInfo.title}
                    </h3>
                    <p className="text-red-700 text-sm mb-2">
                        {errorInfo.message}
                    </p>
                    <p className="text-red-600 text-xs mb-3">
                        💡 <strong>Sugestão:</strong> {errorInfo.suggestion}
                    </p>
                    
                    {showDetails && details && (
                        <details className="text-red-600 text-xs">
                            <summary className="cursor-pointer hover:text-red-700">
                                Detalhes técnicos
                            </summary>
                            <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto">
                                {details}
                            </pre>
                        </details>
                    )}
                    
                    <div className="flex gap-2 mt-3">
                        {onRetry && (
                            <button
                                onClick={onRetry}
                                className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                            >
                                🔄 Tentar Novamente
                            </button>
                        )}
                        {onCancel && (
                            <button
                                onClick={onCancel}
                                className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 transition-colors"
                            >
                                ✕ Cancelar
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ErrorDisplay;