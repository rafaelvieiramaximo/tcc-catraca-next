#!/usr/bin/env python3

from pyfingerprint.pyfingerprint import PyFingerprint
import sys
import psycopg2

PG_CONFIG = {
    'host': "192.168.15.16",
    'port': "5432",
    'user': "postgres",
    'password': "rafarod",
    'database': "turnstile_system"
}

class GerenciamentoDigital:

    def conectar_banco(self):
        return psycopg2.connect(**PG_CONFIG)

    def limpar_templates(self):
        """Limpa todos os templates do sensor e esvazia a tabela user_finger no banco."""
        try:
            # Conectar ao sensor
            sensor = PyFingerprint('/dev/ttyUSB0', 57600, 0xFFFFFFFF, 0x00000000)
            
            if not sensor.verifyPassword():
                print("❌ Erro na autenticação do sensor")
                return False
            
            # Verificar quantidade atual de templates
            templates_antes = sensor.getTemplateCount()
            capacidade = sensor.getStorageCapacity()
            
            print(f"📊 Antes da limpeza: {templates_antes}/{capacidade} templates")
            
            if templates_antes == 0:
                print("✅ Sensor já está vazio")
                return True
            
            # Confirmar a ação
            confirmacao = input("⚠️  Tem certeza que deseja apagar TODOS os templates? (s/N): ")
            if confirmacao.lower() != 's':
                print("❌ Operação cancelada")
                return False
            
            # Limpar todos os templates do sensor
            print("🧹 Limpando todos os templates do sensor...")
            sensor.clearDatabase()
    
            # Limpar tabela no banco de dados
            conn = self.conectar_banco()
            cursor = conn.cursor()
            cursor.execute("TRUNCATE TABLE user_finger;")
            conn.commit()
            cursor.close()
            conn.close()
            
            # Verificar resultado no sensor
            templates_depois = sensor.getTemplateCount()
            print(f"✅ Limpeza concluída: {templates_depois}/{capacidade} templates")
            
            return True
            
        except Exception as e:
            print(f"❌ Erro ao limpar templates: {e}")
            return False

if __name__ == "__main__":
    GerenciamentoDigital().limpar_templates()