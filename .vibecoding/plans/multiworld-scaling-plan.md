# Plano: Auto-escalonamento de Mundos (类似 canais de MMO)

## Objetivo

Criar um sistema onde novos mundos (servidores) são criados automaticamente conforme a demanda, similar aos canais dinâmicos encontrados na maioria dos MMOs.

---

## Análise do Estado Atual

### O que já existe
- **HUB**: Mantém lista dinâmica de servidores conectados via WebSocket
- **Registro**: Servidores se registram automaticamente ao conectar no HUB
- **Capacidade**: Cada servidor informa `maxPlayers` e `players` conectados
- **Seleção**: API `/empty` retorna o primeiro servidor com espaço

### O que falta
- Criação automática de containers/servidores
- Orquestração de novos mundos
- Balanceamento de carga ou seleção inteligente de mundo
- Roteamento dinâmico (NGINX ou outro proxy)

---

## Arquitetura Proposta

```
┌─────────────────────────────────────────────────────────────────┐
│                           CLIENTE                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          NGINX (ou Proxy)                        │
│  - Roteamento dinâmico baseado em API do Orchestrator           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR (NOVO)                         │
│  - Monitora capacidade dos mundos                               │
│  - Cria/destrói mundos via Docker/Kubernetes                    │
│  - Atualiza proxy com novas rotas                               │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐         ┌─────────┐         ┌─────────┐
    │ WORLD-1 │         │ WORLD-2 │         │ WORLD-N │
    └─────────┘         └─────────┘         └─────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                            HUB                                  │
│  - Coordena comunicação entre mundos                           │
│  - Mantém lista de servidores ativos                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         MONGODB                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Fases de Implementação

### Fase 1: Monitoramento e thresholds
- [ ] Adicionar métricas de capacidade no HUB
- [ ] Definir thresholds (ex: > 80% occupancy = criar novo mundo)
- [ ] Criar endpoint de status consolidada

### Fase 2: Orchestrator
- [ ] Criar serviço `orchestrator` (novo pacote)
- [ ] Implementar Docker API ou K8s controller para criar mundos
- [ ] Definir template de configuração para novos mundos

### Fase 3: Roteamento dinâmico
- [ ] Atualizar NGINX com配置 dinâmica (ou usar Traefik)
- [ ] Ou implementar seleção de mundo no client-side
- [ ] Fallback: client conecta diretamente via WebSocket

### Fase 4: Cleanup automático
- [ ] Destruir mundos vazios após timeout
- [ ] Manter mínimo de mundos ativos
- [ ] Log e métricas de escalonamento

---

## Alternativas Técnicas

### Opção A: Docker Compose + API externa
- Orchestrator roda fora do compose
- Usa Docker Engine API para criar containers
- Prós: Simples, flexível
- Contras: Gerenciamento manual de rede

### Opção B: Kubernetes
- Cada mundo é um Pod
- HUB como StatefulSet ou Deployment
- Horizontal Pod Autoscaler (HPA) baseado em métricas
- Prós: Auto-scale nativo, resilient
- Contras: Maior complexidade, requer K8s

### Opção C: Serverless/Functions
- Cada mundo como função serverless (ex: AWS Lambda)
- scaling automático por invoke
- Prós: Paga apenas pelo uso
- Contras: Latência Cold Start, limitação de WebSocket

---

## Recomendação

Para este projeto, a **Opção A** (Docker Compose + Orchestrator) é a mais adequada pois:
1. Mantém a infraestrutura atual (Docker)
2. Não requer Kubernetes ou cloud
3. Pode começar simples e evoluir
4. O HUB já existe e coordena bem os mundos

---

## Próximos Passos (quando implementado)

1. Criar pacote `packages/orchestrator/`
2. Adicionar endpoint `/worlds` no HUB com métricas
3. Implementar Docker API client no orchestrator
4. Criar template de variáveis para novos mundos
5. Adicionar roteamento no NGINX ou usar Traefik
