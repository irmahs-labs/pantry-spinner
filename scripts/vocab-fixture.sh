#!/usr/bin/env bash
# Regenerates the test fixtures from the migrations, so the tests read the same
# rows the database holds instead of a hand-kept copy of them:
#
#   src/test/vocab.json   the eight reference tables
#   src/test/demo.json    the four demo tables
#
#   scripts/vocab-fixture.sh              # writes both into src/test/
#   OUT=/some/dir scripts/vocab-fixture.sh
#
# Needs a local Postgres (initdb/pg_ctl/psql on PATH). Starts a throwaway
# cluster, applies every migration, dumps each reference table as JSON, stops.
set -euo pipefail
cd "$(dirname "$0")/.."
out=${OUT:-src/test}

dir=$(mktemp -d)
trap 'pg_ctl -D "$dir/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$dir"' EXIT

initdb -D "$dir/data" -A trust -U postgres >/dev/null
pg_ctl -D "$dir/data" -o "-k $dir -p 5439 -c listen_addresses=" -l "$dir/log" start >/dev/null
q() { psql -h "$dir" -p 5439 -U postgres -v ON_ERROR_STOP=1 -qtA "$@"; }

# Just enough of Supabase for the migration to apply.
q -c "create schema auth;
      create table auth.users (id uuid primary key);
      create function auth.uid() returns uuid language sql stable as 'select null::uuid';
      create role authenticated; create role anon; create role service_role bypassrls;"
for f in supabase/migrations/*.sql; do q -f "$f" >/dev/null; done

dump() {
  local file=$1; shift
  local tables=("$@")
  {
    echo "{"
    for i in "${!tables[@]}"; do
      t="meal_planner_${tables[$i]}"
      # By whole row, which is by id first: an aggregate's "order by 1" is a
      # constant and would keep whatever order an update left on disk.
      order=$([ "$t" = meal_planner_categories ] && echo position || echo t)
      sep=$([ "$i" -lt $((${#tables[@]} - 1)) ] && echo "," || echo "")
      printf '  "%s": %s%s\n' "$t" "$(q -c "select coalesce(json_agg(t order by $order), '[]') from public.$t t")" "$sep"
    done
    echo "}"
  } > "$out/$file"
  echo "wrote $out/$file"
}

dump vocab.json categories protein_kinds vegetable_kinds starch_kinds dish_styles units cooking_methods diet_rules
dump demo.json demo_ingredients demo_ingredient_methods demo_pantry demo_shopping_list
