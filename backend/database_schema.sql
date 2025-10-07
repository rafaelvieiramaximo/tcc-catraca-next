-- Script de criação do banco de dados - PostgreSQL
-- Sistema de Controle de Acesso FATEC

-- Criação do banco de dados
-- CREATE DATABASE turnstile_system;

-- Conectar ao banco de dados e executar os comandos abaixo
-- \c turnstile_system;

-- Tabela Usuario (classe pai)
CREATE TABLE IF NOT EXISTS usuario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    digital_biometrica BYTEA,
    tipo VARCHAR(50) NOT NULL CHECK (tipo IN ('ESTUDANTE', 'FUNCIONARIO', 'ADMIN')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela Estudante (herda de Usuario)
CREATE TABLE IF NOT EXISTS estudante (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER UNIQUE NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    ra VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela Funcionario (herda de Usuario)  
CREATE TABLE IF NOT EXISTS funcionario (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER UNIQUE NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    matricula VARCHAR(20) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela Admin (herda de Usuario)
CREATE TABLE IF NOT EXISTS admin (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER UNIQUE NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
    id_admin INTEGER UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL, -- Hash da senha
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela Log
CREATE TABLE IF NOT EXISTS log (
    id_log SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL REFERENCES usuario(id),
    data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    acao VARCHAR(255) NOT NULL,
    status VARCHAR(100) NOT NULL,
    detalhes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela Sistema (para configurações do sistema)
CREATE TABLE IF NOT EXISTS sistema (
    id SERIAL PRIMARY KEY,
    chave VARCHAR(100) UNIQUE NOT NULL,
    valor TEXT,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_usuario_tipo ON usuario(tipo);
CREATE INDEX IF NOT EXISTS idx_estudante_ra ON estudante(ra);
CREATE INDEX IF NOT EXISTS idx_funcionario_matricula ON funcionario(matricula);
CREATE INDEX IF NOT EXISTS idx_admin_id_admin ON admin(id_admin);
CREATE INDEX IF NOT EXISTS idx_log_usuario ON log(id_usuario);
CREATE INDEX IF NOT EXISTS idx_log_data_hora ON log(data_hora);
CREATE INDEX IF NOT EXISTS idx_sistema_chave ON sistema(chave);

-- Função para atualizar o campo updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar automaticamente o campo updated_at
CREATE TRIGGER update_usuario_updated_at BEFORE UPDATE ON usuario
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sistema_updated_at BEFORE UPDATE ON sistema
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir dados iniciais

-- Usuário administrador padrão
INSERT INTO usuario (nome, tipo) VALUES ('Administrador Sistema', 'ADMIN') ON CONFLICT DO NOTHING;

-- Admin padrão (senha: admin123 - hash MD5 simples para desenvolvimento)
INSERT INTO admin (usuario_id, id_admin, senha) 
SELECT 1, 1000, MD5('admin123') 
WHERE NOT EXISTS (SELECT 1 FROM admin WHERE id_admin = 1000);

-- Configurações iniciais do sistema
INSERT INTO sistema (chave, valor, descricao) VALUES 
('sistema_ativo', 'true', 'Indica se o sistema está ativo'),
('max_tentativas_login', '3', 'Máximo de tentativas de login'),
('timeout_sessao', '3600', 'Timeout da sessão em segundos')
ON CONFLICT (chave) DO NOTHING;

-- Dados de exemplo para teste

-- Estudantes
INSERT INTO usuario (nome, tipo) VALUES 
('João Silva Santos', 'ESTUDANTE'),
('Maria Oliveira Costa', 'ESTUDANTE'),
('Pedro Souza Lima', 'ESTUDANTE')
ON CONFLICT DO NOTHING;

INSERT INTO estudante (usuario_id, ra) VALUES 
(2, 'RA001001'),
(3, 'RA001002'), 
(4, 'RA001003')
ON CONFLICT (usuario_id) DO NOTHING;

-- Funcionários
INSERT INTO usuario (nome, tipo) VALUES 
('Ana Carolina Pereira', 'FUNCIONARIO'),
('Carlos Roberto Silva', 'FUNCIONARIO')
ON CONFLICT DO NOTHING;

INSERT INTO funcionario (usuario_id, matricula) VALUES 
(5, 'FUNC001'),
(6, 'FUNC002')
ON CONFLICT (usuario_id) DO NOTHING;

-- Logs de exemplo
INSERT INTO log (id_usuario, acao, status, detalhes) VALUES 
(2, 'LOGIN_ACESSO', 'SUCESSO', 'Acesso liberado via biometria'),
(3, 'LOGIN_ACESSO', 'SUCESSO', 'Acesso liberado via cartão'),
(4, 'LOGIN_ACESSO', 'FALHA', 'Biometria não reconhecida'),
(5, 'LOGIN_SISTEMA', 'SUCESSO', 'Login no sistema administrativo'),
(1, 'CRIAR_USUARIO', 'SUCESSO', 'Novo usuário cadastrado: João Silva Santos');

-- View para facilitar consultas de usuários completos
CREATE OR REPLACE VIEW view_usuarios_completos AS
SELECT 
    u.id,
    u.nome,
    u.tipo,
    u.created_at,
    CASE 
        WHEN u.tipo = 'ESTUDANTE' THEN e.ra
        WHEN u.tipo = 'FUNCIONARIO' THEN f.matricula
        WHEN u.tipo = 'ADMIN' THEN CAST(a.id_admin AS VARCHAR)
    END as identificador,
    CASE 
        WHEN u.tipo = 'ADMIN' THEN a.senha
        ELSE NULL
    END as senha_hash
FROM usuario u
LEFT JOIN estudante e ON u.id = e.usuario_id
LEFT JOIN funcionario f ON u.id = f.usuario_id  
LEFT JOIN admin a ON u.id = a.usuario_id;

-- View para logs com informações do usuário
CREATE OR REPLACE VIEW view_logs_detalhados AS
SELECT 
    l.id_log,
    l.data_hora,
    l.acao,
    l.status,
    l.detalhes,
    u.nome as usuario_nome,
    u.tipo as usuario_tipo,
    CASE 
        WHEN u.tipo = 'ESTUDANTE' THEN e.ra
        WHEN u.tipo = 'FUNCIONARIO' THEN f.matricula
        WHEN u.tipo = 'ADMIN' THEN CAST(a.id_admin AS VARCHAR)
    END as usuario_identificador
FROM log l
JOIN usuario u ON l.id_usuario = u.id
LEFT JOIN estudante e ON u.id = e.usuario_id
LEFT JOIN funcionario f ON u.id = f.usuario_id
LEFT JOIN admin a ON u.id = a.usuario_id
ORDER BY l.data_hora DESC;

COMMENT ON TABLE usuario IS 'Tabela principal de usuários do sistema';
COMMENT ON TABLE estudante IS 'Dados específicos de estudantes';
COMMENT ON TABLE funcionario IS 'Dados específicos de funcionários';
COMMENT ON TABLE admin IS 'Dados específicos de administradores';
COMMENT ON TABLE log IS 'Logs de ações e acessos do sistema';
COMMENT ON TABLE sistema IS 'Configurações gerais do sistema';

COMMENT ON COLUMN usuario.digital_biometrica IS 'Dados biométricos em formato binário';
COMMENT ON COLUMN admin.senha IS 'Hash MD5 da senha do administrador';
COMMENT ON COLUMN log.acao IS 'Tipo de ação realizada (LOGIN_ACESSO, LOGIN_SISTEMA, CRIAR_USUARIO, etc)';
COMMENT ON COLUMN log.status IS 'Status da ação (SUCESSO, FALHA, PENDENTE)';

-- Consulta para verificar a estrutura criada
/*
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables 
WHERE schemaname = 'public' 
    AND tablename IN ('usuario', 'estudante', 'funcionario', 'admin', 'log', 'sistema')
ORDER BY tablename;
*/