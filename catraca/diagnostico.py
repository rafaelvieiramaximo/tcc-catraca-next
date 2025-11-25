#!/usr/bin/env python3

from pyfingerprint.pyfingerprint import PyFingerprint
import time

def testar_sensor():
    print("🎯 INICIANDO DIAGNÓSTICO DO SENSOR BIOMÉTRICO")
    
    try:
        # Tentar conectar com o sensor
        print("1. Conectando com o sensor...")
        sensor = PyFingerprint('/dev/ttyUSB0', 57600, 0xFFFFFFFF, 0x00000000)
        
        if not sensor.verifyPassword():
            print("❌ SENHA DO SENSOR INCORRETA!")
            return False
            
        print("✅ Sensor conectado e senha verificada")
        
        # Verificar parâmetros do sensor
        print("\n2. Verificando parâmetros do sensor...")
        params = sensor.getParameters()
        print(f"   - Status do sistema: {sensor.getSystemParameters()}")
        print(f"   - Capacidade: {sensor.getStorageCapacity()} templates")
        print(f"   - Templates armazenados: {sensor.getTemplateCount()}")
        
        # Testar leitura de imagem
        print("\n3. Testando leitura de imagem...")
        print("   👉 COLOQUE O DEDO NO SENSOR AGORA...")
        
        for tentativa in range(1, 21):
            print(f"   Tentativa {tentativa}/20...")
            
            if sensor.readImage():
                print("   ✅ IMAGEM LIDA COM SUCESSO!")
                
                # Converter imagem
                sensor.convertImage(0x01)
                print("   ✅ Imagem convertida")
                
                # Tentar buscar template
                resultado = sensor.searchTemplate()
                posicao = resultado[0]
                precisao = resultado[1]
                
                print(f"   - Posição encontrada: {posicao}")
                print(f"   - Precisão: {precisao}")
                return True
            else:
                print("   ❌ Não detectou dedo, tentando novamente...")
                time.sleep(1)
        
        print("❌ FALHA: Sensor não conseguiu ler imagem após 20 tentativas")
        return False
        
    except Exception as e:
        print(f"❌ ERRO CRÍTICO: {e}")
        return False

if __name__ == "__main__":
    testar_sensor()
