// components/auth/page.tsx
'use client';

import React, { useEffect, useState } from "react";
import Image from 'next/image';
import { databaseService, UsuarioCompleto, TipoUsuario } from "../../services/database-service";
import "./styles.css";

interface LoginProps {
  onLoginSuccess: (user: UsuarioCompleto, token: string) => void; // ✅ AGORA RECEBE 2 PARÂMETROS
  key?: number;
}
export default function Login({ onLoginSuccess, key }: LoginProps) {
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<TipoUsuario>("ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isApiOnline, setIsApiOnline] = useState<boolean | null>(null);
  const [triedConnection, setTriedConnection] = useState(false);
  const [isLoginSuccessful, setIsLoginSuccessful] = useState(false);

  useEffect(() => {
    if (key) {
      setIdentificador("");
      setSenha("");
      setTipo("ADMIN");
      setLoading(false);
      setError(null);
      console.log("Login component reset due to key change");
    }
  }, [key]);

  async function handleLogin() {
    if (!identificador || !senha || !tipo) {
      setError("Preencha todos os campos");
      return;
    }

    setLoading(true);
    setError(null);
    setTriedConnection(true);
    setIsApiOnline(null);

    try {
      const online = await databaseService.connectionTest();
      if (!online) {
        setIsApiOnline(false);
        setError("Não foi possível conectar ao sistema.");
        return;
      }
      setIsApiOnline(true);

      // ✅ CHAMAR authenticateUser E CAPTURAR A RESPOSTA
      const response = await databaseService.authenticateUser(identificador, senha, tipo);

      // ✅ VERIFICAR SE TEM USER E TOKEN
      if (response && response.user && response.token) {
        setTimeout(() => {
          // ✅ CORREÇÃO: Passar user e token separadamente
          onLoginSuccess(response.user, response.token);
        }, 500);
        setIsLoginSuccessful(true);
      } else {
        setError("Identificador ou senha incorretos.");
        setIsLoginSuccessful(false);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Não foi possível conectar ao sistema.");
    } finally {
      setLoading(false);
    }
  }

  const handleClearFields = () => {
    setIdentificador("");
    setSenha("");
    setError(null);
  };

  const handleFillTestData = () => {
    setIdentificador(tipo === "ADMIN" ? "1000" : tipo === "PORTARIA" ? "PORT001" : "RH001");
    setSenha(tipo === "ADMIN" ? "admin123" : tipo === "PORTARIA" ? "portaria123" : "recursos456");
    setError(null);
  };

  const getTitleText = () => {
    switch (tipo) {
      case "ADMIN":
        return "ADMINISTRADOR - SISTEMA";
      case "PORTARIA":
        return "PORTARIA - CONTROLE";
      case "RH":
        return "RECURSOS HUMANOS - CONTROLE";
      default:
        return "SISTEMA DE ACESSO";
    }
  };

  const getPlaceholderText = () => {
    switch (tipo) {
      case "ADMIN":
        return "Informe seu ID de administrador";
      case "PORTARIA":
        return "Informe seu usuário da portaria";
      case "RH":
        return "Informe seu usuário do rh";
      default:
        return "Identificador";
    }
  };

  return (
    <div className="login-container" key={key}>
      <div className="login-card">
        <div className="login-header">
          <div className="logo-container">
            <Image
              src="/assets/images/logo_fatec.png"
              alt="Logo FATEC"
              width={120}
              height={70}
              className="logo-image"
              priority
            />
          </div>
        </div>

        <div className="title-section">
          <h1 className="main-title">{getTitleText()}</h1>
        </div>

        <div className="type-selector">
          <button
            className={`type-button ${tipo === "ADMIN" ? "type-button-active" : ""}`}
            onClick={() => setTipo("ADMIN")}
            disabled={loading}
            type="button"
          >
            <span className={`type-button-text ${tipo === "ADMIN" ? "type-button-text-active" : ""}`}>
              Administrador
            </span>
          </button>

          <button
            className={`type-button ${tipo === "PORTARIA" ? "type-button-active" : ""}`}
            onClick={() => setTipo("PORTARIA")}
            disabled={loading}
            type="button"
          >
            <span className={`type-button-text ${tipo === "PORTARIA" ? "type-button-text-active" : ""}`}>
              Portaria
            </span>
          </button>

          <button
            className={`type-button ${tipo === "RH" ? "type-button-active" : ""}`}
            onClick={() => setTipo("RH")}
            disabled={loading}
            type="button"
          >
            <span className={`type-button-text ${tipo === "RH" ? "type-button-text-active" : ""}`}>
              Recursos Humanos
            </span>
          </button>
        </div>

        <div className="form-section">
          <div className="input-group">
            <label className="input-label">
              {tipo === "ADMIN" ? "ID" : "Usuário"}
            </label>
            <input
              type={tipo === "ADMIN" ? "number" : "text"}
              placeholder={getPlaceholderText()}
              className="input-field"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="input-group">
            <label className="input-label">Senha</label>
            <input
              type="password"
              placeholder="Digite sua senha"
              className="input-field"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {isLoginSuccessful && (
            <div
              className="success-message"
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                backgroundColor: '#e6f9ec',
                color: '#0b6b2d',
                padding: '0.6rem 1rem',
                borderRadius: '8px',
                fontWeight: 600,
                textAlign: 'center',
                width: '100%',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M20 6L9 17l-5-5" stroke="#0b6b2d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>Login realizado com sucesso!</span>
            </div>
          )}

          <button
            className={`login-button ${loading ? "login-button-disabled" : ""}`}
            onClick={handleLogin}
            disabled={loading}
            type="button"
          >
            <span className="login-button-text">
              {loading ? "Autenticando..." : "Acessar"}
            </span>
          </button>
        </div>

        {process.env.NODE_ENV === 'development' && (
          <div className="dev-container">
            <button
              className="dev-button"
              onClick={handleFillTestData}
              disabled={loading}
              type="button"
            >
              <span className="dev-button-text">Dados de Teste</span>
            </button>
            <button
              className="dev-button"
              onClick={handleClearFields}
              disabled={loading}
              type="button"
            >
              <span className="dev-button-text">Limpar</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}