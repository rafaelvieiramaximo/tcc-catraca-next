const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Aumentar limite para imagens
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de log
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ==================== FUNÇÕES AUXILIARES PARA IMAGENS ====================

// Converter Buffer para base64
function bufferToBase64(buffer) {
  return buffer ? buffer.toString('base64') : null;
}

// Converter base64 para Buffer
function base64ToBuffer(base64String) {
  if (!base64String) return null;
  return Buffer.from(base64String, 'base64');
}

// Validar imagem base64
function isValidBase64Image(base64String) {
  if (!base64String) return false;
  try {
    const buffer = Buffer.from(base64String, 'base64');
    // Verificar tamanho máximo (5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return false;
    }
    return true;
  } catch (error) {
    return false;
  }
}

// ==================== AUTENTICAÇÃO ====================

// Login de administrador usando bcrypt do PostgreSQL
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
    } else {
      return res.status(400).json({ error: 'Tipo de usuário inválido' });
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = result.rows[0];
    
    // Converter imagem BYTEA para base64 se existir
    if (user.imagem) {
      user.imagem_base64 = bufferToBase64(user.imagem);
      // Remover o buffer original para não enviar dados binários no JSON
      delete user.imagem;
    }

    return res.json({ success: true, user, message: 'Login realizado com sucesso' });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ==================== ENDPOINTS DE IMAGENS ====================

// Upload/Atualização de imagem do usuário
app.put('/api/users/:id/image', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { imagem_base64 } = req.body;

    if (!imagem_base64) {
      return res.status(400).json({ error: 'Imagem não fornecida' });
    }

    if (!isValidBase64Image(imagem_base64)) {
      return res.status(400).json({ error: 'Imagem inválida ou muito grande (máximo 5MB)' });
    }

    // Verificar se usuário existe
    const userCheck = await client.query('SELECT id FROM usuario WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Converter base64 para Buffer
    const imagemBuffer = base64ToBuffer(imagem_base64);

    // Atualizar imagem do usuário
    await client.query(
      'UPDATE usuario SET imagem = $1, imagem_atualizada_em = NOW() WHERE id = $2',
      [imagemBuffer, id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Imagem atualizada com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Erro ao atualizar imagem' });
  } finally {
    client.release();
  }
});

// Obter imagem do usuário
app.get('/api/users/:id/image', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT imagem FROM usuario WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0 || !result.rows[0].imagem) {
      return res.status(404).json({ error: 'Imagem não encontrada' });
    }

    const imagemBuffer = result.rows[0].imagem;
    
    // Determinar o tipo de conteúdo (você pode armazenar o mime type separadamente se necessário)
    res.set({
      'Content-Type': 'image/jpeg', // ou detectar dinamicamente
      'Content-Length': imagemBuffer.length
    });
    
    res.send(imagemBuffer);

  } catch (error) {
    console.error('Get image error:', error);
    res.status(500).json({ error: 'Erro ao obter imagem' });
  }
});

// Remover imagem do usuário
app.delete('/api/users/:id/image', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Verificar se usuário existe
    const userCheck = await client.query('SELECT id FROM usuario WHERE id = $1', [id]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Remover imagem
    await client.query(
      'UPDATE usuario SET imagem = NULL, imagem_atualizada_em = NULL WHERE id = $1',
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
        imagem,
        CASE WHEN imagem IS NOT NULL THEN true ELSE false END as tem_imagem
      FROM usuario 
      WHERE tipo != $1 AND tipo != $2 
      ORDER BY id
    `;
    const result = await pool.query(query, ['ADMIN', 'PORTARIA']);

    res.json({
      success: true,
      users: result.rows
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar usuários'
    });
  }
});

// Buscar usuário por ID (com imagem em base64)
app.get('/api/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { incluir_imagem } = req.query;

    let query;
    let params = [id];

    if (incluir_imagem === 'true') {
      query = 'SELECT *, imagem as imagem_buffer FROM usuario WHERE id = $1';
    } else {
      query = `
        SELECT 
          id, 
          nome, 
          tipo, 
          identificador, 
          created_at, 
          updated_at,
          imagem_atualizada_em,
          CASE WHEN imagem IS NOT NULL THEN true ELSE false END as tem_imagem
        FROM usuario 
        WHERE id = $1
      `;
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    let user = result.rows[0];

    // Converter imagem para base64 se solicitado
    if (incluir_imagem === 'true' && user.imagem_buffer) {
      user.imagem_base64 = bufferToBase64(user.imagem_buffer);
      delete user.imagem_buffer;
      delete user.imagem; // Remover o campo BYTEA original
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

// Criar usuário (agora suporta imagem)
app.post('/api/users', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { nome, tipo, identificador, imagem_base64 } = req.body;

    if (!nome || !tipo || !identificador) {
      return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    }

    if (!['ESTUDANTE', 'FUNCIONARIO'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido para esta rota' });
    }

    // Validar imagem se for fornecida
    let imagemBuffer = null;
    if (imagem_base64) {
      if (!isValidBase64Image(imagem_base64)) {
        return res.status(400).json({ error: 'Imagem inválida ou muito grande (máximo 5MB)' });
      }
      imagemBuffer = base64ToBuffer(imagem_base64);
    }

    // cria usuário
    const { rows } = await client.query(
      'INSERT INTO usuario (nome, tipo, identificador, imagem) VALUES ($1, $2, $3, $4) RETURNING id',
      [nome, tipo, identificador, imagemBuffer]
    );
    const userId = rows[0].id;

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

    await client.query('COMMIT');
    return res.status(201).json({ success: true, userId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create user (regular) error:', err);
    // trate violações comuns de forma amigável
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Identificador já cadastrado' });
    }
    return res.status(500).json({ error: 'Erro ao criar usuário' });
  } finally {
    client.release();
  }
});

// Criar usuário do sistema (admin/portaria)
app.post('/api/users/system', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { nome, tipo, identificador, senha, imagem_base64 } = req.body;

    if (!nome || !tipo || !identificador || !senha) {
      return res.status(400).json({ error: 'Dados obrigatórios não fornecidos' });
    }

    // Validar imagem se for fornecida
    let imagemBuffer = null;
    if (imagem_base64) {
      if (!isValidBase64Image(imagem_base64)) {
        return res.status(400).json({ error: 'Imagem inválida ou muito grande (máximo 5MB)' });
      }
      imagemBuffer = base64ToBuffer(imagem_base64);
    }

    // Insere na tabela usuario
    const userQuery = `
      INSERT INTO usuario (nome, tipo, imagem) 
      VALUES ($1, $2, $3) 
      RETURNING id
    `;
    const userResult = await client.query(userQuery, [nome, tipo.toUpperCase(), imagemBuffer]);
    const userId = userResult.rows[0].id;

    if (tipo.toUpperCase() === 'ADMIN') {
      await client.query(
        `INSERT INTO admin (usuario_id, id_admin, senha) 
         VALUES ($1, $2, crypt($3, gen_salt('bf')))`,
        [userId, identificador, senha]
      );

    } else if (tipo.toUpperCase() === 'PORTARIA') {
      await client.query(
        `INSERT INTO portaria (usuario_id, matricula, senha) 
         VALUES ($1, $2, crypt($3, gen_salt('bf')))`,
        [userId, identificador, senha]
      );

    } else {
      throw new Error('Tipo de usuário inválido para esta rota (apenas ADMIN ou PORTARIA)');
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      userId,
      message: 'Usuário criado com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create user (system) error:', error);
    res.status(500).json({ error: error.message || 'Erro ao criar usuário' });
  } finally {
    client.release();
  }
});

// Atualizar usuário (agora suporta imagem)
app.put('/api/users/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { nome, tipo, identificador, imagem_base64 } = req.body;

    // Monta a query dinamicamente conforme os campos enviados
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

    // Processar imagem se for fornecida
    if (imagem_base64 !== undefined) {
      if (imagem_base64 === null) {
        // Remover imagem
        updateFields.push(`imagem = $${idx++}`);
        updateValues.push(null);
        updateFields.push(`imagem_atualizada_em = NULL`);
      } else if (isValidBase64Image(imagem_base64)) {
        // Atualizar imagem
        updateFields.push(`imagem = $${idx++}`);
        updateValues.push(base64ToBuffer(imagem_base64));
        updateFields.push(`imagem_atualizada_em = NOW()`);
      } else {
        return res.status(400).json({ error: 'Imagem inválida ou muito grande' });
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const query = `UPDATE usuario SET ${updateFields.join(', ')} WHERE id = $${idx}`;
    updateValues.push(id);

    await client.query(query, updateValues);

    await client.query('COMMIT');

    // Buscar usuário atualizado (sem imagem para performance)
    const updatedUserQuery = `
      SELECT 
        id, 
        nome, 
        tipo, 
        identificador, 
        created_at, 
        updated_at,
        imagem_atualizada_em,
        CASE WHEN imagem IS NOT NULL THEN true ELSE false END as tem_imagem
      FROM usuario 
      WHERE id = $1
    `;
    const updatedUserResult = await client.query(updatedUserQuery, [id]);

    res.json({
      success: true,
      user: updatedUserResult.rows[0],
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

    await client.query('DELETE FROM usuario WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Usuário excluído com sucesso'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
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

    // Se só veio identificador, tente buscar o id_usuario (opcional)
    if (!idUsuarioFinal && identificadorFinal) {
      const userResult = await client.query(
        'SELECT id FROM usuario WHERE identificador = $1',
        [identificadorFinal]
      );
      if (userResult.rows.length > 0) {
        idUsuarioFinal = userResult.rows[0].id;
      }
    }

    // Insere o log mesmo que id_usuario seja null
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

// ==================== LOG  ENTRADA ====================

app.get('/api/logs/entrada', async (req, res) => {
  try {
    const { limit = 100, offset = 0, hoje, usuario_id, periodo, tipo } = req.query;

    let query = `SELECT le.*, u.nome as usuario_nome
      FROM log_entrada le
      INNER JOIN usuario u ON le.usuario_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Filtro por data de hoje
    if (hoje === 'true') {
      query += ` AND le.data_entrada = CURRENT_DATE`;
    }

    // Filtro por usuário
    if (usuario_id) {
      query += ` AND le.usuario_id = $${params.length + 1}`;
      params.push(usuario_id);
    }

    // Filtro por período
    if (periodo) {
      query += ` AND le.periodo = $${params.length + 1}`;
      params.push(periodo.toUpperCase());
    }

    // Filtro por tipo
    if (tipo) {
      query += ` AND le.tipo = $${params.length + 1}`;
      params.push(tipo.toUpperCase());
    }

    // Ordenação e paginação
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

// ==================== HEALTH CHECK ====================

app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as server_time');
    res.json({
      success: true,
      message: 'API funcionando corretamente',
      database: 'Conectado',
      server_time: result.rows[0].server_time
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
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Algo deu errado'
  });
});

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ==================== INICIALIZAÇÃO ====================

async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Conectado ao PostgreSQL com sucesso');

    // Verificar se as tabelas existem
    const tablesQuery = `
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN ('usuario', 'admin', 'estudante', 'funcionario', 'log')
    `;
    const result = await pool.query(tablesQuery);

    if (result.rows.length < 5) {
      console.warn('⚠️  Algumas tabelas podem estar faltando. Execute o script SQL primeiro.');
    } else {
      console.log('✅ Todas as tabelas do sistema encontradas');
    }

  } catch (error) {
    console.error('❌ Erro ao conectar ao PostgreSQL:', error.message);
    process.exit(1);
  }
}

async function startServer() {
  await initializeDatabase();

  app.listen(port, () => {
    console.log('🚀 Servidor rodando!');
    console.log(`📍 API disponível em: http://localhost:${port}/api`);
    console.log(`🏥 Health check: http://localhost:${port}/api/health`);
    console.log(`🖼️  Sistema de imagens BYTEA ativo`);
  });
}

startServer().catch(console.error);