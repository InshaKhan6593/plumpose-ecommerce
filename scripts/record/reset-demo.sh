#!/usr/bin/env sh
# The demo database the tutorial videos start from (see prepare-demo.ts).
#
#   sh scripts/record/reset-demo.sh build   # migrate + seed + prepare, then keep a copy
#   sh scripts/record/reset-demo.sh reset   # put the demo back to that copy (≈1 s)
#
# Lives in the plumpose-pg container (port 5434) beside the test database and
# never touches it or Neon. Stop the dev server before a reset: Postgres will
# not copy a database while someone is connected to it.
set -eu

CONTAINER=plumpose-pg
DEMO=plumpose_demo
BASE=plumpose_demo_base
URL="postgres://plumpose:plumpose@localhost:5434/$DEMO"

psql() { docker exec "$CONTAINER" psql -U plumpose -d postgres -v ON_ERROR_STOP=1 -qc "$1"; }
kick() { psql "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$1' AND pid <> pg_backend_pid();" >/dev/null; }

case "${1:-}" in
  build)
    kick "$DEMO"; kick "$BASE"
    psql "DROP DATABASE IF EXISTS $DEMO"
    psql "DROP DATABASE IF EXISTS $BASE"
    psql "CREATE DATABASE $DEMO"
    export DATABASE_URL="$URL" MEDIA_STORAGE=disk RESEND_API_KEY=
    pnpm payload migrate
    pnpm seed
    NODE_OPTIONS="--no-deprecation --import=tsx/esm" npx tsx scripts/record/prepare-demo.ts
    kick "$DEMO"
    psql "CREATE DATABASE $BASE TEMPLATE $DEMO"
    echo "built $DEMO and kept a copy as $BASE"
    ;;
  reset)
    kick "$DEMO"
    psql "DROP DATABASE IF EXISTS $DEMO"
    psql "CREATE DATABASE $DEMO TEMPLATE $BASE"
    echo "$DEMO reset from $BASE"
    ;;
  *)
    echo "usage: $0 build|reset" >&2
    exit 1
    ;;
esac
