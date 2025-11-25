#!/usr/bin/env python3

import psycopg2
import time
import threading
import json
from datetime import datetime
from pyfingerprint.pyfingerprint import PyFingerprint
from flask import Flask, request, jsonify
import logging
import signal
import sys
import requests
from threading import Thread

# Configuração PostgreSQL
PG_CONFIG = {
    'host': "192.168.15.16",
    'port': "5432",
    'user': "postgres",
    'password': "rafarod",
    'database': "turnstile_system"
}

# Configuração do sensor biométrico
SENSOR_PORT = '/dev/ttyUSB0'
SENSOR_BAUD = 57600

# GPIOs (ajuste conforme sua placa)
GPIO_OUT = "/sys/class/gpio/gpio415/value"
GPIO_IN = "/sys/class/gpio/gpio412/value"

# Configuração Flask
app = Flask(__name__)

# ==================== WEBHOOK MANAGER ====================

class WebhookManager:
    def __init__(self):
        self.webhook_url = None
        
    def set_webhook_url(self, url):
        """Define a URL do webhook para notificações"""
        self.webhook_url = url
        print(f"🎯 Webhook URL definida: {url}")
        
    def enviar_webhook(self, etapa, mensagem, dados=None, success=True):
        """Envia notificação via webhook"""
        if not self.webhook_url:
            print("⚠️  Webhook URL não configurada - pulando notificação")
            return
            
        payload = {
            "etapa": etapa,
            "mensagem": mensagem,
            "dados": dados,
            "success": success,
            "timestamp": datetime.now().isoformat()
        }
        
        try:
            # Executa em thread separada para não bloquear
            Thread(target=self._enviar_webhook_async, args=(payload,), daemon=True).start()
        except Exception as e:
            print(f"❌ Erro ao agendar webhook: {e}")
    
    def _enviar_webhook_async(self, payload):
        """Envia webhook de forma assíncrona"""
        try:
            response = requests.post(
                self.webhook_url,
                json=payload,
                timeout=2,  # Timeout curto para não bloquear
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                print(f"📤 Webhook enviado com sucesso: {payload['etapa']}")
            else:
                print(f"⚠️  Webhook retornou status {response.status_code}")
                
        except requests.exceptions.Timeout:
            print("⏰ Timeout ao enviar webhook (ignorando)")
        except requests.exceptions.ConnectionError:
            print("🔌 Erro de conexão ao enviar webhook (ignorando)")
        except Exception as e:
            print(f"❌ Erro ao enviar webhook: {e}")

# Instância global do Webhook Manager
webhook_manager = WebhookManager()

# ==================== SISTEMA CATRACA ====================

class SistemaCatraca:
    def __init__(self):
        self.sensor = None
        self.modo_atual = "CONSULTA"
        self.lock_sensor = threading.Lock()
        self.cadastro_ativo = False
        self.running = True
        self.thread_consulta = None
        self.ultimo_erro_sensor = None
        self.etapa_cadastro = 'inativo'
        self.mensagem_cadastro = ""
        self.dados_cadastro_atual = None
        self.cadastro_em_andamento = False
        self.lock_cadastro = threading.Lock()
        self.thread_cadastro = None
        self.webhook_manager = webhook_manager
        self.webhook_url_cadastro_atual = None
        
    def conectar_banco(self):
        return psycopg2.connect(**PG_CONFIG)
    
    def inicializar_sensor(self):
        """Inicializa o sensor com múltiplas tentativas"""
        tentativas = 0
        max_tentativas = 3
        
        while tentativas < max_tentativas:
            try:
                print(f"🔧 Tentativa {tentativas + 1}/{max_tentativas} de conectar sensor...")
                finger = PyFingerprint(SENSOR_PORT, SENSOR_BAUD, 0xFFFFFFFF, 0x00000000)
                
                if not finger.verifyPassword():
                    raise Exception("Senha do sensor incorreta")
                
                finger.getTemplateCount()
                print("✅ Sensor biométrico inicializado e testado")
                return finger
                
            except Exception as e:
                tentativas += 1
                self.ultimo_erro_sensor = str(e)
                print(f"❌ Tentativa {tentativas} falhou: {e}")
                if tentativas < max_tentativas:
                    print("🔄 Tentando novamente em 3 segundos...")
                    time.sleep(3)
        
        print(f"❌ Não foi possível inicializar sensor após {max_tentativas} tentativas")
        return None
    
    def diagnosticar_sensor(self):
        """Faz diagnóstico completo do sensor"""
        if not self.sensor:
            print("❌ Sensor não inicializado")
            return False
            
        try:
            print("🔍 Diagnosticando sensor...")
            
            print(f"   - Templates armazenados: {self.sensor.getTemplateCount()}")
            print(f"   - Capacidade total: {self.sensor.getStorageCapacity()}")
            
            # Testar leitura rápida
            print("   - Testando leitura (aguarde 3 segundos)...")
            for i in range(3):
                if self.sensor.readImage():
                    print("   ✅ Sensor consegue ler imagens!")
                    return True
                time.sleep(1)
            
            print("   ⚠️ Sensor não detecta digitais (pode ser normal se não houver dedo)")
            return True
            
        except Exception as e:
            print(f"   ❌ Erro no diagnóstico: {e}")
            return False
    
    def set_gpio(self, path, value):
        try:
            with open(path, "w") as f:
                f.write(str(value))
        except Exception as e:
            print(f"❌ Erro GPIO {path}: {e}")
    
    def ler_gpio(self, path):
        try:
            with open(path, "r") as f:
                return int(f.read().strip())
        except Exception as e:
            print(f"❌ Erro leitura GPIO {path}: {e}")
            return 0
    
    def get_periodo(self):
        hora = datetime.now().hour
        if 5 <= hora < 12:
            return "MANHA"
        elif 12 <= hora < 19:
            return "TARDE"
        else:
            return "NOITE"
    
    def acesso_por_biometria(self):
        if not self.sensor:
            return None
            
        try:
            with self.lock_sensor:
                tempo_inicio = time.time()
                timeout = 5
                
                while time.time() - tempo_inicio < timeout:
                    if self.sensor.readImage():
                        break
                    time.sleep(0.1)
                else:
                    # Timeout - nenhum dedo detectado
                    return None
                
                self.sensor.convertImage(0x01)
                result = self.sensor.searchTemplate()
                positionNumber = result[0]
                
                if positionNumber == -1:
                    # Digital não encontrada no sensor
                    return None
                
                conn = self.conectar_banco()
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT u.id, u.nome, u.tipo, u.identificador
                    FROM usuario u
                    JOIN user_finger uf ON u.id = uf.user_id
                    WHERE uf.template_position = %s
                """, (positionNumber,))
                usuario = cursor.fetchone()
                cursor.close()
                conn.close()
                
                return usuario if usuario else None
                
        except Exception as e:
            print(f"❌ Erro na autenticação: {e}")
            if "connection" in str(e).lower() or "timeout" in str(e).lower():
                print("🔄 Tentando reinicializar sensor...")
                self.sensor = self.inicializar_sensor()
            return None
    
    def registrar_acesso(self, usuario_id, nome, tipo, identificador):
        try:
            conn = self.conectar_banco()
            cursor = conn.cursor()
            periodo = self.get_periodo()
            data = datetime.now().strftime("%Y-%m-%d")
            hora = datetime.now().strftime("%H:%M:%S")
            
            cursor.execute("""
                INSERT INTO log_entrada (usuario_id, nome, tipo, periodo, identificador)
                VALUES (%s, %s, %s, %s, %s)
            """, (usuario_id, nome, tipo, periodo, identificador))
            conn.commit()
            cursor.close()
            conn.close()
            
            print(f"📌 Acesso registrado - {nome} em {data} {hora} ({periodo})")
            
        except Exception as e:
            print(f"❌ Erro ao registrar acesso: {e}")
    
    def liberar_catraca(self):
        self.set_gpio(GPIO_OUT, 1)
        print("🔓 Catraca liberada")
        
        for i in range(80):  # 8 segundos
            if self.ler_gpio(GPIO_IN) == 1:
                print("✅ Passagem detectada")
                time.sleep(1)
                self.set_gpio(GPIO_OUT, 0)
                print("🔒 Catraca fechada")
                return True
            time.sleep(0.1)
        
        print("⏱️ Timeout - Usuário não passou")
        self.set_gpio(GPIO_OUT, 0)
        return False

    def cadastrar_biometria(self, user_id, identificador, nome, webhook_url=None):
        with self.lock_cadastro:
            if self.cadastro_em_andamento:
                return {"success": False, "message": "Já existe um cadastro em andamento"}
            
            # 🛑 PARAR MODO CONSULTA durante o cadastro
            self.modo_atual = "CADASTRO"
            print("🛑 Modo consulta pausado para cadastro")
            # Configurar webhook para este cadastro
            if webhook_url:
                self.webhook_url_cadastro_atual = webhook_url
                self.webhook_manager.set_webhook_url(webhook_url)
                print(f"🎯 Webhook configurado para este cadastro: {webhook_url}")
            
            self.cadastro_em_andamento = True
            self.etapa_cadastro = 'iniciando'
            self.mensagem_cadastro = "Iniciando processo de cadastro"
            self.dados_cadastro_atual = {
                'user_id': user_id,
                'identificador': identificador,
                'nome': nome
            }

        try:
            print(f"👤 Iniciando cadastro para: {nome}")

            # 🎯 ETAPA 1: INICIALIZAÇÃO - NOTIFICAR VIA WEBHOOK
            self.webhook_manager.enviar_webhook('iniciando', 'Iniciando cadastro de biometria...')
            time.sleep(2)

            self.webhook_manager.enviar_webhook('conectado', 'Conectando com a catraca...')
            time.sleep(1)

            # ============ PRIMEIRA LEITURA ============
            self.webhook_manager.enviar_webhook('aguardando_primeira', 'Coloque o dedo no sensor para a primeira leitura')
            print("👉 PRIMEIRA LEITURA - Coloque o dedo no sensor...")

            # 🎯 AGUARDAR PRIMEIRA LEITURA COM TIMEOUT
            tempo_inicio = time.time()
            timeout = 30
            primeira_lida = False

            while time.time() - tempo_inicio < timeout:
                with self.lock_cadastro:
                    if self.etapa_cadastro == 'cancelar':
                        self.webhook_manager.enviar_webhook('cancelado', 'Cadastro cancelado pelo usuário', success=False)
                        return {"success": False, "message": "Cadastro cancelado"}
                
                if self.sensor.readImage():
                    primeira_lida = True
                    break
                
                # 🎯 ATUALIZAR MENSAGEM PERIODICAMENTE VIA WEBHOOK
                if int(time.time() - tempo_inicio) % 5 == 0:
                    tempo_restante = int(timeout - (time.time() - tempo_inicio))
                    self.webhook_manager.enviar_webhook('aguardando_primeira', f'Aguardando primeira leitura... {tempo_restante}s restantes')
                time.sleep(0.1)
            
            if not primeira_lida:
                self.webhook_manager.enviar_webhook('erro', 'Timeout - falha ao detectar dedo na primeira leitura', success=False)
                return {"success": False, "message": "Timeout - falha ao detectar dedo na primeira leitura"}

            # 🎯 PRIMEIRA LEITURA CAPTURADA
            self.sensor.convertImage(0x01)
            
            self.webhook_manager.enviar_webhook('primeira_capturada', 'Primeira digital capturada com sucesso!')
            print("✅ Primeira leitura capturada")
            time.sleep(2)

            # 🎯 VERIFICAR SE DIGITAL JÁ EXISTE
            self.webhook_manager.enviar_webhook('verificando_existente', 'Verificando se digital já está cadastrada...')
            time.sleep(1)

            result = self.sensor.searchTemplate()
            if result[0] >= 0:
                mensagem = f"Digital já cadastrada na posição {result[0]}"
                self.webhook_manager.enviar_webhook('erro', mensagem, success=False)
                return {"success": False, "message": mensagem}

            # ============ SEGUNDA LEITURA ============
            self.webhook_manager.enviar_webhook('aguardando_segunda', 'Remova e coloque o mesmo dedo novamente para confirmar')
            print("👉 SEGUNDA LEITURA - Remova e coloque o mesmo dedo novamente...")
            time.sleep(3)

            # 🎯 AGUARDAR SEGUNDA LEITURA
            tempo_inicio = time.time()
            segunda_lida = False

            while time.time() - tempo_inicio < timeout:
                with self.lock_cadastro:
                    if self.etapa_cadastro == 'cancelar':
                        self.webhook_manager.enviar_webhook('cancelado', 'Cadastro cancelado pelo usuário', success=False)
                        return {"success": False, "message": "Cadastro cancelado"}
                
                if self.sensor.readImage():
                    segunda_lida = True
                    break
                
                # 🎯 ATUALIZAR MENSAGEM PERIODICAMENTE VIA WEBHOOK
                if int(time.time() - tempo_inicio) % 5 == 0:
                    tempo_restante = int(timeout - (time.time() - tempo_inicio))
                    self.webhook_manager.enviar_webhook('aguardando_segunda', f'Aguardando segunda leitura... {tempo_restante}s restantes')
                time.sleep(0.1)

            if not segunda_lida:
                self.webhook_manager.enviar_webhook('erro', 'Timeout - falha ao detectar dedo na segunda leitura', success=False)
                return {"success": False, "message": "Timeout - falha ao detectar dedo na segunda leitura"}

            # 🎯 SEGUNDA LEITURA CAPTURADA
            self.sensor.convertImage(0x02)
            
            self.webhook_manager.enviar_webhook('segunda_capturada', 'Segunda digital capturada com sucesso!')
            print("✅ Segunda leitura capturada")
            time.sleep(2)

            # ============ VALIDAÇÃO ============
            self.webhook_manager.enviar_webhook('validando', 'Validando correspondência das digitais...')
            time.sleep(2)

            # 🎯 COMPARAR DIGITAIS
            similarity = self.sensor.compareCharacteristics()
            print(f"🔍 Similaridade das digitais: {similarity}")

            if similarity == 0:
                self.webhook_manager.enviar_webhook('erro', 'Digitais não correspondem. Tente novamente.', success=False)
                return {"success": False, "message": "Digitais não correspondem"}

            self.webhook_manager.enviar_webhook('validacao_ok', 'Digitais correspondem! Salvando...')
            time.sleep(1)

            # ============ SALVANDO ============
            self.webhook_manager.enviar_webhook('salvando', 'Salvando digital no banco de dados...')
            time.sleep(1)

            # 🎯 ARMAZENAR TEMPLATE
            position = self.sensor.storeTemplate()
            print(f"✅ Digital armazenada na posição {position}")

            # 🎯 SALVAR NO BANCO DE DADOS
            conn = self.conectar_banco()
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO user_finger (user_id, template_position)
                VALUES (%s, %s)
                ON CONFLICT (user_id) DO UPDATE SET template_position = EXCLUDED.template_position
            """, (user_id, position))
            conn.commit()
            cursor.close()
            conn.close()

            # ============ FINALIZAÇÃO ============
            self.webhook_manager.enviar_webhook('finalizado', f'Cadastro finalizado com sucesso! Digital salva na posição {position}')
            time.sleep(2)

            self.webhook_manager.enviar_webhook('sucesso', f'Biometria cadastrada com sucesso para {nome}', {'posicao': position})

            return {
                "success": True, 
                "message": f"Digital vinculada ao usuário {nome}",
                "position": position
            }

        except Exception as e:
            error_message = str(e)
            print(f"🎯 [CATRACA ERRO] Erro detectado no cadastro: {error_message}")

            if 'timeout' in error_message.lower():
             mensagem_usuario = "Tempo esgotado - não foi detectada a digital no sensor"
            elif 'disconnected' in error_message.lower() or 'device' in error_message.lower():
             mensagem_usuario = "Problema de conexão com o sensor biométrico"
            elif 'already' in error_message.lower() or 'exist' in error_message.lower():
             mensagem_usuario = "Digital já cadastrada no sistema"
            elif 'compare' in error_message.lower() or 'not match' in error_message.lower():
             mensagem_usuario = "As digitais não correspondem - tente novamente"
            elif 'password' in error_message.lower() or 'senha' in error_message.lower():
             mensagem_usuario = "Erro de autenticação no sensor"
            else:
             mensagem_usuario = f"Erro técnico: {str(e)}"

            print(f"❌ [CATRACA] Mensagem de erro para usuário: {mensagem_usuario}")
        
        # ✅ ENVIAR WEBHOOK DE ERRO COM LOG DETALHADO
            webhook_data = {
                'etapa': 'erro',
                'mensagem': mensagem_usuario,  # ← MENSAGEM AMIGÁVEL
                'dados': {
                    'erro_tecnico': error_message,  # ← ERRO TÉCNICO COMPLETO
                    'user_id': user_id,
                    'identificador': identificador,
                    'nome': nome,
                    'timestamp': datetime.now().isoformat()
                },
                'success': False,
                'session_id': f"session_{user_id}_{int(time.time())}"  # ← SESSION ID CONSISTENTE
            }
            print(f"📨 [CATRACA] Enviando webhook de erro: {webhook_data}")
            
            self.webhook_manager.enviar_webhook('erro', mensagem_usuario, {
                'erro_tecnico': str(e),
                'user_id': user_id,
                'timestamp': datetime.now().isoformat()
            }, success=False)

            return {"success": False, "message": mensagem_usuario}

        finally:
            with self.lock_cadastro:
                self.cadastro_em_andamento = False
                self.modo_atual = "CONSULTA"
                print("✅ Modo consulta restaurado")
                if self.etapa_cadastro not in ['finalizado', 'erro']:
                    self.etapa_cadastro = 'inativo'
                    self.mensagem_cadastro = "Processo finalizado"
                # Limpar webhook após cadastro
                self.webhook_url_cadastro_atual = None

    def _executar_cadastro(self, user_id, identificador, nome, webhook_url=None):
        """Executa o cadastro em thread separada"""
        try:
            print(f"🧵 Iniciando thread de cadastro para usuário {user_id}")
            resultado = self.cadastrar_biometria(user_id, identificador, nome, webhook_url)
            print(f"🧵 Thread de cadastro finalizada: {resultado}")
        except Exception as e:
            print(f"❌ Erro na thread de cadastro: {e}")
            self.webhook_manager.enviar_webhook('erro', f"Erro na execução: {str(e)}", success=False)

    def iniciar_cadastro_assincrono(self, user_id, identificador, nome, webhook_url=None):
        """Inicia o cadastro de forma assíncrona"""
        with self.lock_cadastro:
            if self.cadastro_em_andamento:
                return {"success": False, "message": "Já existe um cadastro em andamento"}
            
            # Resetar estado anterior
            self.etapa_cadastro = 'iniciando'
            self.mensagem_cadastro = "Preparando sistema para cadastro..."
            self.dados_cadastro_atual = {
                'user_id': user_id,
                'identificador': identificador,
                'nome': nome
            }

        # Iniciar thread
        self.thread_cadastro = threading.Thread(
            target=self._executar_cadastro, 
            args=(user_id, identificador, nome, webhook_url)
        )
        self.thread_cadastro.daemon = True
        self.thread_cadastro.start()

        return {
            "success": True, 
            "message": "Cadastro de biometria iniciado",
            "etapa": "iniciando"
        }
    
    def modo_consulta(self):
        print("🔄 Iniciando modo consulta...")
        contador_erro = 0
        max_erros_consecutivos = 5
        
        while self.running:
            try:
                # ✅ NÃO PROCESSAR CONSULTA se estiver em modo CADASTRO
                if self.modo_atual == "CADASTRO":
                    time.sleep(1)
                    continue
                    
                if self.modo_atual == "CONSULTA" and self.sensor and not self.cadastro_ativo:
                    usuario = self.acesso_por_biometria()
                    
                    if usuario:
                        usuario_id, nome, tipo, identificador = usuario
                        print(f"✅ Acesso permitido: {nome}")
                        
                        if self.liberar_catraca():
                            self.registrar_acesso(usuario_id, nome, tipo, identificador)
                        contador_erro = 0
                    else:
                        contador_erro += 1
                        if contador_erro >= max_erros_consecutivos:
                            print("⚠️ Muitos erros consecutivos, verificando sensor...")
                            if not self.diagnosticar_sensor():
                                print("❌ Sensor com problemas, tentando reinicializar...")
                                self.sensor = self.inicializar_sensor()
                            contador_erro = 0
                        
                        time.sleep(0.5)  
                else:
                    time.sleep(1) 
                    
            except Exception as e:
                print(f"❌ Erro no modo consulta: {e}")
                contador_erro += 1
                time.sleep(2)
        
        print("🛑 Modo consulta finalizado")
    
    def parar(self):
        self.running = False
        if self.thread_consulta:
            self.thread_consulta.join(timeout=5)
        print("🛑 Sistema da catraca parado")

# Instância global do sistema
sistema = SistemaCatraca()

# ==================== ROTAS REST API ====================

@app.route('/api/biometry', methods=['GET'])
def api_biometry_get():
    """Endpoint GET para consultar status atual"""
    try:
        with sistema.lock_cadastro:
            return jsonify({
                "etapa": sistema.etapa_cadastro,
                "mensagem": sistema.mensagem_cadastro,
                "dados": sistema.dados_cadastro_atual,
                "success": True
            })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Erro interno: {str(e)}"
        }), 500

@app.route('/api/catraca/iniciar-cadastro', methods=['POST'])
def iniciar_cadastro():
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        identificador = data.get('identificador')
        nome = data.get('nome')
        webhook_url = data.get('webhook_url')  # ✅ Nova: receber URL do webhook

        if not user_id or not identificador:
            return jsonify({
                "success": False,
                "message": "user_id e identificador são obrigatórios"
            }), 400

        print(f"🎯 Recebido comando de cadastro para usuário {user_id}")
        if webhook_url:
            print(f"🎯 Webhook URL recebida: {webhook_url}")

        return jsonify(sistema.iniciar_cadastro_assincrono(user_id, identificador, nome, webhook_url))

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Erro interno: {str(e)}"
        }), 500

@app.route('/api/cancelar-cadastro', methods=['POST'])
def cancelar_cadastro():
    try:
        with sistema.lock_cadastro:
            if sistema.cadastro_em_andamento:
                sistema.etapa_cadastro = 'cancelado'
                sistema.mensagem_cadastro = "Cadastro cancelado pelo usuário"
                sistema.cadastro_em_andamento = False
                
                # Notificar via Webhook
                sistema.webhook_manager.enviar_webhook('cancelado', 'Cadastro cancelado pelo usuário', success=False)
                
        return jsonify({
            "success": True,
            "message": "Cadastro cancelado"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Erro ao cancelar: {str(e)}"
        }), 500

@app.route('/api/cadastro-status', methods=['GET'])
def cadastro_status():
    try:
        with sistema.lock_cadastro:
            return jsonify({
                "etapa": sistema.etapa_cadastro,
                "mensagem": sistema.mensagem_cadastro,
                "dados": sistema.dados_cadastro_atual,
                "em_andamento": sistema.cadastro_em_andamento,
                "timestamp": datetime.now().isoformat()
            })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Erro ao obter status: {str(e)}"
        }), 500

@app.route('/api/catraca/status', methods=['GET'])
def status():
    try:
        sensor_status = "conectado" if sistema.sensor else "erro"
        online = sistema.sensor is not None
        
        return jsonify({
            "success": True,
            "online": online,
            "modo": sistema.modo_atual,
            "sensor_status": sensor_status,
            "cadastro_ativo": sistema.cadastro_ativo
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Erro ao verificar status: {str(e)}"
        }), 500

@app.route('/api/catraca/teste-catraca', methods=['POST'])
def teste_catraca():
    try:
        sistema.liberar_catraca()
        return jsonify({
            "success": True,
            "message": "Teste de catraca executado"
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Erro no teste: {str(e)}"
        }), 500

@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        "status": "online",
        "service": "catraca_api",
        "sensor_connected": sistema.sensor is not None,
        "timestamp": datetime.now().isoformat()
    })

@app.route('/api/diagnostico', methods=['GET'])
def diagnostico():
    try:
        sensor_ok = sistema.diagnosticar_sensor() if sistema.sensor else False
        
        return jsonify({
            "sensor_conectado": sistema.sensor is not None,
            "sensor_operacional": sensor_ok,
            "modo_atual": sistema.modo_atual,
            "ultimo_erro": sistema.ultimo_erro_sensor
        })
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

def signal_handler(sig, frame):
    print('\n🛑 Recebido sinal de desligamento...')
    sistema.parar()
    sys.exit(0)

def iniciar_sistema():
    print("🚀 Iniciando Sistema da Catraca (Webhook + REST API)...")
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # Inicializar sensor
    sistema.sensor = sistema.inicializar_sensor()
    
    if sistema.sensor:
        sistema.diagnosticar_sensor()
    else:
        print("⚠️ Sistema iniciando sem sensor - modo offline")
    
    # Iniciar thread de consulta
    sistema.thread_consulta = threading.Thread(target=sistema.modo_consulta, daemon=True)
    sistema.thread_consulta.start()
    print("✅ Thread de consulta iniciada")
    
    print("✅ Servidor REST API iniciado na porta 5000")
    print("📍 Endpoints disponíveis:")
    print("   - POST http://192.168.11.220:5000/api/catraca/iniciar-cadastro")
    print("   - GET  http://192.168.11.220:5000/api/catraca/status")
    print("   - GET  http://192.168.11.220:5000/api/health")
    print("   - GET  http://192.168.11.220:5000/api/diagnostico")
    print("   - GET  http://192.168.11.220:5000/api/biometry")
    print("   - GET  http://192.168.11.220:5000/api/cadastro-status")
    print("   - POST http://192.168.11.220:5000/api/cancelar-cadastro")
    print("🔌 Webhook disponível via POST para: http://seu-nodejs:3001/api/webhook/biometria")
    
    # Manter endpoints REST para compatibilidade, mas priorizar webhook
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)

if __name__ == "__main__":
    iniciar_sistema()