# STATUS — onde estamos e como retomar

> Documento dinâmico. Atualize após cada bloco grande de trabalho. Última atualização: 2026-04-26.

## TL;DR

Sistema multi-tenant de monitoramento de usinas solares. **Backend completo** (12 regras de alerta, 6 adapters validados em produção, motor de coleta + ingestão idempotente, Beat agendando dinamicamente). **Frontend ainda em placeholders**, **API REST não implementada**.

Repo: <https://github.com/avilamicael/monitoramento_usinas>. Container dev em pé desde 2026-04-25 coletando das 6 contas reais da VPS antiga (`firmasolar`).

## Comandos pra retomar

```bash
cd /home/micael/monitoramento

# Verificar estado dos containers
docker compose ps

# Se não estão rodando, subir (sem frontend pra economizar):
docker compose up -d db redis backend worker beat

# Logs ao vivo:
docker compose logs -f beat worker | tail -50

# Admin Django: http://127.0.0.1:8001/admin/  user=admin senha=admin

# Relatório do estado da coleta (rodar sempre que voltar):
docker compose exec backend python -c "
import django; django.setup()
from datetime import timedelta
from django.db.models import Count, Avg, F
from django.utils import timezone as djtz
from apps.coleta.models import LogColeta
from apps.monitoramento.models import LeituraUsina, LeituraInversor
from apps.usinas.models import Usina
from apps.inversores.models import Inversor
from apps.alertas.models import Alerta
desde = djtz.now() - timedelta(hours=24)
print('━━ COLETAS 24h ━━')
for r in LogColeta.objects.filter(iniciado_em__gte=desde).values('conta_provedor__tipo','status').annotate(n=Count('id'),dur=Avg('duracao_ms')).order_by('conta_provedor__tipo'):
    print(f'  {r[\"conta_provedor__tipo\"]:12} {r[\"status\"]:10} n={r[\"n\"]:3} dur={int(r[\"dur\"])}ms')
print(f'━━ ENTIDADES ━━')
print(f'  Usinas={Usina.objects.count()} Inversores={Inversor.objects.count()} Leituras_U={LeituraUsina.objects.count()} Leituras_I={LeituraInversor.objects.count()}')
print('━━ ALERTAS ━━')
for r in Alerta.objects.values('regra','severidade','estado').annotate(n=Count('id')).order_by('-n')[:15]:
    print(f'  {r[\"regra\"]:30} {r[\"severidade\"]:8} {r[\"estado\"]:10} n={r[\"n\"]}')
"
```

Porta override em `docker-compose.override.yml` (gitignored) — backend em **8001**, db/redis sem expor pro host (conflito com outros postgres/redis locais).

## Status por fase (ver `docs/PLANO.md` original)

✅ F1 baseline · F2 expansão de models · F3 base de adapters · F4 Solis · F5 motor de coleta · F6 motor de alertas (2 regras) · F8 5 adapters restantes · F9 validação real das 6 APIs · F10 12 regras + tasks diárias · F11 ambiente de dev coletando

⏳ **Calibrações pendentes** (relatório de 2026-04-25 detectou ruído):

| Regra | Sintoma observado | Proposta |
|---|---|---|
| `subdesempenho` | 225 abertos em 24h, threshold 30% gera ruído | mudar default p/ 15%; janela "pleno" 11-14h em vez de 10-15h |
| `subtensao_ac` | 68 abertos, 200V irreal pra rede 220V±10% | default p/ 190V (ajustável por usina) |
| `medido_em` "100%" | adapters caem pra `datetime.now()` quando provedor não expõe — `sem_comunicacao` nunca dispara em Fusion/Foxess | nos 6 adapters, deixar `medido_em=None` quando o provedor não tem timestamp real |
| Auxsol auth_erro | 1× em 28 coletas, token deveria durar 12h | refresh mais agressivo |

⏳ **Próximas fases** (escolher quando retomar):

- **F12 — Calibrações** (1-2h): aplicar os 4 itens da tabela acima.
- **F13 — Testes unitários** das 10 regras novas (hoje só smoke-testadas no shell).
- **F14 — API REST**: serializers DRF + ViewSets pra todas as entidades. Bloqueia o frontend de verdade.
- **F15 — UI real**: substituir placeholders por dashboard de monitoramento + lista de alertas + CRUD de ContaProvedor/Usina/Garantia/Configuração.
- **F16 — Notificações**: hoje `notificacoes/models.py` tem RegraNotificacao/EntregaNotificacao/EndpointWebhook mas **nada conecta**. Worker precisa do envio real (e-mail console pra dev, SMTP/Mailgun/SES pra prod, webhook signed-HMAC).

## Decisões arquiteturais cristalizadas

Resumo (detalhes em `~/.claude/projects/-home-micael-monitoramento/memory/`):

- **Multi-tenancy** shared schema: `EscopoEmpresa` mixin + `EmpresaMiddleware`.
- **Convenção de nomes opção 3**: domínio em PT-BR (apps, modelos, URLs, enums, campos), termos universais em inglês (`id`, `is_active`, `created_at`, `slug`, `url`, `secret`, `api_key`, `extra`, `raw`, hooks/componentes React).
- **Alertas gerados no backend**, nunca consumidos do provedor. `raw` do provedor só pra debug.
- **Sem histerese**: 1ª coleta anômala abre, 1ª normal resolve. 1 alerta aberto por `(usina, inversor, regra)`.
- **Null ≠ ok**: regra retorna `None` (não avalia) quando dado ausente. Lacuna fechada por `dado_eletrico_ausente` (10 coletas null seguidas).
- **Threshold cascade**: Inversor → Usina → ConfiguracaoEmpresa → constante na regra.
- **Garantia**: usinas sem garantia ativa **não geram alertas**. Garantia é auto-criada na 1ª coleta com `garantia_padrao_meses` (default 12).
- **Idempotência da coleta**: `coletado_em` arredondado para janela de 10min; `UniqueConstraint(usina, coletado_em)`.
- **Credenciais Fernet** em `ContaProvedor.credenciais_enc` (e `cache_token_enc` pra sessões). Nunca texto puro.

## Provedores

6 portados, validados em produção, cobrem:

| Tipo | Auth | Cache token | Mín coleta | Status |
|---|---|---|---|---|
| solis | HMAC-SHA1 stateless | — | 10 min | ✅ |
| hoymiles | nonce + Argon2 | semanas | 10 min | ✅ (timeout 45s) |
| foxess | MD5 stateless | — | 15 min | ✅ |
| auxsol | Bearer 12h | 12h | 10 min | ✅ (1 auth_erro/24h) |
| solarman | JWT manual ~60d | até renovar | 10 min | ✅ (com fix `stats/day`) |
| fusionsolar | XSRF session | reusa | 30 min | ✅ (capacity MW→kWp + null-on-offline) |

Adapters em `backend/apps/provedores/adapters/<tipo>/`. Cada um: `autenticacao.py`, `consultas.py`, `adapter.py`, `tests/test_normalizacao.py` (44 testes verdes).

## Regras de alerta

Em `backend/apps/alertas/regras/`:

```
sobretensao_ac          (inversor, crítico)
subtensao_ac            (inversor, aviso)
frequencia_anomala      (inversor, aviso)
temperatura_alta        (inversor, aviso)
inversor_offline        (inversor, aviso) — só dispara se outros inversores gerando
string_mppt_zerada      (inversor, aviso)
dado_eletrico_ausente   (inversor, aviso) — N coletas null
sem_comunicacao         (usina, aviso→crítico) — usa só medido_em
sem_geracao_horario_solar (usina, crítico)
subdesempenho           (usina, aviso) — só roda 11-14h locais
queda_rendimento        (usina, aviso) — só task diária
garantia_vencendo       (usina, info→aviso) — só task diária
```

Motor em `backend/apps/alertas/motor.py::avaliar_empresa(empresa_id, apenas_diarias=False)`. Disparado pós-coleta via `transaction.on_commit`.

Beat agendado:
- 1 `PeriodicTask` por `ContaProvedor` ativa (intervalo do `intervalo_coleta_minutos`)
- `avaliar_alertas_diarios` 21:00 UTC
- `limpar_leituras_expiradas` 03:00 UTC

## Acesso e credenciais

- **Repo**: `git@github.com:avilamicael/monitoramento_usinas.git` (HTTPS funciona via Git CLI normal).
- **VPS antiga (firmasolar)**: `ubuntu@monitoramento.firmasolar.com.br`, chave `/home/micael/firmasolar/monitoramento_firmasolar.pem`. Acessar só pra debug ou re-extrair credenciais. Nada vai pra git.
- **Admin local**: `http://127.0.0.1:8001/admin/` user `admin` senha `admin`.
- **`backend/.env`**: copiado de `.env.example`, com `CHAVE_CRIPTOGRAFIA` válida (Fernet). Não vai pro git.
- **6 contas em produção dev**: criadas via script efêmero em 2026-04-25 (script removido). Re-criar no futuro: pegar credenciais via `psql` da VPS (não via Django shell — chave Fernet diferente!) → decriptar com `Fernet(chave_vps)` → re-encriptar com `apps.provedores.cripto.criptografar` → salvar em `ContaProvedor`.

## Gotchas conhecidos

- `docker-compose.override.yml` é local (gitignored). Sem ele, portas 5432/6379/8000 conflitam com outros serviços do host.
- Solis `_detail.temp == 150.0` é sentinela de "sensor ausente"; adapter já filtra.
- Solis pode retornar dados elétricos antigos (~meses) com `state=2` (offline) — `medido_em` reflete isso, regras tratam.
- FusionSolar `capacity` < 100 = MW; ≥ 100 = kWp. Adapter trata em `_kwp_de_capacity()`.
- FusionSolar `run_state=0` → todos KPIs vêm null. Crítico não substituir por 0.
- Hoymiles cloud não expõe `corrente_ac_a` por microinversor. `frequencia_anomala`/`subtensao_ac` rodam, mas regras de corrente AC ficam inertes em Hoymiles.
- `medido_em` 100% reportado é enganoso — vários adapters caem pra `datetime.now()` no fallback (calibração pendente).

## Arquivos pra ler em ordem ao retomar

1. **Este arquivo** (`docs/STATUS.md`) — estado atual.
2. **`CLAUDE.md`** (raiz) — arquitetura.
3. **`docs/PLANO.md`** — plano original de fases.
4. **`docs/amostras-firmasolar/analise.md`** — descobertas das APIs reais.
5. **`docs/amostras-firmasolar/saida_bruta.txt`** — payloads sanitizados de cada provedor.
6. Memory em `~/.claude/projects/-home-micael-monitoramento/memory/`:
   - `project_monitoramento.md` — escopo e decisões
   - `alertas_decisoes.md` — semântica completa das 12 regras
   - `user_language.md` — convenção PT-BR/EN
