#!/usr/bin/env bash
# Prepara a máquina da Oracle (Ubuntu 24.04, ARM) para o Archie. Rode uma vez, logado por SSH:
#   curl -fsSL https://raw.githubusercontent.com/tsaistrinta/central-de-estudos/main/workers/archie/deploy/oracle/instalar.sh | bash
# Não pede nem grava senha nenhuma: o .env com as chaves você cria à mão no fim (passo 6 do guia).
set -euo pipefail

echo "==> Atualizando o sistema e ligando as atualizações de segurança automáticas"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
sudo apt-get install -y ca-certificates curl git unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "==> Memória extra (swap de 4 GB) para o modelo não faltar memória"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

echo "==> Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi
sudo systemctl enable --now docker

echo "==> Código do projeto"
if [ ! -d "$HOME/central-de-estudos" ]; then
  git clone https://github.com/tsaistrinta/central-de-estudos.git "$HOME/central-de-estudos"
else
  git -C "$HOME/central-de-estudos" pull --ff-only
fi
cd "$HOME/central-de-estudos/workers/archie"
[ -f .env ] || { cp .env.example .env; chmod 600 .env; }

cat <<'FIM'

Pronto. Falta só:
  1. Preencher o .env:    nano ~/central-de-estudos/workers/archie/.env
     (DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; ARCHIE_MODELO=qwen3.5:9b)
  2. Sair e entrar de novo no SSH (para o Docker funcionar sem sudo).
  3. Ligar:   cd ~/central-de-estudos/workers/archie && docker compose -f deploy/oracle/docker-compose.yml up -d --build
  4. Ver:     docker compose -f deploy/oracle/docker-compose.yml logs -f archie
A primeira vez baixa o modelo (uns 7 GB) e pode levar 10 a 20 minutos.
FIM
