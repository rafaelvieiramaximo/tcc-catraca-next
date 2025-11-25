echo "=== Configurando autologin no tty1 ==="
mkdir -p /etc/systemd/system/getty@tty1.service.d

cat > /etc/systemd/system/getty@tty1.service.d/autologin.conf <<EOF
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin $USER --noclear %I \$TERM
EOF

echo "=== Recarregando systemd ==="
systemctl daemon-reexec
systemctl daemon-reload

echo "=== Criando ~/.bash_profile para autostart no terminal ==="
cat > /home/$USER/.bash_profile <<EOF
# ~/.bash_profile — inicia GPIO e Python automaticamente no terminal principal

if [ "\$(tty)" = "/dev/tty1" ]; then
    clear
    echo "======================================"
    echo " Sistema iniciado — executando GPIO..."
    echo "======================================"
    sleep 5
    bash $SH_SCRIPT
    echo ""
    echo "Iniciando script Python..."
    echo "--------------------------------------"
    python3 $PY_SCRIPT
    echo "--------------------------------------"
    echo "Programa Python finalizado."
    echo "Pressione Ctrl+C para sair."
fi
EOF

chown $USER:$USER /home/$USER/.bash_profile

echo "=== Configuração concluída! ==="
echo "Na próxima inicialização, o sistema logará automaticamente em $USER"
echo "e exibirá o programa Python rodando direto no terminal."

