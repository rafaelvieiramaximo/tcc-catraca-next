// types/websocket-types.ts

export interface EntradaWebSocket {
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
  usuario_nome?: string;
}

export interface EstatisticasWebSocket {
  total: number;
  entradas: number;
  saidas: number;
  atualizado_em: string;
}

export interface HeartbeatWebSocket {
  timestamp: string;
  conexoes_ativas: number;
}

export interface ErroWebSocket {
  codigo: string;
  mensagem: string;
  timestamp: string;
}

// Mensagens completas do WebSocket
export interface WebSocketEntradaMessage {
  tipo: 'ENTRADA';
  dados: EntradaWebSocket;
  timestamp: string;
}

export interface WebSocketSaidaMessage {
  tipo: 'SAIDA';
  dados: EntradaWebSocket;
  timestamp: string;
}

export interface WebSocketEstatisticasMessage {
  tipo: 'ESTATISTICAS';
  dados: EstatisticasWebSocket;
  timestamp: string;
}

export interface WebSocketHeartbeatMessage {
  tipo: 'HEARTBEAT';
  dados: HeartbeatWebSocket;
  timestamp: string;
}

export interface WebSocketErrorMessage {
  tipo: 'ERRO';
  dados: ErroWebSocket;
  timestamp: string;
}

export type WebSocketMessage = 
  | WebSocketEntradaMessage
  | WebSocketSaidaMessage
  | WebSocketEstatisticasMessage
  | WebSocketHeartbeatMessage
  | WebSocketErrorMessage;