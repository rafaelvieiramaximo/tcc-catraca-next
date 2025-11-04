// services/database-service.tsx
'use client';

import { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

// Tipos para os usuários do sistema
export type TipoUsuario = 'PORTARIA' | 'ADMIN' | 'RH';
export type TipoS = 'ESTUDANTE' | 'FUNCIONARIO' | 'VISITANTE';

export interface Usuario {
  id: number;
  nome: string;
  tipo: TipoS | TipoUsuario;
  identificador: string;
  created_at: string;
  updated_at: string;
  imagem_atualizada_em?: string;
  tem_imagem?: boolean;
  imagem_base64?: string | null;
  imagem_path?: string | null;
  imagem_url?: string | null;
}

export interface NovoUsuarioSystem {
  nome: string;
  tipo: string;
  identificador: string;
  senha: string;
  imagem_base64?: string;
}

export interface NovoUsuario {
  nome: string;
  tipo: TipoS | TipoUsuario;
  identificador: string;
  imagem_base64?: string;
}

interface FiltrosLogEntrada {
  hoje?: boolean;
  usuario_id?: number;
  periodo?: string;
  tipo?: string;
}

export interface LogEntrada {
  id: number;
  usuario_id: string;
  identificador: string;
  nome: string;
  tipo: string;
  periodo: string;
  data_entrada: string;
  horario: string;
  created_at: string;
  controle: boolean;
}

interface FiltrosLogAction {
  usuario_id?: number;
  acao?: string;
  data_acao?: string;
}

export interface LogAction {
  id_log: number;
  id_usuario: number;
  data_acao: string;
  data_hora: string;
  acao: string;
  status: string;
  detalhes?: string;
  created_at: string;
  nome_usuario: string;
}

export interface UsuarioCompleto extends Usuario {
  senha_hash?: string;
  has_fingerprint?: boolean;
  fingerprint_count?: number;
}

// Interface para resposta de operações com imagem
interface ImageOperationResponse {
  success: boolean;
  message?: string;
  error?: string;
  imagePath?: string;
  imageUrl?: string;
}

export interface NovoSistemaUsuario {
  nome: string;
  tipo: 'ADMIN' | 'RH' | 'PORTARIA';
  identificador: string;
  senha: string;
}
// ==================== NOVOS TIPOS PARA DIGITAIS ====================

export interface FingerprintData {
  user_id: string;
  template_position: number;
}

export interface UserFingerprintStatus {
  user_id: number;
  nome: string;
  tipo: string;
  identificador: string;
  imagem_path?: string;
  fingerprint_count: number;
  has_fingerprint: boolean;
  fingerprint_positions: number[];
}

export interface FingerprintStatusResponse {
  success: boolean;
  users: UserFingerprintStatus[];
  total_users: number;
  users_with_fingerprint: number;
  users_without_fingerprint: number;
}

export interface StatusBiometria {
  success: boolean;
  etapa: string;
  mensagem: string;
  dados?: any;
  timestamp: string;
  error?: string;
}

export interface CadastroBiometriaRequest {
  user_id: number;
  identificador: string;
  nome: string;
}

export interface CadastroBiometriaResponse {
  success: boolean;
  message: string;
  posicao?: number;
  error?: string;
}

// Classe principal do serviço de banco de dados
class DatabaseService {
  private baseUrl: string;
  private apiBaseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL.replace('/api', '');
    this.apiBaseUrl = API_BASE_URL;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Database request error:', error);
      throw error;
    }
  }

  async connectionTest(): Promise<boolean> {
    try {
      const res = await fetch(`${this.apiBaseUrl}/health`, { method: 'GET' });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      return typeof data.success === 'boolean' ? data.success : false;
    } catch (error) {
      console.error('Connection test error:', error);
      return false;
    }
  }

  async isServerOnline(): Promise<boolean> {
    const res = await this.healthCheck();
    return res.success == true;
  }
  // ==================== NOVAS FUNÇÕES PARA VERIFICAÇÃO DE DIGITAIS ====================

  async getUserFingerprintStatus(userId: number): Promise<{ has_fingerprint: boolean; fingerprint_count: number }> {
    try {
      const response = await this.makeRequest(`/users/${userId}/finger`);
      return {
        has_fingerprint: response.has_fingerprint,
        fingerprint_count: response.fingerprint_count
      };
    } catch (error) {
      console.error('Get user fingerprint status error:', error);
      return {
        has_fingerprint: false,
        fingerprint_count: 0
      };
    }
  }

  /**
   * Obtém todos os usuários com status de fingerprint
   * Usa o endpoint otimizado que retorna tudo de uma vez
   */
  async getAllUsersWithFingerprintStatus(): Promise<UsuarioCompleto[]> {
    try {
      const response = await this.makeRequest('/users/fingerprints/status');

      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar status das digitais');
      }

      // Mapeia a resposta para o formato UsuarioCompleto
      const usersWithStatus: UsuarioCompleto[] = response.users.map((user: UserFingerprintStatus) => ({
        id: user.user_id,
        nome: user.nome,
        tipo: user.tipo as TipoS | TipoUsuario,
        identificador: user.identificador,
        created_at: '', // Não retornado pelo endpoint, mas mantemos a interface
        updated_at: '', // Não retornado pelo endpoint, mas mantemos a interface
        imagem_path: user.imagem_path,
        imagem_url: user.imagem_path ? `${this.baseUrl}/${user.imagem_path}` : null,
        tem_imagem: !!user.imagem_path,
        has_fingerprint: user.has_fingerprint,
        fingerprint_count: user.fingerprint_count
      }));

      return usersWithStatus;
    } catch (error) {
      console.error('Get all users with fingerprint status error:', error);

      // Fallback: busca usuários normalmente e depois verifica fingerprint individualmente
      try {
        console.log('🔄 Usando fallback para busca de fingerprints...');
        const users = await this.getAllUsers();

        const usersWithStatus = await Promise.all(
          users.map(async (user) => {
            try {
              const fingerprintStatus = await this.getUserFingerprintStatus(user.id);
              return {
                ...user,
                has_fingerprint: fingerprintStatus.has_fingerprint,
                fingerprint_count: fingerprintStatus.fingerprint_count
              };
            } catch (error) {
              console.error(`Error getting fingerprint status for user ${user.id}:`, error);
              return {
                ...user,
                has_fingerprint: false,
                fingerprint_count: 0
              };
            }
          })
        );

        return usersWithStatus;
      } catch (fallbackError) {
        console.error('Fallback também falhou:', fallbackError);
        return [];
      }
    }
  }

  /**
   * Obtém estatísticas das fingerprints
   */
  async getFingerprintStats(): Promise<{
    total_users: number;
    users_with_fingerprint: number;
    users_without_fingerprint: number;
    fingerprint_coverage: number;
  }> {
    try {
      const data = await this.getAllUsersWithFingerprintStatus();

      const usersWithFingerprint = data.filter(user => user.has_fingerprint).length;
      const totalUsers = data.length;

      return {
        total_users: totalUsers,
        users_with_fingerprint: usersWithFingerprint,
        users_without_fingerprint: totalUsers - usersWithFingerprint,
        fingerprint_coverage: totalUsers > 0
          ? Math.round((usersWithFingerprint / totalUsers) * 100)
          : 0
      };
    } catch (error) {
      console.error('Get fingerprint stats error:', error);
      return {
        total_users: 0,
        users_with_fingerprint: 0,
        users_without_fingerprint: 0,
        fingerprint_coverage: 0
      };
    }
  }

  // ==================== NOVAS FUNÇÕES PARA DIGITAIS ====================
  

  // ==================== FUNÇÕES EXISTENTES PARA IMAGENS ====================

  async uploadUserImageFile(userId: number, identificador: string, imageFile: File): Promise<ImageOperationResponse> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('identificador', identificador);

      const response = await fetch(`${this.apiBaseUrl}/users/${userId}/image-file`, {
        method: 'PUT',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Não foi possível ler a resposta de erro');
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const data = await response.json();

      return {
        success: true,
        message: data.message || 'Imagem atualizada com sucesso',
        imagePath: data.imagePath,
        imageUrl: `${this.baseUrl}/${data.imagePath}`
      };
    } catch (error) {
      console.error('Upload image file error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem'
      };
    }
  }

  getUserImageUrl(user: UsuarioCompleto): string | null {
    if (user.imagem_path) {
      return `${this.baseUrl}/${user.imagem_path}`;
    }

    if (user.imagem_base64) {
      return user.imagem_base64;
    }

    if (user.tem_imagem) {
      return `${this.apiBaseUrl}/users/${user.id}/image`;
    }

    return null;
  }

  getUserImageByIdentificador(identificador: string): string {
    return `${this.baseUrl}/assets/users/${identificador}.jpg`;
  }

  async checkUserImageExists(identificador: string): Promise<boolean> {
    try {
      const imageUrl = this.getUserImageByIdentificador(identificador);
      const response = await fetch(imageUrl, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async processAndUploadUserImage(
    userId: number,
    identificador: string,
    imageFile: File | Blob,
    fileName: string = 'image.jpg'
  ): Promise<ImageOperationResponse> {
    try {
      let fileToUpload: File;

      if (imageFile instanceof File) {
        fileToUpload = imageFile;
      } else {
        fileToUpload = new File([imageFile], fileName, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
      }

      return await this.uploadUserImageFile(userId, identificador, fileToUpload);
    } catch (error) {
      console.error('Process and upload image error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar imagem'
      };
    }
  }

  // ==================== FUNÇÕES AUXILIARES PARA IMAGENS ====================

  isValidBase64Image(base64String: string): boolean {
    if (!base64String) return false;

    try {
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

      const regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
      if (!regex.test(base64Data)) {
        return false;
      }

      const stringLength = base64Data.length;
      const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;

      return sizeInBytes <= 5 * 1024 * 1024;
    } catch (error) {
      return false;
    }
  }

  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };

      reader.onerror = (error) => {
        reject(new Error('Falha ao ler arquivo: ' + error));
      };

      reader.readAsDataURL(file);
    });
  }

  async processImageForUpload(file: File): Promise<string> {
    try {
      const base64String = await this.fileToBase64(file);

      if (!this.isValidBase64Image(base64String)) {
        throw new Error('Imagem inválida ou muito grande (máximo 5MB)');
      }

      return base64String;
    } catch (error) {
      console.error('Erro ao processar imagem:', error);
      throw error;
    }
  }

  // ==================== AUTENTICAÇÃO ====================

  // services/database-service.tsx - APENAS A FUNÇÃO authenticateUser

  async authenticateUser(identificador: string, senha: string, tipo: TipoUsuario): Promise<{ user: UsuarioCompleto; token: string } | null> {
    try {
      console.log('🔐 Iniciando autenticação...');

      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identificador,
          senha,
          tipo,
        }),
      });

      console.log('📨 Resposta completa do login:', response);

      // ✅ VERIFICAÇÃO ROBUSTA
      if (response && response.success && response.user && response.token) {
        console.log('✅ Token JWT encontrado na resposta');
        console.log('📏 Comprimento do token:', response.token.length);

        // ✅ SALVAR TOKEN NO LOCALSTORAGE
        localStorage.setItem('auth_token', response.token);
        console.log('💾 Token salvo no localStorage com sucesso!');

        // ✅ RETORNAR OBJETO COM USER E TOKEN
        return {
          user: response.user,
          token: response.token
        };
      } else {
        console.error('❌ Resposta de autenticação inválida:', response);
        localStorage.removeItem('auth_token');
        return null;
      }
    } catch (error) {
      console.error('❌ Erro na autenticação:', error);
      localStorage.removeItem('auth_token');
      return null;
    }
  }
  // ==================== OPERAÇÕES COM IMAGENS ====================

  async uploadUserImage(userId: number, imageBase64: string): Promise<ImageOperationResponse> {
    try {
      if (!this.isValidBase64Image(imageBase64)) {
        return {
          success: false,
          error: 'Imagem inválida ou muito grande (máximo 5MB)'
        };
      }

      const response = await this.makeRequest(`/users/${userId}/image`, {
        method: 'PUT',
        body: JSON.stringify({
          imagem_base64: imageBase64
        }),
      });

      return {
        success: true,
        message: response.message || 'Imagem atualizada com sucesso'
      };
    } catch (error) {
      console.error('Upload image error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem'
      };
    }
  }

  async getUserImageBase64(userId: number): Promise<string | null> {
    try {
      const response = await this.makeRequest(`/users/${userId}?incluir_imagem=true`);
      return response.user?.imagem_base64 || null;
    } catch (error) {
      console.error('Get user image base64 error:', error);
      return null;
    }
  }

  async deleteUserImage(userId: number): Promise<ImageOperationResponse> {
    try {
      const response = await this.makeRequest(`/users/${userId}/image`, {
        method: 'DELETE',
      });

      return {
        success: true,
        message: response.message || 'Imagem removida com sucesso'
      };
    } catch (error) {
      console.error('Delete image error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao remover imagem'
      };
    }
  }

  // ==================== USUÁRIOS ====================

  async getAllUsers(): Promise<UsuarioCompleto[]> {
    try {
      const response = await this.makeRequest('/users');
      const users = response.users || [];

      return users.map((user: UsuarioCompleto) => ({
        ...user,
        imagem_url: this.getUserImageUrl(user)
      }));
    } catch (error) {
      console.error('Get all users error:', error);
      return [];
    }
  }

  async getUserById(id: number, incluirImagem: boolean = false): Promise<UsuarioCompleto | null> {
    try {
      const endpoint = incluirImagem ? `/users/${id}?incluir_imagem=true` : `/users/${id}`;
      const response = await this.makeRequest(endpoint);

      if (!response.user) {
        return null;
      }

      const user = response.user;
      user.imagem_url = this.getUserImageUrl(user);

      return user;
    } catch (error) {
      console.error('Get user by id error:', error);
      return null;
    }
  }

  async createUser(userData: NovoUsuario): Promise<{ success: boolean; userId?: number; error?: string }> {
    try {
      if (userData.imagem_base64 && !this.isValidBase64Image(userData.imagem_base64)) {
        return {
          success: false,
          error: 'Imagem inválida ou muito grande (máximo 5MB)'
        };
      }

      const response = await this.makeRequest('/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      return {
        success: true,
        userId: response.userId
      };
    } catch (error) {
      console.error('Create user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar usuário'
      };
    }
  }

  async updateUser(id: number, userData: Partial<UsuarioCompleto & { imagem_base64?: string | null }>): Promise<{ success: boolean; user?: UsuarioCompleto; error?: string }> {
    try {
      if (userData.imagem_base64 !== undefined &&
        userData.imagem_base64 !== null &&
        !this.isValidBase64Image(userData.imagem_base64)) {
        return {
          success: false,
          error: 'Imagem inválida ou muito grande (máximo 5MB)'
        };
      }

      const response = await this.makeRequest(`/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(userData),
      });

      if (response.user) {
        response.user.imagem_url = this.getUserImageUrl(response.user);
      }

      return {
        success: true,
        user: response.user
      };
    } catch (error) {
      console.error('Update user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao atualizar usuário'
      };
    }
  }

  async deleteUser(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      await this.makeRequest(`/users/${id}`, {
        method: 'DELETE',
      });

      return { success: true };
    } catch (error) {
      console.error('Delete user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao deletar usuário'
      };
    }
  }

  async adicionarUsuario(usuario: NovoUsuarioSystem): Promise<{ success: boolean; userId?: number; error?: string }> {
    try {
      if (usuario.imagem_base64 && !this.isValidBase64Image(usuario.imagem_base64)) {
        return {
          success: false,
          error: 'Imagem inválida ou muito grande (máximo 5MB)'
        };
      }

      const isSystemUser = usuario.tipo === 'ADMIN' || usuario.tipo === 'PORTARIA';
      const path = isSystemUser ? '/users/system' : '/users';

      const response = await this.makeRequest(path, {
        method: 'POST',
        body: JSON.stringify(usuario),
      });

      return {
        success: true,
        userId: response.userId
      };
    } catch (error) {
      console.error('Adicionar usuario error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar usuário'
      };
    }
  }

  async createSystemUser(userData: NovoSistemaUsuario): Promise<{ success: boolean; userId?: number; error?: string }> {
    try {
      const response = await this.makeRequest('/users/system', {
        method: 'POST',
        body: JSON.stringify(userData),
      });

      return {
        success: true,
        userId: response.userId
      };
    } catch (error) {
      console.error('Create system user error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao criar usuário do sistema'
      };
    }
  }

  // ================= LOG ENTRADA ========================

  async getLogsEntrada(
    limit: number = 100,
    offset: number = 0,
    filtros: FiltrosLogEntrada = {}
  ): Promise<LogEntrada[]> {
    try {
      const params: Record<string, string> = {
        limit: limit.toString(),
        offset: offset.toString()
      };

      if (filtros.hoje) params.hoje = 'true';
      if (filtros.usuario_id) params.usuario_id = filtros.usuario_id.toString();
      if (filtros.periodo) params.periodo = filtros.periodo;
      if (filtros.tipo) params.tipo = filtros.tipo;

      const queryParams = new URLSearchParams(params).toString();
      const url = `/logs/entrada?${queryParams}`;

      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      return response.logs || [];
    } catch (error) {
      console.error('Get logs entrada error:', error);
      return [];
    }
  }

  async checkForNewEntries(lastCheck: string, lastChangeCount: number = 0): Promise<{
    has_changes: boolean;
    last_change: string;
    change_count: number;
    success: boolean;
  }> {
    try {
      const response = await fetch(
        `${this.apiBaseUrl}/check-new-entries?last_check=${lastCheck}&last_change_count=${lastChangeCount}`
      );

      if (!response.ok) {
        throw new Error('Erro ao verificar novas entradas');
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Erro ao verificar novas entradas:', error);
      return {
        has_changes: false,
        last_change: new Date().toISOString(),
        change_count: lastChangeCount,
        success: false
      };
    }
  }

  async getRecentEntries(limit: number = 10): Promise<LogEntrada[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/recent-entries?limit=${limit}`);

      if (!response.ok) {
        throw new Error('Erro ao buscar entradas recentes');
      }

      const data = await response.json();
      return data.entries || [];
    } catch (error) {
      console.error('❌ Erro ao buscar entradas recentes:', error);
      return [];
    }
  }

  // ==================== LOG AÇÃO ====================

  async getActionLogs(
    limit: number = 100,
    offset: number = 0,
    filtros: FiltrosLogAction = {}
  ): Promise<LogAction[]> {
    try {
      const params: Record<string, string> = {
        limit: limit.toString(),
        offset: offset.toString()
      };

      if (filtros.usuario_id) params.usuario_id = filtros.usuario_id.toString();
      if (filtros.acao) params.acao = filtros.acao;
      if (filtros.data_acao) params.data_acao = filtros.data_acao;

      const queryParams = new URLSearchParams(params).toString();
      const url = `/logs/action?${queryParams}`;

      const response = await this.makeRequest(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      return response.logs || [];
    } catch (error) {
      console.error('Get action logs error:', error);
      return [];
    }
  }

  // ==================== CRIAR LOG AÇÃO ====================

  async createActionLog(logData: {
    id_usuario?: number;
    identificador?: string;
    acao: string;
    status: string;
    detalhes?: string;
    nome_usuario?: string;
  }): Promise<boolean> {
    try {
      const response = await this.makeRequest('/logs/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData),
      });

      return response.success === true;
    } catch (error) {
      console.error('Create action log error:', error);
      return false;
    }
  }

  // ==================== HEALTH CHECK ====================

  async healthCheck(): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await this.makeRequest('/health');
      return {
        success: true,
        message: response.message
      };
    } catch (error) {
      return {
        success: false,
        error: 'Servidor indisponível'
      };
    }
  }

  // ==================== MÉTODOS ADICIONAIS ====================

  async getSystemStats(): Promise<{
    totalUsers: number;
    totalEntriesToday: number;
    onlineUsers: number;
  }> {
    try {
      const response = await this.makeRequest('/stats');
      return response;
    } catch (error) {
      console.error('Get system stats error:', error);
      return {
        totalUsers: 0,
        totalEntriesToday: 0,
        onlineUsers: 0
      };
    }
  }
}

// Instância única do serviço
export const databaseService = new DatabaseService();

// ==================== HOOKS PARA DIGITAIS ====================

export const useFingerprintStats = () => {
  const [stats, setStats] = useState<{
    total_users: number;
    users_with_fingerprint: number;
    users_without_fingerprint: number;
    fingerprint_coverage: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const fingerprintStats = await databaseService.getFingerprintStats();
      setStats(fingerprintStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return { stats, loading, error, refetch: loadStats };
};

export const useUserFingerprintStatus = (userId: number) => {
  const [data, setData] = useState<{
    has_fingerprint: boolean;
    fingerprint_count: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const fingerprintData = await databaseService.getUserFingerprintStatus(userId);
      setData(fingerprintData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar status da digital');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadData();
    }
  }, [userId]);

  return { data, loading, error, refetch: loadData };
};

// ==================== HOOKS EXISTENTES ====================

export const useServerStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const checkServerStatus = async () => {
      const online = await databaseService.isServerOnline();
      setIsOnline(online);
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  return isOnline;
};

export const useUserData = (userId: number, includeImage: boolean = false) => {
  const [user, setUser] = useState<UsuarioCompleto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const userData = await databaseService.getUserById(userId, includeImage);
        setUser(userData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar usuário');
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchUser();
    }
  }, [userId, includeImage]);

  return { user, loading, error };
};