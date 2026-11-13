#!/usr/bin/env bash
#
# Fails when supabase/migrations contains a version that production has not applied.
#
# Why: merging to main deploys to production immediately. If the code expects a
# column the database does not have yet, the deploy succeeds and the app breaks
# at runtime (PostgREST answers PGRST204 for every write).
#
# Usage:
#   SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@...pooler.supabase.com:5432/postgres" \
#     ./scripts/check-pending-migrations.sh

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "::error::SUPABASE_DB_URL is not set. Add the production connection string (Session pooler, port 5432) as a repository secret named SUPABASE_DB_URL."
  exit 1
fi

local_versions() {
  find supabase/migrations -maxdepth 1 -name '*.sql' -print \
    | sed -E 's#.*/([0-9]{14})_.*#\1#' \
    | sort -u
}

# stdin: applied versions, one per line. stdout: local versions missing there.
pending_versions() {
  comm -23 <(local_versions) <(sort -u)
}

if ! applied="$(psql "$SUPABASE_DB_URL" -At -v ON_ERROR_STOP=1 \
      -c 'select version from supabase_migrations.schema_migrations' 2>&1)"; then
  echo "::error::Could not read supabase_migrations.schema_migrations from production."
  echo "$applied"
  exit 1
fi

pending="$(printf '%s\n' "$applied" | pending_versions)"

if [ -n "$pending" ]; then
  count="$(printf '%s\n' "$pending" | wc -l | tr -d ' ')"
  echo "::error::Production is missing $count migration(s):"
  printf '%s\n' "$pending" | sed 's/^/  /'
  echo "Apply them before deploying: supabase db push --db-url \"\$SUPABASE_DB_URL\""
  echo "If they were already applied by hand (SQL Editor), record them instead:"
  echo "  supabase migration repair --status applied <version> [<version>...] --db-url \"\$SUPABASE_DB_URL\""
  exit 1
fi

echo "All $(local_versions | wc -l | tr -d ' ') migrations are applied to production."
