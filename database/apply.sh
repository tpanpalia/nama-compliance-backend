#!/usr/bin/env bash
# apply.sh — apply all PostgreSQL functions against the target database
#
# Usage:
#   ./database/apply.sh                  # uses .env.development (default)
#   NODE_ENV=production ./database/apply.sh
#
# Requires: psql on PATH + DATABASE_URL set in the env file

set -e

ENV=${NODE_ENV:-development}
ENV_FILE=".env.${ENV}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: $ENV_FILE not found"
  exit 1
fi

# Load env file
export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)

if [ -z "$DIRECT_URL" ]; then
  echo "Error: DIRECT_URL not set in $ENV_FILE"
  exit 1
fi

FUNCTIONS_DIR="$(dirname "$0")/functions"

echo "Applying PostgreSQL functions from $FUNCTIONS_DIR against [$ENV] database..."

for sql_file in "$FUNCTIONS_DIR"/*.sql; do
  echo "  → $(basename "$sql_file")"
  psql "$DIRECT_URL" -f "$sql_file"
done

echo "Done."
