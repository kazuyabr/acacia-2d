#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TEMPLATE_DIR="$SCRIPT_DIR/world"
TEMPLATE_ENV="$TEMPLATE_DIR/.env.example"
START_AFTER_CREATE=0

case "${1-}" in
  up|--up|-up)
    START_AFTER_CREATE=1
    ;;
esac

if [ ! -d "$TEMPLATE_DIR" ]; then
  echo "World template directory not found: $TEMPLATE_DIR" >&2
  exit 1
fi

if [ ! -f "$TEMPLATE_ENV" ]; then
  echo "World template env file not found: $TEMPLATE_ENV" >&2
  exit 1
fi

MAX_WORLD=0
for DIR in "$SCRIPT_DIR"/world-*; do
  if [ ! -d "$DIR" ]; then
    continue
  fi

  NAME=$(basename "$DIR")
  case "$NAME" in
    world-*)
      NUMBER=${NAME#world-}
      case "$NUMBER" in
        ''|*[!0-9]*)
          continue
          ;;
      esac
      if [ "$NUMBER" -gt "$MAX_WORLD" ]; then
        MAX_WORLD=$NUMBER
      fi
      ;;
  esac
done

NEXT_NUMBER=$((MAX_WORLD + 1))
WORLD_NAME="world-$NEXT_NUMBER"
TARGET_DIR="$SCRIPT_DIR/$WORLD_NAME"
TARGET_ENV="$TARGET_DIR/.env"
CHANNEL_ID=$NEXT_NUMBER
REALM_ID='realm-1'
SERVER_ID=$((100 + NEXT_NUMBER))
GAME_PORT=$((9101 + ((NEXT_NUMBER - 1) * 2)))
API_PORT=$((GAME_PORT + 1))
COMPOSE_PROJECT_NAME="acacia-scalable-$WORLD_NAME"
DISPLAY_NAME="Shinobi Farm - Realm 1 Channel $CHANNEL_ID"
COMPOSE_FILE="$TARGET_DIR/docker-compose.yml"

if [ -e "$TARGET_DIR" ]; then
  echo "Target directory already exists: $TARGET_DIR" >&2
  exit 1
fi

echo "Creating $WORLD_NAME from template..."
cp -R "$TEMPLATE_DIR" "$TARGET_DIR"
cp "$TEMPLATE_ENV" "$TARGET_ENV"

python - "$TARGET_ENV" "$WORLD_NAME" "$COMPOSE_PROJECT_NAME" "$REALM_ID" "$CHANNEL_ID" "$SERVER_ID" "$GAME_PORT" "$API_PORT" "$DISPLAY_NAME" <<'PY'
import pathlib
import sys

env_path = pathlib.Path(sys.argv[1])
world_name = sys.argv[2]
compose_project_name = sys.argv[3]
realm_id = sys.argv[4]
channel_id = sys.argv[5]
server_id = sys.argv[6]
game_port = sys.argv[7]
api_port = sys.argv[8]
display_name = sys.argv[9]

replacements = {
    'COMPOSE_PROJECT_NAME': compose_project_name,
    'WORLD_DIRECTORY': world_name,
    'REALM_ID': realm_id,
    'CHANNEL_ID': channel_id,
    'PUBLIC_GAME_PORT': game_port,
    'PUBLIC_API_PORT': api_port,
    'NAME': f"'{display_name}'",
    'PORT': game_port,
    'API_PORT': api_port,
    'SERVER_ID': server_id,
    'DISCORD_CHANNEL_ID': channel_id,
}

lines = env_path.read_text(encoding='utf-8').splitlines()
updated = []
for line in lines:
    if '=' in line:
        key, _ = line.split('=', 1)
        if key in replacements:
            updated.append(f"{key}={replacements[key]}")
            continue
    updated.append(line)

env_path.write_text('\n'.join(updated) + '\n', encoding='utf-8')
PY

echo "Created $WORLD_NAME"
echo "- Directory: $TARGET_DIR"
echo "- Env file: $TARGET_ENV"
echo "- Realm ID: $REALM_ID"
echo "- Channel ID: $CHANNEL_ID"
echo "- Server ID: $SERVER_ID"
echo "- Game/API ports: $GAME_PORT / $API_PORT"

if [ "$START_AFTER_CREATE" -eq 1 ]; then
  echo "Starting $WORLD_NAME..."
  docker compose --env-file "$TARGET_ENV" -f "$COMPOSE_FILE" up --build -d
  echo "$WORLD_NAME is up."
else
  echo "Run to start manually: docker compose --env-file \"$TARGET_ENV\" -f \"$COMPOSE_FILE\" up --build -d"
fi
