#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
INCLUDE_MONGO=0

case "${1-}" in
  mongo|--mongo|-mongo)
    INCLUDE_MONGO=1
    ;;
esac

echo "Stopping world-2..."
docker compose --env-file "$SCRIPT_DIR/world-2/.env" -f "$SCRIPT_DIR/world-2/docker-compose.yml" down

echo "Stopping world-1..."
docker compose --env-file "$SCRIPT_DIR/world-1/.env" -f "$SCRIPT_DIR/world-1/docker-compose.yml" down

if [ "$INCLUDE_MONGO" -eq 1 ]; then
  echo "Stopping optional local Mongo..."
  docker compose -f "$SCRIPT_DIR/docker-compose.mongo-local.yml" down
fi

echo "Stopping scalable base stack..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" down

echo "Scalable stack is down."
