// services/websocket-service.ts - CORREÇÃO DA PORTA
'use client';

export interface WebSocketMessage {
  tipo: 'ENTRADA' | 'SAIDA' | 'ESTATISTICAS' | 'HEARTBEAT' | 'ERRO' | 'AUTH_SUCCESS' | 'AUTH_ERROR';
  dados: any;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private wsBaseUrl: string;
  private isConnected: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 5;
  private messageHandlers: ((message: WebSocketMessage) => void)[] = [];
  private errorHandlers: ((error: string) => void)[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    // ✅ CORREÇÃO CRÍTICA: Usar porta 5001 do WebSocket Server
    this.wsBaseUrl = 'ws://localhost:5001';
    console.log('🔌 WebSocket URL:', this.wsBaseUrl);
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('✅ WebSocket já conectado');
        resolve(true);
        return;
      }

      try {
        // ✅ PEGAR TOKEN DO LOCALSTORAGE
        const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
        
        if (!token) {
          console.error('❌ Token JWT não encontrado no localStorage');
          this.handleError('Token de autenticação não encontrado');
          resolve(false);
          return;
        }

        console.log('🔑 Token JWT encontrado:', token.substring(0, 20) + '...');
        
        // ✅ CONECTAR COM TOKEN COMO QUERY PARAM NA PORTA CORRETA
        const wsUrl = `${this.wsBaseUrl}?token=${encodeURIComponent(token)}`;
        console.log('🔗 Conectando ao WebSocket:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ Conexão WebSocket estabelecida com sucesso na porta 5001');
          this.isConnected = true;
          this.retryCount = 0;
          
          // ✅ INICIAR HEARTBEAT
          this.heartbeatInterval = setInterval(() => {
            if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
              this.send({ tipo: 'HEARTBEAT', dados: {} });
            }
          }, 30000);
          
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('📨 Mensagem WebSocket recebida:', message.tipo);
            this.messageHandlers.forEach(handler => handler(message));
          } catch (error) {
            console.error('❌ Erro ao processar mensagem WebSocket:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket fechado:', event.code, event.reason);
          this.isConnected = false;
          this.cleanup();
          
          // ✅ RECONECTAR SE NÃO FOI FECHAMENTO INTENCIONAL
          if (event.code !== 1000 && this.retryCount < this.maxRetries) {
            setTimeout(() => {
              this.retryCount++;
              console.log(`🔄 Tentativa de reconexão ${this.retryCount}/${this.maxRetries}`);
              this.connect();
            }, 3000);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ Erro WebSocket:', error);
          this.handleError('Erro na conexão WebSocket');
          this.isConnected = false;
          resolve(false);
        };

      } catch (error) {
        console.error('❌ Erro ao conectar WebSocket:', error);
        resolve(false);
      }
    });
  }

  // ... restante do código permanece igual
  private handleError(error: string) {
    console.error('❌ WebSocket Error:', error);
    this.errorHandlers.forEach(handler => handler(error));
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  send(message: WebSocketMessage) {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    } else {
      console.warn('⚠️ WebSocket não conectado, não foi possível enviar mensagem');
      return false;
    }
  }

  onMessage(handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.push(handler);
  }

  onError(handler: (error: string) => void) {
    this.errorHandlers.push(handler);
  }

  disconnect() {
    console.log('🛑 Desconectando WebSocket...');
    this.isConnected = false;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, 'Disconnect by user');
      this.ws = null;
    }
    
    this.messageHandlers = [];
    this.errorHandlers = [];
  }

  getConnectionStatus(): boolean {
    return this.isConnected && this.ws?.readyState === WebSocket.OPEN;
  }
}

export const webSocketService = new WebSocketService();