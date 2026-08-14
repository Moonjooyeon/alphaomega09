#!/bin/sh
set -eu

: "${POSTGRES_ADMIN_URL:?POSTGRES_ADMIN_URL is required}"
: "${POSTGRES_URL:?POSTGRES_URL is required}"

case "$POSTGRES_URL" in
  postgresql://sentiguide:*@db:5432/sentiguide) ;;
  *)
    echo "POSTGRES_URL must target postgresql://sentiguide:<password>@db:5432/sentiguide" >&2
    exit 1
    ;;
esac

credentials="${POSTGRES_URL#postgresql://}"
credentials="${credentials%%@*}"
app_password="${credentials#*:}"

case "$app_password" in
  *[!0-9a-fA-F]*|'')
    echo "The generated SentiGuide database password must be hexadecimal" >&2
    exit 1
    ;;
esac

attempt=0
until pg_isready --dbname="$POSTGRES_ADMIN_URL" >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "PostgreSQL did not become ready in time" >&2
    exit 1
  fi
  sleep 2
done

psql "$POSTGRES_ADMIN_URL" --set=ON_ERROR_STOP=1 --set=app_password="$app_password" <<'SQL'
select format('create role sentiguide login password %L', :'app_password')
where not exists (select 1 from pg_roles where rolname = 'sentiguide') \gexec

select format('alter role sentiguide login password %L', :'app_password') \gexec

select 'create database sentiguide owner sentiguide'
where not exists (select 1 from pg_database where datname = 'sentiguide') \gexec
SQL

psql "$POSTGRES_URL" --set=ON_ERROR_STOP=1 --command='select 1' >/dev/null
