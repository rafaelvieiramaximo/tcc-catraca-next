const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
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

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/assets', express.static(assetsDir));

// Middleware de log
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
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
    } else if(tipo === 'RH'){
      query = `
        SELECT u.*, rh.matricula, 'RH'::text AS tipo
        FROM usuario u
        JOIN rh ON u.id = rh.usuario_id
        WHERE rh.matricula = $1 AND rh.senha = crypt($2, rh.senha)
      `;
      params = [identificador, senha];
    }else{
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

    return res.json({ success: true, user, message: 'Login realizado com sucesso' });

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
      WHERE tipo != 'ADMIN' AND tipo != 'PORTARIA' AND tipo != 'RH'
      ORDER BY id
    `;
    const result = await pool.query(query);

    const usersWithImages = result.rows.map(user => {
      if (user.imagem_path) {
        user.imagem_url = `http://localhost:${port}/${user.imagem_path}`;
      }
      return user;
    });

    res.json({
      success: true,
      users: usersWithImages
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar usuários'
    });
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

    if (!['ESTUDANTE', 'FUNCIONARIO'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido para esta rota' });
    }

    const { rows } = await client.query(
      'INSERT INTO usuario (nome, tipo, identificador) VALUES ($1, $2, $3) RETURNING id',
      [nome, tipo, identificador]
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
    console.error('Create user error:', err);
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
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ==================== INICIALIZAÇÃO ====================

async function initializeDatabase() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');

    try {
      await client.query('SELECT imagem_path FROM usuario LIMIT 1');
      console.log('✅ Coluna imagem_path já existe');
    } catch (error) {
      if (error.code === '42703') {
        console.log('🔄 Criando coluna imagem_path...');
        await client.query('ALTER TABLE usuario ADD COLUMN imagem_path VARCHAR(255)');
        console.log('✅ Coluna imagem_path criada com sucesso');
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

  app.listen(port, () => {
    console.log('🚀 Servidor rodando!');
    console.log(`📍 http://localhost:${port}/api`);
    console.log(`🖼️  Sistema de imagens: ARQUIVOS FÍSICOS`);
    console.log(`📁 Pasta: ${usersImagesDir}`);
  });
}

startServer().catch(console.error);