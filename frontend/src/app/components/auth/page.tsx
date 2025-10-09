// components/auth/page.tsx
'use client';

import React, { useEffect, useState } from "react";
import Image from 'next/image';
import { databaseService, UsuarioCompleto, TipoUsuario } from "../../services/database-service";
import "./styles.css";

interface LoginProps {
  onLoginSuccess: (user: UsuarioCompleto) => void;
  key?: number;
}

export default function Login({ onLoginSuccess, key }: LoginProps) {
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [tipo, setTipo] = useState<TipoUsuario>("ADMIN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    try {
      const user = await databaseService.authenticateUser(identificador, senha, tipo);

      if (user && user.tipo === tipo) {
        onLoginSuccess(user);
      } else {
        setError("Identificador ou senha incorretos.");
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
    setIdentificador(tipo === "ADMIN" ? "1000" : "PORT001");
    setSenha(tipo === "ADMIN" ? "admin123" : "portaria123");
    setError(null);
  };

  const getTitleText = () => {
    switch (tipo) {
      case "ADMIN":
        return "ADMINISTRADOR - SISTEMA";
      case "PORTARIA":
        return "PORTARIA - CONTROLE";
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

          {/* Error Message */}
          {error && (
            <div className="error-message">
              {error}
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