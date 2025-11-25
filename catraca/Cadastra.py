#!/usr/bin/env python3

import psycopg2
from pyfingerprint.pyfingerprint import PyFingerprint

# Configuração PostgreSQL
PG_CONFIG = {
    'host': "192.168.15.14",
    'port': "5432",
    'user': "postgres",
    'password': "rafarod",
    'database': "turnstile_system"
}

SENSOR_PORT = '/dev/ttyUSB0'
SENSOR_BAUD = 57600


def conectar_banco():
    return psycopg2.connect(**PG_CONFIG)


def inicializar_sensor():
    try:
        finger = PyFingerprint(SENSOR_PORT, SENSOR_BAUD, 0xFFFFFFFF, 0x00000000)
        if not finger.verifyPassword():
            raise Exception("Senha incorreta do sensor")
        print("✅ Sensor inicializado")
        return finger
    except Exception as e:
        print("❌ Erro ao inicializar sensor:", e)
        return None


def cadastrar_biometria(finger, identificador, nome, id):
    try:
        print(f"👤 Cadastrando digital para: {nome} (Identificador: {identificador})")
        usuario_id = id
        print("👉 Coloque o dedo no sensor...")
        while not finger.readImage():
            pass
        finger.convertImage(0x01)

        result = finger.searchTemplate()
        if result[0] >= 0:
            print("⚠️ Digital já cadastrada na posição", result[0])
            return False

        print("👉 Remova e coloque o mesmo dedo novamente...")
        while finger.readImage():
            pass
        while not finger.readImage():
            pass
        finger.convertImage(0x02)

        if finger.compareCharacteristics() == 0:
            print("❌ Digitais não correspondem, tente novamente")
            return False

        position = finger.storeTemplate()
        print("✅ Digital armazenada na posição", position)

        conn = conectar_banco()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO user_finger (user_id, template_position)
            VALUES (%s, %s)
            ON CONFLICT (user_id) DO UPDATE SET template_position = EXCLUDED.template_position
        """, (usuario_id, position))
        conn.commit()
        cursor.close()
        conn.close()

        print(f"📝 Digital vinculada ao usuário {nome} (Identificador: {identificador})")
        return True

    except Exception as e:
        print("❌ Erro ao cadastrar digital:", e)
        return False


if __name__ == "__main__":
    finger = inicializar_sensor()
    if finger:
        while True:
            identificador = input("\nDigite o identificador do usuário (ou 'sair' para encerrar): ").strip()
            if identificador.lower() == "sair":
                print("👋 Encerrando programa.")
                break

            conn = conectar_banco()
            cursor = conn.cursor()
            cursor.execute("SELECT identificador, nome, id FROM usuario WHERE identificador = %s", (identificador,))
            usuario = cursor.fetchone()
            cursor.close()
            conn.close()

            if usuario:
                identificador, nome, id = usuario
                cadastrar_biometria(finger, identificador, nome, id)
            else:
                print("❌ Usuário não encontrado no banco de dados.")
