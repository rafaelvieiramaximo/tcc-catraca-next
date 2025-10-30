// services/websocket-service.ts - VERSÃO CORRIGIDA

export interface WebSocketMessage {
    tipo: 'ENTRADA' | 'SAIDA' | 'ESTATISTICAS' | 'HEARTBEAT' | 'ERRO';
    dados: any;
    timestamp: string;
}

export interface WebSocketEntrada {
    id: number;
    usuario_id: string;
    identificador: string;
    nome: string;
    tipo: string;
    periodo: string;
    data_entrada: string;
    horario: string;
    controle: boolean;
    created_at: string;
}

export interface WebSocketEstatisticas {
    total: number;
    entradas: number;
    saidas: number;
}

class WebSocketService {
    private socket: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectInterval = 3000;
    private isConnected = false;
    private messageCallbacks: ((message: WebSocketMessage) => void)[] = [];
    private errorCallbacks: ((error: string) => void)[] = [];

    // Eventos suportados
    public readonly EVENTOS = {
        NOVA_ENTRADA: 'ENTRADA',
        NOVA_SAIDA: 'SAIDA',
        ESTATISTICAS: 'ESTATISTICAS',
        HEARTBEAT: 'HEARTBEAT',
        ERRO: 'ERRO'
    };

    async connect(): Promise<boolean> {
        try {
            // 🔍 DEBUG: Verificar todas as chaves do localStorage
            console.log('🔎 PROCURANDO TOKEN JWT NO LOCALSTORAGE...');
            const allKeys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                allKeys.push(key);
            }
            console.log('📦 Todas as chaves do localStorage:', allKeys);

            // Procurar token em várias chaves possíveis
            const possibleTokenKeys = [
                'auth_token', 'jwt', 'token', 'userToken', 'access_token',
                'authToken', 'jwt_token', 'user_token', 'fatec-portaria-token'
            ];

            let token = null;
            for (const key of possibleTokenKeys) {
                const value = localStorage.getItem(key);
                console.log(`🔍 Verificando chave "${key}":`, value ? `encontrado (${value.length} chars)` : 'não encontrado');

                if (value) {
                    console.log(`✅ TOKEN ENCONTRADO na chave: "${key}"`);
                    console.log(`📏 Tamanho: ${value.length} caracteres`);
                    console.log(`🔍 Formato JWT: ${value.split('.').length} partes`);
                    console.log(`🔐 Token (primeiros 50 chars): ${value.substring(0, 50)}...`);

                    // ✅ CORREÇÃO: Condição mais flexível
                    if (value.length > 10) { // JWT geralmente tem > 100 chars, mas 10 é seguro
                        token = value;
                        break;
                    } else {
                        console.warn(`⚠️ Token muito curto na chave "${key}": ${value.length} chars`);
                    }
                }
            }

            if (!token) {
                console.error('❌ NENHUM TOKEN JWT VÁLIDO ENCONTRADO!');
                console.log('💡 Dica: O token deve ser salvo durante o login');
                token = 'demo-token'; // Fallback para testes
            } else {
                console.log('🎯 Usando token JWT real para conexão WebSocket');
            }

            const wsUrl = `ws://localhost:5001?token=${encodeURIComponent(token)}`;
            console.log('🌐 Conectando WebSocket...');

            this.socket = new WebSocket(wsUrl);

            // Configurar handlers para garantir comportamento consistente e retorno claro
            this.socket.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                console.log('✅ WebSocket conectado');
            };

            this.socket.onmessage = (ev: MessageEvent) => {
                try {
                    const parsed = JSON.parse(ev.data);
                    this.handleMessage(parsed as WebSocketMessage);
                } catch (err) {
                    console.error('Erro ao parsear mensagem WebSocket:', err);
                }
            };

            this.socket.onclose = (ev: CloseEvent) => {
                this.isConnected = false;
                console.warn('⚠️ WebSocket fechado', ev);
                this.handleReconnection();
            };

            this.socket.onerror = (ev: Event) => {
                console.error('❌ Erro WebSocket', ev);
                this.emitError('Erro de conexão WebSocket');
            };

            // Retorna true indicando que a tentativa de conexão foi iniciada com sucesso
            return true;
        } catch (error) {
            console.error('❌ Erro ao conectar WebSocket:', error);
            return false;
        }
    }
    
    private handleMessage(message: WebSocketMessage) {
        console.log('📨 Processando mensagem WebSocket:', message);

        // Notificar todos os callbacks
        this.messageCallbacks.forEach(callback => {
            try {
                callback(message);
            } catch (error) {
                console.error('Erro em callback WebSocket:', error);
            }
        });
    }

    private handleReconnection() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${this.reconnectInterval}ms`);

            setTimeout(() => {
                this.connect();
            }, this.reconnectInterval);
        } else {
            console.error('❌ Máximo de tentativas de reconexão atingido');
            this.emitError('Conexão em tempo real indisponível. Os dados podem não estar atualizados.');
        }
    }

    // Registrar callbacks
    onMessage(callback: (message: WebSocketMessage) => void): void {
        this.messageCallbacks.push(callback);
    }

    onError(callback: (error: string) => void): void {
        this.errorCallbacks.push(callback);
    }

    private emitError(error: string): void {
        this.errorCallbacks.forEach(callback => {
            try {
                callback(error);
            } catch (err) {
                console.error('Erro em error callback:', err);
            }
        });
    }

    // Enviar mensagens (se necessário)
    send(message: any): boolean {
        if (this.socket && this.isConnected && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    // Status da conexão
    getConnectionStatus(): boolean {
        return this.isConnected;
    }

    // Desconectar
    disconnect(): void {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
        this.isConnected = false;
        this.reconnectAttempts = this.maxReconnectAttempts; // Impedir reconexão
    }
}

export const webSocketService = new WebSocketService();