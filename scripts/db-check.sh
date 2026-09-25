#!/usr/bin/env bash
# ===========================================================================
# Verificação do banco em base DESCARTÁVEL: cria um banco novo, aplica os
# stubs do Supabase (auth/storage), roda TODAS as migrations na ordem (menos
# as de reversão listadas em supabase/tests/skip.txt) e executa o smoke de
# RLS por perfil. Falha (exit 1) em qualquer ERROR de migration ou FAIL do
# smoke. NUNCA aponte para um banco real: o script cria e apaga o seu.
# Uso: PGHOST=... PGPORT=... PGUSER=... PGPASSWORD=... bash scripts/db-check.sh
# ===========================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
DB="blue_check_$$"
psql -v ON_ERROR_STOP=1 -d postgres -qc "create database $DB;"
trap 'psql -d postgres -qc "drop database if exists $DB;" >/dev/null 2>&1 || true' EXIT
psql -v ON_ERROR_STOP=1 -d "$DB" -q -f supabase/tests/stubs-supabase.sql
erros=0
for f in $(ls supabase/migrations/*.sql | sort); do
  if grep -qx "$(basename "$f")" supabase/tests/skip.txt 2>/dev/null; then echo "skip  $(basename "$f")"; continue; fi
  saida=$(psql -d "$DB" -q -f "$f" 2>&1 || true)
  n=$(printf '%s' "$saida" | grep -c "ERROR" || true)
  if [ "$n" != "0" ]; then echo "ERRO  $(basename "$f")"; printf '%s\n' "$saida" | grep ERROR | head -3; erros=$((erros+n)); fi
done
echo "migrations com erro: $erros"
[ "$erros" = "0" ] || exit 1
: > /tmp/rls_smoke.out
for t in supabase/tests/rls_smoke.sql supabase/tests/smoke_*.sql; do
  [ -f "$t" ] || continue
  echo "== $(basename "$t")" >> /tmp/rls_smoke.out
  psql -d "$DB" -q -f "$t" 2>&1 | grep -E '^(PASS|FAIL)' >> /tmp/rls_smoke.out || true
done
cat /tmp/rls_smoke.out
if grep -q "^FAIL" /tmp/rls_smoke.out; then echo "Smoke: FALHOU"; exit 1; fi
echo "Smoke: OK"
