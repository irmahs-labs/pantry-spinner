#!/usr/bin/env bash
# Regenerates the test fixtures from the migrations, so the tests read the same
# rows the database holds instead of a hand-kept copy of them:
#
#   src/test/vocab.json   the eight reference tables
#   src/test/demo.json    the four demo tables
#
#   npm run db:fixtures                   # writes both into src/test/
#   OUT=/some/dir scripts/vocab-fixture.sh
#
# Needs Docker. Starts a throwaway Postgres beside any dev database, applies
# every migration, dumps each reference table as JSON, and removes it again.
set -euo pipefail
cd "$(dirname "$0")/.."
out=${OUT:-src/test}

export COMPOSE_PROJECT_NAME=sleepy-spinner-fixtures DB_PORT=
trap 'docker compose down -v --remove-orphans >/dev/null 2>&1' EXIT

docker compose up -d --wait db >/dev/null 2>&1
docker compose run --rm migrate --no-dump-schema up >/dev/null
q() { docker compose exec -T db psql -U sleepy -d sleepy_spinner -v ON_ERROR_STOP=1 -qtA "$@"; }

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
