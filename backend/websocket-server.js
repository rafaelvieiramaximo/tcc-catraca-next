// websocket-server.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT,
});

class WebSocketServer {
    constructor(port = 5001) {
        this.port = port;
        this.server = new WebSocket.Server({ port });
        this.clients = new Set();
        this.JWT_SECRET = process.env.JWT_SECRET || 'portaria-secret-key-2024';

        this.setupEventHandlers();
        this.startHeartbeat();

        console.log(`🎯 WebSocket Server inicializado na porta ${port}`);
    }

    setupEventHandlers() {
        this.server.on('connection', (ws, request) => {
            console.log('🔗 Nova conexão WebSocket attempt');

            // Extrair token da URL
            const url = new URL(request.url, `http://${request.headers.host}`);
            const token = url.searchParams.get('token');

            // Autenticação JWT
            if (!this.authenticateConnection(ws, token)) {
                return;
            }

            console.log('✅ Cliente WebSocket autenticado e conectado');
            this.clients.add(ws);

            // Enviar estatísticas iniciais
            this.sendInitialData(ws);

            // Event handlers para este cliente
            ws.on('message', (message) => this.handleMessage(ws, message));
            ws.on('close', () => this.handleDisconnection(ws));
            ws.on('error', (error) => this.handleError(ws, error));
        });
    }

    authenticateConnection(ws, token) {
        console.log('🔐 Token recebido no backend:', token);
        console.log('📏 Comprimento do token:', token?.length);

        // ✅ PRIMEIRO: ACEITAR demo-token TEMPORARIAMENTE
        if (token === 'demo-token') {
            console.log('✅ Conexão WebSocket aceita (modo demo)');
            ws.userId = 'demo-user';
            ws.userRole = 'demo';
            ws.identificador = 'demo-identificador';
            return true;
        }

        if (!token) {
            console.log('❌ Nenhum token fornecido');
            this.sendError(ws, 'TOKEN_REQUIRED', 'Token JWT é obrigatório');
            ws.close(1008, 'Token não fornecido');
            return false;
        }

        // ✅ SEGUNDO: Verificar se é um JWT válido (3 partes)
        if (token.split('.').length === 3) {
            try {
                console.log('🔑 Verificando token JWT com JWT_SECRET...');
                const decoded = jwt.verify(token, this.JWT_SECRET);
                console.log('✅ Token JWT válido. Decoded:', decoded);

                ws.userId = decoded.userId;
                ws.userRole = decoded.role;
                ws.identificador = decoded.identificador;

                console.log('👤 Usuário autenticado:', {
                    userId: ws.userId,
                    role: ws.userRole,
                    identificador: ws.identificador
                });

                return true;
            } catch (error) {
                console.error('❌ Erro na verificação JWT:', error.message);
                // ❌ NÃO FECHA A CONEXÃO - USA MODO DEMO
                console.log('🔄 Usando modo demo devido a token JWT inválido');
                ws.userId = 'demo-user';
                ws.userRole = 'demo';
                return true;
            }
        }

        // ✅ TERCEIRO: Se não é demo-token nem JWT, ainda aceita como demo
        console.warn('⚠️ Token em formato desconhecido, usando modo demo');
        ws.userId = 'demo-user';
        ws.userRole = 'demo';
        return true;
    }
    
    async sendInitialData(ws) {
        try {
            // Enviar estatísticas atuais
            const stats = await this.getCurrentStats();
            this.sendToClient(ws, {
                tipo: 'ESTATISTICAS',
                dados: stats,
                timestamp: new Date().toISOString()
            });

            // Enviar últimos 5 registros
            const recentEntries = await this.getRecentEntries(5);
            if (recentEntries && recentEntries.length > 0) {
                recentEntries.forEach(entry => {
                    this.sendToClient(ws, {
                        tipo: entry.controle ? 'SAIDA' : 'ENTRADA',
                        dados: this.formatEntryData(entry),
                        timestamp: new Date().toISOString()
                    });
                });
            }

        } catch (error) {
            console.error('❌ Erro ao enviar dados iniciais:', error);
        }
    }

    async getCurrentStats() {
        try {
            const result = await pool.query(
                `SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN NOT controle THEN 1 END) as entradas,
          COUNT(CASE WHEN controle THEN 1 END) as saidas
        FROM log_entrada 
        WHERE data_entrada = CURRENT_DATE`
            );

            const stats = result.rows[0];

            return {
                total: parseInt(stats.total) || 0,
                entradas: parseInt(stats.entradas) || 0,
                saidas: parseInt(stats.saidas) || 0,
                atualizado_em: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ Erro ao buscar estatísticas:', error);
            return { total: 0, entradas: 0, saidas: 0, atualizado_em: new Date().toISOString() };
        }
    }

    async getRecentEntries(limit = 5) {
        try {
            const result = await pool.query(
                `SELECT le.*, u.nome as usuario_nome
         FROM log_entrada le
         INNER JOIN usuario u ON le.usuario_id = u.id
         WHERE le.data_entrada = CURRENT_DATE
         ORDER BY le.created_at DESC
         LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao buscar registros recentes:', error);
            return [];
        }
    }

    handleMessage(ws, message) {
        try {
            const parsedMessage = JSON.parse(message);
            console.log('📨 Mensagem recebida do cliente:', parsedMessage);

            // Aqui você pode adicionar handlers para mensagens específicas do cliente
            switch (parsedMessage.tipo) {
                case 'PING':
                    this.sendToClient(ws, {
                        tipo: 'PONG',
                        dados: { timestamp: new Date().toISOString() },
                        timestamp: new Date().toISOString()
                    });
                    break;
                default:
                    console.log('📝 Mensagem não reconhecida:', parsedMessage.tipo);
            }
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    }

    handleDisconnection(ws) {
        console.log('🔌 Cliente WebSocket desconectado');
        this.clients.delete(ws);
    }

    handleError(ws, error) {
        console.error('❌ Erro WebSocket:', error);
        this.clients.delete(ws);
    }

    // 📢 MÉTODOS DE BROADCAST (para notificar todos os clientes)
    async broadcastNewEntry(entryData) {
        const message = {
            tipo: entryData.controle ? 'SAIDA' : 'ENTRADA',
            dados: this.formatEntryData(entryData),
            timestamp: new Date().toISOString()
        };

        this.broadcast(message);

        // Também atualiza estatísticas para todos
        await this.broadcastStats();
    }

    async broadcastStats() {
        const stats = await this.getCurrentStats();
        const message = {
            tipo: 'ESTATISTICAS',
            dados: stats,
            timestamp: new Date().toISOString()
        };

        this.broadcast(message);
    }



    broadcast(message) {
        const messageString = JSON.stringify(message);

        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(messageString);
                } catch (error) {
                    console.error('❌ Erro ao enviar mensagem para cliente:', error);
                    this.clients.delete(client);
                }
            }
        });
    }

    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('❌ Erro ao enviar mensagem para cliente específico:', error);
            }
        }
    }

    sendError(ws, code, message) {
        this.sendToClient(ws, {
            tipo: 'ERRO',
            dados: {
                codigo: code,
                mensagem: message,
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        });
    }

    formatEntryData(entry) {
        return {
            id: entry.id,
            usuario_id: entry.usuario_id,
            identificador: entry.identificador,
            nome: entry.nome,
            tipo: entry.tipo,
            periodo: entry.periodo,
            data_entrada: entry.data_entrada,
            horario: entry.horario,
            controle: entry.controle,
            created_at: entry.created_at,
            usuario_nome: entry.usuario_nome
        };
    }

    startHeartbeat() {
        // Heartbeat a cada 30 segundos para manter conexão ativa
        setInterval(() => {
            const heartbeatMessage = {
                tipo: 'HEARTBEAT',
                dados: {
                    timestamp: new Date().toISOString(),
                    conexoes_ativas: this.clients.size
                },
                timestamp: new Date().toISOString()
            };

            this.broadcast(heartbeatMessage);
        }, 30000);
    }

    getStatus() {
        return {
            port: this.port,
            clientsConnected: this.clients.size,
            status: 'RUNNING'
        };
    }
}

module.exports = WebSocketServer;