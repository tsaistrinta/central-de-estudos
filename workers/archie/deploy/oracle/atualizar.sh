#!/usr/bin/env bash
# Atualiza o Archie na Oracle depois de um push no GitHub.
set -euo pipefail
cd "$HOME/central-de-estudos" && git pull --ff-only
cd workers/archie && docker compose -f deploy/oracle/docker-compose.yml up -d --build archie
docker compose -f deploy/oracle/docker-compose.yml ps
