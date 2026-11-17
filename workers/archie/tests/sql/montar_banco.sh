#!/usr/bin/env bash
# Monta um banco de teste com o schema da Central (stubs do Supabase + migrações + seed).
# Uso: bash tests/sql/montar_banco.sh postgresql://postgres@localhost/central_teste
set -euo pipefail
URL="${1:?url do banco}"
RAIZ="$(cd "$(dirname "$0")/../../../.." && pwd)"
AQUI="$(cd "$(dirname "$0")" && pwd)"
psql -q -v ON_ERROR_STOP=1 "$URL" -f "$AQUI/supabase_stub.sql"
psql -q -v ON_ERROR_STOP=1 "$URL" -f "$RAIZ/supabase/migrations/20261027000000_schema_inicial.sql"
# A migração do Archie liga extensões que o Postgres comum não tem: troca vector por real[] e tira o pg_cron.
sed -e '/create extension/d' -e '/using hnsw/d' -e '/cron.schedule/d' -e 's/extensions\.vector(1024)/real[]/' \
  "$RAIZ/supabase/migrations/20261103000001_archie.sql" | psql -q -v ON_ERROR_STOP=1 "$URL"
for f in "$RAIZ"/supabase/migrations/2026111*.sql; do psql -q -v ON_ERROR_STOP=1 "$URL" -f "$f"; done
psql -q -v ON_ERROR_STOP=1 "$URL" -f "$RAIZ/supabase/seed.sql"
