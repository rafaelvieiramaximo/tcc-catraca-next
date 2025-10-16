'use client';

import { useState, useEffect } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

// Tipos para os usuários do sistema
export type TipoUsuario = 'PORTARIA' | 'ADMIN' | 'RH';
export type TipoS = 'ESTUDANTE' | 'FUNCIONARIO';

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
  imagem_path?: string | null; // NOVO CAMPO
  imagem_url?: string | null;  // NOVO CAMPO
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
}

// Interface para resposta de operações com imagem
interface ImageOperationResponse {
  success: boolean;
  message?: string;
  error?: string;
  imagePath?: string;
  imageUrl?: string;
}

// Classe principal do serviço de banco de dados
class DatabaseService {
  private baseUrl: string;
  private apiBaseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL.replace('/api', ''); // Remove /api para acessar arquivos estáticos
    this.apiBaseUrl = API_BASE_URL; // Mantém /api para endpoints da API
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

  // ==================== NOVAS FUNÇÕES PARA SISTEMA DE ARQUIVOS ====================

  // NO MÉTODO uploadUserImageFile - ADICIONE ESTE LOG
  async uploadUserImageFile(userId: number, identificador: string, imageFile: File): Promise<ImageOperationResponse> {
    try {
      console.log('📤 Iniciando upload - userId:', userId, 'identificador:', identificador, 'file:', imageFile.name, 'size:', imageFile.size);

      const formData = new FormData();
      formData.append('image', imageFile);
      formData.append('identificador', identificador);
      // NÃO enviar userId no formData - já está na URL

      console.log('📋 FormData criado, enviando requisição...');

      const response = await fetch(`${this.apiBaseUrl}/users/${userId}/image-file`, {
        method: 'PUT',
        body: formData,
      });

      console.log('📡 Resposta recebida - Status:', response.status);

      if (!response.ok) {
        let errorText;
        try {
          errorText = await response.text();
          console.error('❌ Erro na resposta:', errorText);
        } catch {
          errorText = 'Não foi possível ler a resposta de erro';
        }
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Upload bem-sucedido:', data);

      return {
        success: true,
        message: data.message || 'Imagem atualizada com sucesso',
        imagePath: data.imagePath,
        imageUrl: `${this.baseUrl}/${data.imagePath}`
      };
    } catch (error) {
      console.error('💥 Upload image file error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao fazer upload da imagem'
      };
    }
  }
  getUserImageUrl(user: UsuarioCompleto): string | null {
    // Prioridade para o novo sistema (arquivos)
    if (user.imagem_path) {
      return `${this.baseUrl}/${user.imagem_path}`;
    }

    // Fallback para sistema antigo (base64) - durante transição
    if (user.imagem_base64) {
      return user.imagem_base64;
    }

    // Fallback para endpoint de imagem
    if (user.tem_imagem) {
      return `${this.apiBaseUrl}/users/${user.id}/image`;
    }

    return null;
  }

  /**
   * Obtém a URL da imagem pelo identificador (para RegisterEntry)
   */
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
        // Se é Blob, converte para File
        fileToUpload = new File([imageFile], fileName, {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
      }

      // Faz upload usando o novo sistema de arquivos
      return await this.uploadUserImageFile(userId, identificador, fileToUpload);
    } catch (error) {
      console.error('Process and upload image error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao processar imagem'
      };
    }
  }

  // ==================== FUNÇÕES AUXILIARES PARA IMAGENS (COMPATIBILIDADE) ====================

  /**
   * Valida se a string base64 é uma imagem válida
   */
  isValidBase64Image(base64String: string): boolean {
    if (!base64String) return false;

    try {
      // Remove o prefixo data URL se existir
      const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '');

      // Verifica se é base64 válido
      const regex = /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)?$/;
      if (!regex.test(base64Data)) {
        return false;
      }

      // Calcula tamanho aproximado em bytes (base64 é ~33% maior que o original)
      const stringLength = base64Data.length;
      const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.5624896334383812;

      // Verifica se é menor que 5MB
      return sizeInBytes <= 5 * 1024 * 1024;
    } catch (error) {
      return false;
    }
  }

  /**
   * Converte um arquivo File para base64 (para compatibilidade)
   */
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

  /**
   * Processa imagem do input file para base64 (para compatibilidade)
   */
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

  async authenticateUser(identificador: string, senha: string, tipo: TipoUsuario): Promise<UsuarioCompleto | null> {
    try {
      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identificador,
          senha,
          tipo,
        }),
      });

      return response.user || null;
    } catch (error) {
      console.error('Authentication error:', error);
      return null;
    }
  }

  // ==================== OPERAÇÕES COM IMAGENS (COMPATIBILIDADE) ====================

  /**
   * Faz upload da imagem de um usuário (SISTEMA ANTIGO - base64)
   * MANTIDO PARA COMPATIBILIDADE
   */
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

  /**
   * Obtém a imagem do usuário em base64 (SISTEMA ANTIGO)
   * MANTIDO PARA COMPATIBILIDADE
   */
  async getUserImageBase64(userId: number): Promise<string | null> {
    try {
      const response = await this.makeRequest(`/users/${userId}?incluir_imagem=true`);
      return response.user?.imagem_base64 || null;
    } catch (error) {
      console.error('Get user image base64 error:', error);
      return null;
    }
  }

  /**
   * Remove a imagem do usuário (COMPATÍVEL COM AMBOS SISTEMAS)
   */
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

      // Adicionar URLs das imagens para todos os usuários
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

      // Adicionar URL da imagem se disponível
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
      // Validar imagem se for fornecida (sistema antigo)
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
      // Validar imagem se for fornecida (sistema antigo)
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

      // Adicionar URL da imagem ao usuário retornado
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
      // Validar imagem se for fornecida (sistema antigo)
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

  // ==================== MÉTODOS ADICIONAIS PARA WEB ====================

  /**
   * Verifica se o servidor está online
   */
  async isServerOnline(): Promise<boolean> {
    try {
      await this.healthCheck();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Obtém estatísticas do sistema
   */
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

// Funções auxiliares para uso em componentes

/**
 * Hook para verificar se o servidor está online
 */
export const useServerStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    const checkServerStatus = async () => {
      const online = await databaseService.isServerOnline();
      setIsOnline(online);
    };

    checkServerStatus();
    const interval = setInterval(checkServerStatus, 30000); // Verifica a cada 30 segundos

    return () => clearInterval(interval);
  }, []);

  return isOnline;
};

/**
 * Hook para dados do usuário com cache
 */
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