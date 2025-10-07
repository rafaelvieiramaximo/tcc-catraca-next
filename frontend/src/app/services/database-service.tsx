const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export type TipoUsuario = 'PORTARIA' | 'ADMIN';
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
  imagem_base64?: string;
}

export interface UsuarioCompleto extends Usuario {
  senha_hash?: string;
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

class DatabaseService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
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

  async getLogsEntrada(limit: number = 100, offset: number = 0, filtros: any = {}): Promise<LogEntrada[]> {
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

  async getUserById(id: number, incluirImagem: boolean = false): Promise<UsuarioCompleto | null> {
    try {
      const endpoint = incluirImagem ? `/users/${id}?incluir_imagem=true` : `/users/${id}`;
      const response = await this.makeRequest(endpoint);
      return response.user || null;
    } catch (error) {
      console.error('Get user by id error:', error);
      return null;
    }
  }

  // Outros métodos que você pode precisar depois
  async getAllUsers(): Promise<UsuarioCompleto[]> {
    try {
      const response = await this.makeRequest('/users');
      return response.users || [];
    } catch (error) {
      console.error('Get all users error:', error);
      return [];
    }
  }

  async createUser(userData: any): Promise<any> {
    return this.makeRequest('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: number, userData: any): Promise<any> {
    return this.makeRequest(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      await this.makeRequest(`/users/${id}`, {
        method: 'DELETE',
      });
      return true;
    } catch (error) {
      console.error('Delete user error:', error);
      return false;
    }
  }

  async createActionLog(logData: any): Promise<boolean> {
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
}

export const databaseService = new DatabaseService();