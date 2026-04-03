# Modelo de world manual

1. Clone esta pasta para uma nova irmã, por exemplo `world-3/`.
2. Copie `.env.example` para `.env` dentro da nova pasta.
3. Ajuste `WORLD_DIRECTORY`, `SERVER_ID`, `PORT`, `API_PORT`, `PUBLIC_GAME_PORT`, `PUBLIC_API_PORT`, `REALM_ID` e `CHANNEL_ID`.
4. Suba a base fixa primeiro.
5. Inicie o novo world com `docker compose -f docker-multiworld-scalable/world-3/docker-compose.yml --env-file docker-multiworld-scalable/world-3/.env up --build -d`.

Este modelo continua manual por pasta. Não existe automação de criação de canais além da clonagem explícita da estrutura.
