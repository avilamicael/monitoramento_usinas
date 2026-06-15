# Deploy em produção

Procedimento validado em 2026-06-15 (deploy da feature "Clientes Premium").

## Onde

- **Host:** `ssh trylab-vps` (VPS HostGator BR, 8 GB RAM, **2 GB de swap permanente** em `/swapfile`).
- **Domínio:** https://monitoramento.trylab.com.br (Nginx da VPS faz o proxy/TLS, **fora** do compose).
- **Diretório do app:** `/opt/monitoramento` — é um clone git na branch **`main`**, `origin` = `github.com/avilamicael/monitoramento_usinas`.
- **Estratégia:** **git pull-based**. O deploy é `git pull` na VPS + migrations + restart/rebuild dos containers.
- A VPS roda **outros apps no mesmo Docker** (chatwoot, notas-fiscais) — não mexer neles.

## Arquivos que vivem só na VPS (não versionados)

- `/opt/monitoramento/docker-compose.prod.yml` — overlay de produção (`frontend` vira `target: prod`, Nginx servindo `dist/` na porta `127.0.0.1:3001:80`). **Untracked/gitignored** — `git pull` não toca nele.
- `/opt/monitoramento/.env` (compose) e `/opt/monitoramento/backend/.env` (Django prod).
- Não há `COMPOSE_FILE` no `.env`, então **o overlay de prod precisa ser passado explicitamente** com `-f docker-compose.yml -f docker-compose.prod.yml` nos comandos que (re)criam containers.

## O que precisa de quê

| Serviço | Mecanismo | No deploy |
|---|---|---|
| `backend`, `worker`, `beat` | **bind-volume** (`./backend:/app`) | `git pull` + `restart` pega o código novo |
| `frontend` | **imagem buildada** (Vite → Nginx, sem bind-volume) | precisa **rebuild** com o overlay de prod |
| migrations | — | rodar `manage.py migrate` após o pull |

## Procedimento (passo a passo)

```bash
ssh trylab-vps
cd /opt/monitoramento

# 1. Atualiza o código (fast-forward; aborta se divergir)
git pull --ff-only

# 2. Migrations (no container backend já em execução)
make migrate
#   == docker compose exec backend python manage.py migrate

# 3. Backend/worker/beat: bind-volume, só restart pega o código novo
docker compose restart backend worker beat

# 4. Frontend: rebuild da imagem de produção (precisa do overlay).
#    --no-deps evita recriar o backend junto.
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build --no-deps frontend
```

> Sem o `--no-deps` no passo 4, o `up --build frontend` puxa a dependência
> `backend` e **recria o backend também** com a config do overlay — funciona,
> mas é mais lento e desnecessário se você já fez o passo 3.

## Verificação pós-deploy

```bash
# containers de pé
docker compose ps

# erros recentes no backend
docker compose logs backend --tail 30

# site público + endpoint (200 e 401 = ok)
curl -s -o /dev/null -w "%{http_code}\n" https://monitoramento.trylab.com.br/
curl -s -o /dev/null -w "%{http_code}\n" https://monitoramento.trylab.com.br/api/monitoramento-ativo/
```

`/` → `200`; um endpoint autenticado (ex.: `/api/monitoramento-ativo/`) → `401`
(rota existe, só falta token) confirma backend + frontend no ar.

## Riscos e cuidados

- **OOM no build do frontend:** o `vite build` dentro do Docker consome memória.
  Hoje há **2 GB de swap permanente**, o que mitiga (deploy de 2026-06-15 passou
  sem OOM). Se o SSH cair durante o passo 4, **suspeite de OOM** — verifique
  `free -m` e `dmesg | grep -i oom`.
- **`git pull --ff-only`** é proposital: se a VPS tiver commit local não-pushado,
  o pull aborta em vez de criar merge/conflito. Nesse caso, investigue antes
  (`git log origin/main..main`).
- **Migrations primeiro, código depois** não é obrigatório aqui (são aditivas),
  mas para mudanças destrutivas siga o multi-step descrito no `CLAUDE.md`.
- Rebuild do frontend **não derruba** db/redis/backend — o site fica no ar
  durante o build; só o container `frontend` é recriado ao final (downtime de
  segundos).
