const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = 3001;

// Configuração do PostgreSQL
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT,
});

// ==================== CONFIGURAÇÃO MULTER ====================

// Criar pasta assets se não existir
const assetsDir = path.join(__dirname, 'assets');
const usersImagesDir = path.join(assetsDir, 'users');
if (!fs.existsSync(usersImagesDir)) {
  fs.mkdirSync(usersImagesDir, { recursive: true });
  console.log('✅ Pasta assets/users criada com sucesso');
}

// Usar memoryStorage
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas imagens são permitidas!'), false);
    }
  }
});

// ==================== MIDDLEWARES ====================

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/assets', express.static(assetsDir));

// Middleware de log
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});
// ==================== ESTADO GLOBAL BIOMETRIA ====================

// Estado principal para compatibilidade
let biometriaState = {
  etapa: '',
  mensagem: 'Aguardando início do cadastro',
  dados: null,
  timestamp: new Date().toISOString(),
  success: true
};

// ==================== NOVOS ENDPOINTS PARA POLLING ====================

app.get('/api/check-new-entries', async (req, res) => {
  try {
    const { last_check, last_change_count } = req.query;

    // Buscar informações da tabela de controle
    const result = await pool.query(
      `SELECT last_change, change_count 
       FROM system_changes 
       WHERE table_name = 'log_entrada'`
    );

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        has_changes: false,
        last_change: new Date().toISOString(),
        change_count: 0
      });
    }

    const systemData = result.rows[0];
    const lastChangeTime = systemData.last_change;
    const currentChangeCount = parseInt(systemData.change_count) || 0;
    const lastChangeCount = parseInt(last_change_count) || 0;

    // ✅ DETECTAR MUDANÇAS PELA CONTAGEM (MAIS CONFIÁVEL)
    const hasChanges = currentChangeCount > lastChangeCount;

    // console.log('🔍 Verificando mudanças:', {
    //   lastChangeCount,
    //   currentChangeCount,
    //   hasChanges,
    //   lastChangeTime
    // });

    res.json({
      success: true,
      has_changes: hasChanges,
      last_change: lastChangeTime,
      change_count: currentChangeCount,
      current_time: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao verificar novas entradas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar novas entradas'
    });
  }
});

app.get('/api/recent-entries', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await pool.query(
      `SELECT le.*, u.nome as usuario_nome
       FROM log_entrada le
       INNER JOIN usuario u ON le.usuario_id = u.id
       WHERE le.data_entrada = CURRENT_DATE
       ORDER BY le.created_at DESC
       LIMIT $1`,
      [parseInt(limit)]
    );

    res.json({
      success: true,
      entries: result.rows,
      total: result.rows.length,
      last_updated: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Erro ao buscar entradas recentes:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar entradas recentes'
    });
  }
});

// ==================== NOVO ENDPOINT PARA WEBHOOK ====================

// ✅ CORREÇÃO: Usar URL configurável
const getWebhookUrl = () => {
  return `${process.env.NODE_SERVER_URL}/webhook/biometria`;
};

// ✅ CORREÇÃO: Estado por sessão (opcional, mas recomendado)
const biometriaSessions = new Map();
let currentSessionId = null;

app.post('/api/webhook/biometria', express.json(), (req, res) => {
  try {
    const { etapa, mensagem, dados, success, session_id } = req.body;

    console.log('📨 [WEBHOOK] Recebido do Python:', {
      session_id,
      etapa,
      mensagem,
      dados,
      success,
      timestamp: new Date().toISOString()
    });

    if (!etapa) {
      return res.status(400).json({
        success: false,
        error: 'Campo "etapa" é obrigatório'
      });
    }

    // ✅ CORREÇÃO: Gerenciar múltiplas sessões (opcional)
    const sessionKey = session_id || 'default';

    if (!biometriaSessions.has(sessionKey)) {
      biometriaSessions.set(sessionKey, {
        etapa: 'inicial',
        mensagem: 'Aguardando início do cadastro',
        dados: null,
        timestamp: new Date().toISOString()
      });
    }

    const sessionState = biometriaSessions.get(sessionKey);
    sessionState.etapa = etapa;
    sessionState.mensagem = mensagem || 'Processando...';
    sessionState.dados = dados || null;
    sessionState.success = success !== undefined ? success : true;
    sessionState.timestamp = new Date().toISOString();

    // ✅ CORREÇÃO: Manter sessão atual para compatibilidade
    biometriaState = sessionState;
    currentSessionId = sessionKey;

    console.log('💾 Estado atualizado via webhook:', {
      session: sessionKey,
      etapa: etapa,
      timestamp: sessionState.timestamp
    });

    res.json({
      success: true,
      message: 'Webhook recebido com sucesso',
      session_id: sessionKey,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao processar webhook'
    });
  }
});

// ✅ Adicione isso no seu backend Node.js para debug
app.get('/api/webhook/biometria', (req, res) => {
  console.log('🔍 [DEBUG] GET recebido no webhook');
  
  res.json({
    success: true,
    message: 'Endpoint de webhook funcionando! Use POST para enviar dados.',
    metodo: 'GET (apenas para teste)',
    estado_atual: biometriaState,
    sessoes_ativas: Array.from(biometriaSessions.entries()),
    timestamp: new Date().toISOString()
  });
});
// ============= ENDPOINT DE STATUS DE BIOMETRIA =============

app.get('/api/biometry', async (req, res) => {
  try {
    const { session_id } = req.query;
    console.log('🔍 [WEBHOOK] Consultando status da biometria...', { session_id });

    // ✅ CORREÇÃO: Buscar estado da sessão específica ou atual
    let estado;
    if (session_id && biometriaSessions.has(session_id)) {
      estado = biometriaSessions.get(session_id);
    } else {
      estado = biometriaState;
    }

    const resposta = {
      success: true,
      etapa: estado.etapa,
      mensagem: estado.mensagem,
      dados: estado.dados,
      timestamp: estado.timestamp,
      metodo: 'webhook',
      session_id: session_id || currentSessionId
    };

    console.log('📤 [NODE → FRONTEND] Estado atual:', resposta.etapa);

    res.json(resposta);

  } catch (error) {
    console.error('❌ [ERRO] Ao consultar status da biometria:', error.message);

    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      detalhes: error.message,
      etapa: 'erro',
      mensagem: 'Erro ao consultar estado da biometria',
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ NOVO: Endpoint para limpar sessões antigas
app.post('/api/biometry/cleanup', async (req, res) => {
  try {
    const { older_than } = req.body; // em minutos
    const cutoffTime = Date.now() - (parseInt(older_than) || 60) * 60 * 1000;

    let cleanedCount = 0;

    for (const [sessionId, session] of biometriaSessions.entries()) {
      const sessionTime = new Date(session.timestamp).getTime();
      if (sessionTime < cutoffTime) {
        biometriaSessions.delete(sessionId);
        cleanedCount++;
      }
    }

    console.log(`🧹 Limpeza: ${cleanedCount} sessões removidas`);

    res.json({
      success: true,
      message: `Limpeza concluída: ${cleanedCount} sessões removidas`,
      remaining_sessions: biometriaSessions.size
    });

  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao limpar sessões'
    });
  }
});

// ==================== CANCELAR CADASTRO ====================

app.post('/api/cancelar-cadastro', async (req, res) => {
  try {
    console.log('🛑 [CANCELAR] Recebido cancelamento de cadastro...');

    // Atualizar estado global para cancelado
    biometriaState = {
      etapa: 'cancelado',
      mensagem: 'Cadastro cancelado pelo usuário',
      dados: null,
      timestamp: new Date().toISOString(),
      success: false
    };

    // Limpar todas as sessões ativas
    biometriaSessions.clear();
    currentSessionId = null;

    console.log('✅ Estado atualizado para cancelado');

    res.json({
      success: true,
      message: 'Cadastro cancelado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar cadastro:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno ao cancelar cadastro'
    });
  }
});
// ==================== ENDPOINT DE UPLOAD ====================

app.put('/api/users/:id/image-file', upload.single('image'), async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('📤 Iniciando upload de imagem...');

    await client.query('BEGIN');

    const { id } = req.params;
    const { identificador } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Nenhuma imagem fornecida' });
    }

    if (!identificador) {
      return res.status(400).json({ error: 'Identificador é obrigatório' });
    }

    // Verificar se usuário existe
    const userCheck = await client.query('SELECT id, identificador FROM usuario WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Salvar arquivo manualmente
    const filename = `${identificador}.jpg`;
    const imagePath = `assets/users/${filename}`;
    const filePath = path.join(usersImagesDir, filename);

    fs.writeFileSync(filePath, req.file.buffer);
    console.log('💾 Arquivo salvo em:', filePath);

    await client.query(
      'UPDATE usuario SET imagem_path = $1 WHERE id = $2',
      [imagePath, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Imagem atualizada com sucesso',
      imagePath: imagePath,
      filename: filename
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload image file error:', error);
    res.status(500).json({ error: 'Erro ao atualizar imagem' });
  } finally {
    client.release();
  }
});

// ==================== ENDPOINTS DE IMAGENS ====================

app.get('/api/users/:id/image', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT imagem_path FROM usuario WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (user.imagem_path) {
      const filename = path.basename(user.imagem_path);
      const filePath = path.join(usersImagesDir, filename);

      if (fs.existsSync(filePath)) {
        return res.sendFile(filePath);
      }
    }

    return res.status(404).json({ error: 'Imagem não encontrada' });

  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Erro ao obter imagem' });
  }
});

app.delete('/api/users/:id/image', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const userCheck = await client.query(
      'SELECT imagem_path FROM usuario WHERE id = $1',
      [id]
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const imagemPath = userCheck.rows[0].imagem_path;

    if (imagemPath) {
      const filename = path.basename(imagemPath);
      const filePath = path.join(usersImagesDir, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await client.query(
      'UPDATE usuario SET imagem_path = NULL WHERE id = $1',
      [id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Imagem removida com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete image error:', error);
    res.status(500).json({ error: 'Erro ao remover imagem' });
  } finally {
    client.release();
  }
});

// ==================== AUTENTICAÇÃO ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { tipo, identificador, senha } = req.body;

    if (!tipo || !identificador || !senha) {
      return res.status(400).json({ error: 'Dados de login incompletos' });
    }

    let query, params;

    if (tipo === 'ADMIN') {
      query = `
        SELECT u.*, a.id_admin, 'ADMIN'::text AS tipo
        FROM usuario u
        JOIN admin a ON u.id = a.usuario_id
        WHERE a.id_admin = $1 AND a.senha = crypt($2, a.senha)
      `;
      params = [identificador, senha];
    } else if (tipo === 'PORTARIA') {
      query = `
        SELECT u.*, f.matricula, 'PORTARIA'::text AS tipo
        FROM usuario u
        JOIN portaria f ON u.id = f.usuario_id
        WHERE f.matricula = $1 AND f.senha = crypt($2, f.senha)
      `;
      params = [identificador, senha];
    } else if (tipo === 'RH') {
      query = `
        SELECT u.*, rh.matricula, 'RH'::text AS tipo
        FROM usuario u
        JOIN rh ON u.id = rh.usuario_id
        WHERE rh.matricula = $1 AND rh.senha = crypt($2, rh.senha)
      `;
      params = [identificador, senha];
    } else {
      return res.status(400).json({ error: 'Tipo de usuário inválido' });
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];

    if (user.imagem_path) {
      user.imagem_url = `http://localhost:${port}/${user.imagem_path}`;
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.tipo,
        identificador: user.identificador
      },
      process.env.JWT_SECRET || 'portaria-secret-key-2024',
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      user,
      token,
      message: 'Login realizado com sucesso'
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==================== USUÁRIOS ====================

app.get('/api/users', async (req, res) => {
  try {
    const query = `
      SELECT 
        id, 
        nome, 
        tipo, 
        identificador, 
        created_at, 
        updated_at,
        imagem_path,
        CASE 
          WHEN imagem_path IS NOT NULL THEN true
          ELSE false 
        END as tem_imagem
      FROM usuario 
      ORDER BY nome
    `;

    const result = await pool.query(query);

    const users = result.rows.map(user => ({
      ...user,
      imagem_url: user.imagem_path ? `http://localhost:${port}/${user.imagem_path}` : null
    }));

    res.json({
      success: true,
      users: users
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        id, 
        nome, 
        tipo, 
        identificador, 
        created_at, 
        updated_at,
        imagem_path,
        CASE 
          WHEN imagem_path IS NOT NULL THEN true
          ELSE false 
        END as tem_imagem
      FROM usuario 
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const user = result.rows[0];

    if (user.imagem_path) {
      user.imagem_url = `http://localhost:${port}/${user.imagem_path}`;
    }

    res.json({
      success: true,
      user
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

app.post('/api/users', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { nome, tipo, identificador } = req.body;

    if (!nome || !tipo || !identificador) {
      return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    }

    if (!['ESTUDANTE', 'FUNCIONARIO', 'VISITANTE'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido para esta rota' });
    }

    console.log(`👤 Criando usuário: ${nome} (${tipo} - ${identificador})`);

    const { rows } = await client.query(
      'INSERT INTO usuario (nome, tipo, identificador) VALUES ($1, $2, $3) RETURNING id',
      [nome, tipo, identificador]
    );
    const userId = rows[0].id;

    console.log(`✅ Usuário base criado com ID: ${userId}`);

    await client.query('COMMIT');

    await client.query(
      `INSERT INTO log (id_usuario, identificador, acao, status, detalhes, nome_usuario)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, identificador, 'CRIAR_USUARIO', 'SUCESSO',
        `Usuário ${tipo} criado`, nome]
    );

    console.log(`🎉 Usuário criado com sucesso! ID: ${userId}`);

    return res.status(201).json({ success: true, userId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create user error:', err);

    await pool.query(
      `INSERT INTO log (identificador, acao, status, detalhes, nome_usuario)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.body.identificador, 'CRIAR_USUARIO', 'ERRO',
      `Falha: ${err.message}`, req.body.nome]
    );

    if (err.code === '23505') {
      return res.status(409).json({ error: 'Identificador já cadastrado' });
    }
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  } finally {
    client.release();
  }
});

app.put('/api/users/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { nome, tipo, identificador } = req.body;

    let updateFields = [];
    let updateValues = [];
    let idx = 1;

    if (nome) {
      updateFields.push(`nome = $${idx++}`);
      updateValues.push(nome);
    }
    if (tipo) {
      updateFields.push(`tipo = $${idx++}`);
      updateValues.push(tipo);
    }
    if (identificador) {
      updateFields.push(`identificador = $${idx++}`);
      updateValues.push(identificador);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id = $${idx}`;
    updateValues.push(id);

    await client.query(query, updateValues);
    await client.query('COMMIT');

    const updatedUserQuery = `
      SELECT 
        id, 
        nome, 
        tipo, 
        identificador, 
        created_at, 
        updated_at,
        imagem_path,
        CASE 
          WHEN imagem_path IS NOT NULL THEN true
          ELSE false 
        END as tem_imagem
      FROM usuario 
      WHERE id = $1
    `;
    const updatedUserResult = await client.query(updatedUserQuery, [id]);

    const user = updatedUserResult.rows[0];

    if (user.imagem_path) {
      user.imagem_url = `http://localhost:${port}/${user.imagem_path}`;
    }

    res.json({
      success: true,
      user: user,
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  } finally {
    client.release();
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const userCheck = await client.query('SELECT imagem_path FROM usuario WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const imagemPath = userCheck.rows[0].imagem_path;
    if (imagemPath) {
      const filename = path.basename(imagemPath);
      const filePath = path.join(usersImagesDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    await client.query('DELETE FROM user_finger WHERE user_id = $1', [id]);
    await client.query('DELETE FROM usuario WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);

    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Não foi possível excluir o usuário. Existem registros vinculados.'
      });
    }

    res.status(500).json({ error: 'Erro ao excluir usuário' });
  } finally {
    client.release();
  }
});

// ==================== ENDPOINTS FINGER ====================

app.get('/api/users/:id/finger', async (req, res) => {
  try {
    const userId = req.params.id;

    const query = `
      SELECT 
        user_id,
        template_position
      FROM user_finger 
      WHERE user_id = $1
      ORDER BY template_position
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        user_id: userId,
        has_fingerprint: false,
        fingerprints: [],
        fingerprint_count: 0
      });
    }

    res.json({
      user_id: userId,
      has_fingerprint: true,
      fingerprints: result.rows,
      fingerprint_count: result.rows.length
    });

  } catch (error) {
    console.error('Error fetching finger data:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.get('/api/users/fingerprints/status', async (req, res) => {
  try {
    const query = `
      SELECT 
        u.id as user_id,
        u.nome,
        u.tipo,
        u.identificador,
        u.imagem_path,
        COUNT(uf.template_position) as fingerprint_count,
        CASE 
          WHEN COUNT(uf.template_position) > 0 THEN true 
          ELSE false 
        END as has_fingerprint,
        ARRAY_AGG(uf.template_position) as fingerprint_positions
      FROM usuario u
      LEFT JOIN user_finger uf ON u.id = uf.user_id
      GROUP BY u.id, u.nome, u.tipo, u.identificador, u.imagem_path
      ORDER BY u.nome
    `;

    const result = await pool.query(query);

    res.json({
      success: true,
      users: result.rows,
      total_users: result.rows.length,
      users_with_fingerprint: result.rows.filter(user => user.has_fingerprint).length,
      users_without_fingerprint: result.rows.filter(user => !user.has_fingerprint).length
    });

  } catch (error) {
    console.error('Error fetching fingerprints status:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

app.post('/api/users/system', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { nome, tipo, identificador, senha } = req.body;

    if (!nome || !tipo || !identificador || !senha) {
      return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
    }

    if (!['ADMIN', 'PORTARIA', 'RH'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo de usuário do sistema inválido' });
    }

    console.log(`👤 Criando usuário do sistema: ${nome} (${tipo} - ${identificador})`);

    // 1. Criar usuário na tabela usuario
    const { rows } = await client.query(
      'INSERT INTO usuario (nome, tipo, identificador) VALUES ($1, $2, $3) RETURNING id',
      [nome, tipo, identificador]
    );
    const userId = rows[0].id;

    console.log(`✅ Usuário base criado com ID: ${userId}`);

    // 2. Criar registro na tabela específica com senha criptografada
    if (tipo === 'ADMIN') {
      await client.query(
        'INSERT INTO admin (usuario_id, id_admin, senha) VALUES ($1, $2, crypt($3, gen_salt(\'bf\')))',
        [userId, identificador, senha]
      );
    } else if (tipo === 'PORTARIA') {
      await client.query(
        'INSERT INTO portaria (usuario_id, matricula, senha) VALUES ($1, $2, crypt($3, gen_salt(\'bf\')))',
        [userId, identificador, senha]
      );
    } else if (tipo === 'RH') {
      await client.query(
        'INSERT INTO rh (usuario_id, matricula, senha) VALUES ($1, $2, crypt($3, gen_salt(\'bf\')))',
        [userId, identificador, senha]
      );
    }

    await client.query('COMMIT');

    // 3. Registrar log
    await client.query(
      `INSERT INTO log (id_usuario, identificador, acao, status, detalhes, nome_usuario)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, identificador, 'CRIAR_USUARIO_SISTEMA', 'SUCESSO',
        `Usuário do sistema ${tipo} criado`, nome]
    );

    console.log(`🎉 Usuário do sistema criado com sucesso! ID: ${userId}`);

    res.status(201).json({
      success: true,
      userId,
      message: 'Usuário do sistema criado com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar usuário do sistema:', error);

    // Registrar log de erro
    await pool.query(
      `INSERT INTO log (identificador, acao, status, detalhes, nome_usuario)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.body.identificador, 'CRIAR_USUARIO_SISTEMA', 'ERRO',
      `Falha: ${error.message}`, req.body.nome]
    );

    if (error.code === '23505') {
      return res.status(409).json({ error: 'Identificador já cadastrado' });
    }

    res.status(500).json({ error: `Erro ao criar usuário: ${error.message}` });
  } finally {
    client.release();
  }
});

// ==================== LOG AÇÃO ====================

app.get('/api/logs/action', async (req, res) => {
  try {
    const { limit = 100, offset = 0, usuario_id, acao, data_acao } = req.query;

    let query = `
      SELECT 
        l.data_hora,
        l.acao,
        l.status,
        l.nome_usuario,
        l.detalhes
      FROM log l
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 0;

    if (usuario_id) {
      paramCount++;
      query += ` AND l.id_usuario = $${paramCount}`;
      params.push(usuario_id);
    }
    if (acao) {
      paramCount++;
      query += ` AND l.acao ILIKE $${paramCount}`;
      params.push(`%${acao}%`);
    }
    if (data_acao) {
      paramCount++;
      query += ` AND l.data_acao = $${paramCount}`;
      params.push(data_acao);
    }

    query += ` ORDER BY l.data_hora DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      logs: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get action logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar logs de ação'
    });
  }
});

app.post('/api/logs/action', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id_usuario, identificador, acao, status, detalhes, nome_usuario } = req.body;

    let identificadorFinal = identificador || null;
    let idUsuarioFinal = id_usuario || null;

    if (!idUsuarioFinal && identificadorFinal) {
      const userResult = await client.query(
        'SELECT id FROM usuario WHERE identificador = $1',
        [identificadorFinal]
      );
      if (userResult.rows.length > 0) {
        idUsuarioFinal = userResult.rows[0].id;
      }
    }

    const result = await client.query(
      `INSERT INTO log (id_usuario, identificador, acao, status, detalhes, nome_usuario)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id_log`,
      [idUsuarioFinal, identificadorFinal, acao, status, detalhes || null, nome_usuario || null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      id_log: result.rows[0].id_log,
      message: 'Log de ação criado com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create action log error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao criar log de ação'
    });
  } finally {
    client.release();
  }
});

// ==================== LOG ENTRADA ====================

app.get('/api/logs/entrada', async (req, res) => {
  try {
    const { limit = 100, offset = 0, hoje, usuario_id, periodo, tipo } = req.query;

    let query = `SELECT le.*, u.nome as usuario_nome
      FROM log_entrada le
      INNER JOIN usuario u ON le.usuario_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (hoje === 'true') {
      query += ` AND le.data_entrada = CURRENT_DATE`;
    }

    if (usuario_id) {
      query += ` AND le.usuario_id = $${params.length + 1}`;
      params.push(usuario_id);
    }

    if (periodo) {
      query += ` AND le.periodo = $${params.length + 1}`;
      params.push(periodo.toUpperCase());
    }

    if (tipo) {
      query += ` AND le.tipo = $${params.length + 1}`;
      params.push(tipo.toUpperCase());
    }

    query += ` ORDER BY le.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      logs: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('Get entrada logs error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar logs de entrada'
    });
  }
});

// ==================== ENDPOINTS CATRACA ====================

// Endpoint para verificar status da catraca
app.get('/api/catraca/status', async (req, res) => {
  try {
    console.log('🔍 Verificando status da catraca...');

    const response = await fetch(`${process.env.CATRACA_API_URL}/catraca/status`, {
      method: 'GET',
      timeout: 5000
    });

    if (!response.ok) {
      throw new Error(`Catraca retornou status: ${response.status}`);
    }

    const status = await response.json();

    console.log('✅ Status da catraca:', status);

    res.json({
      success: true,
      online: true,
      modo: status.modo,
      sensor_status: status.sensor_status,
      cadastro_ativo: status.cadastro_ativo
    });

  } catch (error) {
    console.error('❌ Erro ao verificar status da catraca:', error.message);
    res.json({
      success: false,
      online: false,
      error: error.message
    });
  }
});

app.post('/api/catraca/iniciar-cadastro', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🎯 Recebendo requisição para cadastrar biometria:', req.body);

    const { user_id, identificador, nome } = req.body;

    if (!user_id || !identificador) {
      return res.status(400).json({
        success: false,
        error: 'user_id e identificador são obrigatórios'
      });
    }

    // Verificar se usuário existe
    const userCheck = await client.query(
      'SELECT id, nome, identificador FROM usuario WHERE id = $1',
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const usuario = userCheck.rows[0];
    console.log(`👤 Usuário encontrado: ${usuario.nome} (ID: ${usuario.id})`);

    // ✅ CORREÇÃO: Gerar session ID único
    const sessionId = `session_${user_id}_${Date.now()}`;

    // ✅ CORREÇÃO: Resetar estado com session
    biometriaSessions.set(sessionId, {
      etapa: 'iniciando',
      mensagem: 'Iniciando cadastro biométrico...',
      dados: { user_id, identificador, nome },
      success: true,
      timestamp: new Date().toISOString()
    });

    biometriaState = biometriaSessions.get(sessionId);
    currentSessionId = sessionId;

    // ✅ CORREÇÃO: Usar URL configurável do webhook
    const webhookUrl = getWebhookUrl();
    console.log(`🔗 Webhook URL: ${webhookUrl}`);

    // Chamar API da catraca para iniciar cadastro COM WEBHOOK CORRETO
    console.log('🔄 Chamando catraca para cadastrar biometria...');

    const catracaResponse = await fetch(`${process.env.CATRACA_API_URL}/catraca/iniciar-cadastro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: user_id,
        identificador: identificador,
        nome: usuario.nome,
        webhook_url: webhookUrl,
        session_id: sessionId  // ✅ Nova: identificar sessão
      }),
      timeout: 60000
    });

    if (!catracaResponse.ok) {
      throw new Error(`Catraca retornou status: ${catracaResponse.status}`);
    }

    const catracaResult = await catracaResponse.json();
    console.log('📨 Resposta inicial da catraca:', catracaResult);

    if (!catracaResult.success) {
      throw new Error(catracaResult.message || 'Erro no cadastro da biometria');
    }

    console.log('✅ Cadastro iniciado - aguardando webhooks...');

    // Registrar log de início
    await client.query(
      `INSERT INTO log (id_usuario, identificador, acao, status, detalhes, nome_usuario)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user_id, identificador, 'INICIAR_CADASTRO_BIOMETRIA', 'INICIADO',
        `Cadastro biométrico iniciado - Sessão: ${sessionId}`, usuario.nome]
    );

    // Responder com session ID
    res.json({
      success: true,
      message: 'Cadastro biométrico iniciado com sucesso',
      webhook_esperado: true,
      session_id: sessionId  // ✅ Nova: retornar session ID para frontend
    });

  } catch (error) {
    console.error('❌ Erro ao iniciar cadastro de biometria:', error);

    // ✅ CORREÇÃO: Atualizar estado com erro
    if (currentSessionId && biometriaSessions.has(currentSessionId)) {
      const sessionState = biometriaSessions.get(currentSessionId);
      sessionState.etapa = 'erro';
      sessionState.mensagem = `Erro ao iniciar cadastro: ${error.message}`;
      sessionState.success = false;
      sessionState.timestamp = new Date().toISOString();
    }

    // Registrar log de erro
    if (req.body.user_id) {
      await client.query(
        `INSERT INTO log (id_usuario, identificador, acao, status, detalhes, nome_usuario)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.body.user_id, req.body.identificador, 'INICIAR_CADASTRO_BIOMETRIA', 'ERRO',
        `Falha: ${error.message}`, req.body.nome]
      );
    }

    res.status(500).json({
      success: false,
      error: `Erro ao iniciar cadastro: ${error.message}`
    });
  } finally {
    client.release();
  }
});

app.post('/api/users/com-biometria', upload.single('image'), async (req, res) => {
  const client = await pool.connect();
  let userId = null;

  try {
    await client.query('BEGIN');

    const { nome, tipo, identificador } = req.body;

    if (!nome || !tipo || !identificador) {
      return res.status(400).json({
        error: 'Dados obrigatórios não fornecidos'
      });
    }

    if (!['ESTUDANTE', 'FUNCIONARIO'].includes(tipo)) {
      return res.status(400).json({
        error: 'Tipo inválido para esta rota'
      });
    }

    console.log(`👤 Criando usuário: ${nome} (${tipo} - ${identificador})`);

    // 1. Criar usuário
    const { rows } = await client.query(
      'INSERT INTO usuario (nome, tipo, identificador) VALUES ($1, $2, $3) RETURNING id',
      [nome, tipo, identificador]
    );
    userId = rows[0].id;

    console.log(`✅ Usuário criado com ID: ${userId}`);

    // 2. Criar registro na tabela específica
    if (tipo === 'ESTUDANTE') {
      await client.query(
        'INSERT INTO estudante (usuario_id, ra) VALUES ($1, $2)',
        [userId, identificador]
      );
    } else if (tipo === 'FUNCIONARIO') {
      await client.query(
        'INSERT INTO funcionario (usuario_id, matricula) VALUES ($1, $2)',
        [userId, identificador]
      );
    }

    // 3. Se há imagem, fazer upload
    if (req.file) {
      const filename = `${identificador}.jpg`;
      const imagePath = `assets/users/${filename}`;
      const filePath = path.join(usersImagesDir, filename);

      fs.writeFileSync(filePath, req.file.buffer);

      await client.query(
        'UPDATE usuario SET imagem_path = $1 WHERE id = $2',
        [imagePath, userId]
      );

      console.log(`📸 Imagem salva: ${filename}`);
    }

    // ✅ RESETAR ESTADO antes de iniciar biometria
    biometriaState = {
      etapa: 'iniciando',
      mensagem: 'Criando usuário e iniciando cadastro biométrico...',
      dados: { userId, nome, identificador },
      success: true,
      timestamp: new Date().toISOString()
    };

    // 4. Chamar catraca para cadastrar biometria COM WEBHOOK
    console.log('🔄 Iniciando cadastro de biometria na catraca...');

    const catracaResponse = await fetch(`${process.env.CATRACA_API_URL}/iniciar-cadastro`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        identificador: identificador,
        nome: nome,
        // ✅ INFORMAR URL DO WEBHOOK
        webhook_url: `http://${process.env.NODE_SERVER_URL}/api/webhook/biometria`
      }),
      timeout: 60000
    });

    if (!catracaResponse.ok) {
      throw new Error(`Catraca retornou status: ${catracaResponse.status}`);
    }

    const catracaResult = await catracaResponse.json();
    console.log('📨 Resposta inicial da catraca:', catracaResult);

    if (!catracaResult.success) {
      throw new Error(catracaResult.message || 'Erro no cadastro da biometria');
    }

    // ✅ NÃO esperar pela conclusão - commit IMEDIATO
    await client.query('COMMIT');

    console.log('✅ Usuário criado - biometria em andamento via webhooks...');

    // Registrar log de início
    await client.query(
      `INSERT INTO log (id_usuario, identificador, acao, status, detalhes, nome_usuario)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, identificador, 'CRIAR_USUARIO_COM_BIOMETRIA', 'INICIADO',
        'Usuário criado - biometria em andamento', nome]
    );

    res.status(201).json({
      success: true,
      userId,
      message: 'Usuário criado - cadastro biométrico em andamento'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao criar usuário com biometria:', error);

    // Atualizar estado com erro
    biometriaState = {
      etapa: 'erro',
      mensagem: `Erro ao criar usuário: ${error.message}`,
      dados: null,
      success: false,
      timestamp: new Date().toISOString()
    };

    // Log de erro
    if (userId) {
      await client.query('DELETE FROM usuario WHERE id = $1', [userId]);
    }

    res.status(500).json({
      error: `Erro ao criar usuário: ${error.message}`
    });
  } finally {
    client.release();
  }
});

// ==================== HEALTH CHECK ====================

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as server_time');

    const assetsExists = fs.existsSync(assetsDir);
    const usersImagesExists = fs.existsSync(usersImagesDir);

    res.json({
      success: true,
      message: 'API funcionando corretamente',
      database: 'Conectado',
      assets_system: assetsExists ? 'Ativo' : 'Inativo',
      images_folder: usersImagesExists ? 'Pronto' : 'Não configurado',
      server_time: result.rows[0].server_time,
      polling_system: 'ATIVO'
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro de conexão com o banco de dados'
    });
  }
});

// ==================== ERROR HANDLING ====================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Arquivo muito grande (máximo 5MB)' });
    }
  }

  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
  });
});

app.use('*', (req, res) => {
  console.log(`❌ Rota não encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ==================== INICIALIZAÇÃO ====================

async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');

    // Verificar/Adicionar coluna updated_at se necessário
    try {
      await client.query('SELECT updated_at FROM log_entrada LIMIT 1');
      // console.log('✅ Coluna updated_at já existe');
    } catch (error) {
      if (error.code === '42703') {
        console.log('🔄 Criando coluna updated_at...');
        await client.query('ALTER TABLE log_entrada ADD COLUMN updated_at TIMESTAMP DEFAULT NOW()');
        console.log('✅ Coluna updated_at criada com sucesso');
      } else {
        throw error;
      }
    }

    client.release();
    console.log('✅ Conectado ao PostgreSQL com sucesso');

  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error.message);
    process.exit(1);
  }
}

async function startServer() {
  await initializeDatabase();

  app.listen(port, '0.0.0.0', () => {
    console.log('🚀 Servidor Node.js rodando!');
    console.log(`📍 Local: http://localhost:${port}/api`);
    console.log(`🌐 Rede: http://192.168.11.125:${port}/api`);
    console.log(`🔗 Webhook: http://192.168.11.125:${port}/api/webhook/biometria`);
    console.log(`🐍 Catraca API: ${process.env.CATRACA_API_URL}`);
  });
}

startServer().catch(console.error);