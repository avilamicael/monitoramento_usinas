# Coding Conventions

**Analysis Date:** 2026-05-12

## Naming Patterns

**Convenção híbrida PT-BR / inglês:** domínio em PT-BR; universais/libs em inglês. Apps Python sem acento/cedilha.

**Apps Python (`backend/apps/*`):**
- PT-BR sem acento: `usinas`, `inversores`, `provedores`, `coleta`, `alertas`, `garantia`, `notificacoes` (não `notificações`), `monitoramento`, `empresas`, `usuarios` (não `usuários`), `core`, `superadmin`.
- Razão: evitar dor de import com `from apps.notificacoes import ...`.

**Models e campos de domínio (PT-BR):**
- Classes: `Empresa`, `Usina`, `Inversor`, `Alerta`, `LogColeta`, `ContaProvedor`, `LeituraUsina`, `LeituraInversor`, `Garantia`, `ConfiguracaoEmpresa`, `ConfiguracaoRegra`, `Usuario`.
- Campos: `nome`, `capacidade_kwp`, `medido_em`, `aberto_em`, `resolvido_em`, `severidade`, `papel`, `tensao_ac_v`, `frequencia_hz`, `coletado_em`, `id_externo`, `precisa_atencao`, `expoe_dados_inversor`.
- Exemplo: `apps/usinas/models.py::Usina`, `apps/alertas/models.py::Alerta`.

**Campos universais/técnicos (inglês):**
- `id`, `is_active`, `created_at`, `updated_at`, `slug`, `url`, `secret`, `api_key`, `api_secret`, `config`, `extra`, `raw`.
- Herdados do `AbstractUser`: `username`, `email`, `password`, `first_name`, `last_name`.

**Enums (PT-BR):**
- `apps/alertas/models.py::SeveridadeAlerta` → `info`, `aviso`, `critico` (sem acento nos valores; rótulos com acento).
- `apps/alertas/models.py::EstadoAlerta` → `aberto`, `reconhecido`, `resolvido`.
- `apps/usuarios/models.py::PapelUsuario` → `superadmin`, `administrador`, `operacional`.
- `apps/usinas/models.py::TipoEquipamento` → `inversor`, `microinversor`, `indefinido`.
- `apps/monitoramento/models.py::StatusLeitura` → `online`, `offline`, `alerta`.

**TextChoices vs IntegerChoices:** TextChoices é o padrão. IntegerChoices só quando o valor é semanticamente numérico (ex.: `TensaoNominalV.V110 = 110`).

**Funções e métodos (PT-BR snake_case):**
- `da_empresa`, `avaliar_empresa`, `sincronizar_conta_provedor`, `arredondar_janela`, `ingerir_ciclo`, `decriptar`, `obter_cache_token`, `parsear_exp_jwt`.
- Privadas com underscore: `_normalizar_usina`, `_aplicar`, `_carregar_regras`, `_max_severidade`.

**Adapters de provedores (inglês, nome próprio da lib):**
- Classes: `SolisAdapter`, `HoymilesAdapter`, `FusionSolarAdapter`, `FoxessAdapter`, `SolarmanAdapter`, `AuxsolAdapter` (`apps/provedores/adapters/<nome>/adapter.py`).
- Tipo (chave de registro): `solis`, `hoymiles`, `fusionsolar`, `foxess`, `solarman`, `auxsol`.

**URLs DRF (PT-BR plural):**
- `/api/usinas/`, `/api/inversores/`, `/api/alertas/`, `/api/empresas/`, `/api/notificacoes/`, `/api/provedores/`.
- Actions DRF em PT-BR: `/api/alertas/<id>/resolver/`, `/api/alertas/<id>/reconhecer/`, `/api/usinas/<id>/desativar/`, `/api/usinas/<id>/ativar/`.
- Excecionalmente `/api/auth/token/` e `/api/auth/token/refresh/` (terminologia universal de JWT) e `/api/superadmin/*`.

**Frontend (TS):**
- Componentes React em inglês: `AppLayout`, `UsinasTable`, `StatusGarantiaBadge`, `RegrasPage`, `LinhaRegra`, `PageHeader`, `SeveridadeBadge`.
- Hooks: `useUsinas`, `useAlertas`, `useAuth`, `useConfiguracaoRegras`, `useAtualizarConfiguracaoRegra` (`@/hooks/use-*.ts`).
- Arquivos `.tsx` em PascalCase para componentes; hooks `use-*.ts` em kebab-case.
- Tipos/interfaces em PascalCase (`UsinaResumo`, `UseUsinasParams`, `Paginated<T>`); funções em camelCase (`paraResumo`, `formatarEnergia`, `extrairErroConfiguracaoRegra`).
- Estado/variável usa o domínio em PT-BR quando faz sentido (`usinas`, `loading`, `error`, `data`, `confirmAberto`, `podeEditar`).

**Páginas (`frontend/src/pages/<dominio>/`):** PT-BR para domínio, sufixo `Page.tsx`. Exemplos: `RegrasPage.tsx`, `DocsRegrasPage.tsx`, `DocsHomePage.tsx`.

## Code Style

**Formatting (backend):**
- Ruff como fonte única (`backend/pyproject.toml`).
- `line-length = 100`, `target-version = "py312"`.
- `extend-exclude = ["migrations"]` — migrations não são lintadas.
- Comandos: `make fmt` (`ruff format .`), `make lint` (`ruff check .`).

**Linting (backend):**
- Regras ativas: `E`, `F`, `W`, `I` (imports), `N` (naming), `UP` (pyupgrade), `B` (bugbear), `DJ` (Django), `SIM` (simplify), `RUF`.
- Ignoradas: `E501` (line too long — tratada por formatter, não por checker).
- Settings exceções: `**/settings/*.py` ignora `F403`/`F405` (star imports legítimos em `dev.py`/`prod.py`).

**Formatting (frontend):**
- Prettier 3 (`frontend/package.json` script `format: "prettier --write ."`).
- Sem `.prettierrc` versionado — usa defaults (semi `true`, single quotes mistas, mas `lib/utils.ts` mostra double quotes; misturas históricas tolerantes).
- ESLint flat config em `frontend/eslint.config.js` com `tseslint.configs.recommended` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`.
- Comando: `npm run lint`, `npm run format`.

**Python idioms obrigatórios:**
- Sempre `from __future__ import annotations` no topo (visto em quase todos os arquivos: `apps/empresas/models.py`, `apps/alertas/motor.py`, `apps/coleta/tasks.py`).
- Type hints completos em assinaturas públicas (`def avaliar(self, usina: Usina, leitura: LeituraUsina | None, config: ConfiguracaoEmpresa) -> Anomalia | None | bool`).
- `Decimal` em vez de `float` para todo valor numérico de domínio (V, A, kW, kWh, Hz, °C).
- `datetime` sempre aware: `from django.utils import timezone as djtz` e `djtz.now()`; nunca `datetime.now()` direto. `TIME_ZONE = "America/Sao_Paulo"`, `USE_TZ = True`.

## Import Organization

**Order (Ruff `I` aplica isort automático):**
1. Standard library (`from __future__`, depois `import os`, `from datetime import ...`).
2. Third-party (`django.*`, `rest_framework.*`, `celery`, `pytest`).
3. First-party (`apps.*`).
4. Relativos (`from .models import X`).

**Exemplo em `apps/alertas/views.py`:**
```python
from __future__ import annotations

from django.utils import timezone as djtz
from django_filters import rest_framework as filters
from rest_framework import mixins, status, viewsets

from apps.core.api import empresa_do_request, EmpresaQuerysetMixin
from apps.usuarios.permissions import AdminEmpresaOuSomenteLeitura

from .models import Alerta, ConfiguracaoRegra, EstadoAlerta
from .serializers import AlertaSerializer
```

**Path Aliases (frontend):**
- `@/*` → `src/*` definido em `frontend/vite.config.ts` e `frontend/tsconfig.json`.
- Exemplos: `@/lib/api`, `@/components/ui/table`, `@/hooks/use-usinas`, `@/features/auth/useAuth`.
- Subaliases shadcn em `frontend/components.json`: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`.

## Error Handling

**Backend — hierarquia de exceções customizadas:**
- Em `apps/provedores/adapters/base.py`: `ErroProvedor` (base), `ErroAutenticacaoProvedor` (credenciais/sessão expirou e não pôde renovar), `ErroRateLimitProvedor` (provedor pediu backoff).
- Em `apps/usinas/geocode.py`: `GeocodeError` (timeout/rede), `GeocodeNaoEncontrado` (404 do Nominatim).

**Padrão em tasks Celery (`apps/coleta/tasks.py::sincronizar_conta_provedor`):**
- `autoretry_for=(ErroRateLimitProvedor,)`, `retry_backoff=True`, `retry_backoff_max=3600`, `max_retries=3`.
- `ErroAutenticacaoProvedor` marca `ContaProvedor.precisa_atencao=True` (sem retry).
- `ErroProvedor` genérico é capturado, logado e fecha `LogColeta` com `status=erro`.
- Resultado de cada ciclo retorna `dict` resumido para chains/inspeção manual.

**Padrão em views DRF (`apps/usinas/views.py::geocode_view`):**
- Códigos de status alinhados com a semântica:
  - 400: validação de input.
  - 404: recurso externo não encontrou nada (`GeocodeNaoEncontrado`).
  - 503: timeout / serviço externo indisponível (`GeocodeError`).
- Body sempre `{"detail": "..."}` para mensagens de erro.

**Padrão em regras de alerta (`apps/alertas/regras/*.py`):**
- Tri-state estrito como contrato: `Anomalia` | `False` | `None` — nunca lançar exceção dentro de `avaliar()`.
- `None` = dado ausente → motor pula (não abre, não fecha).
- `False` = condição negada → motor fecha alerta aberto.
- `Anomalia(severidade, mensagem, contexto)` = abrir/atualizar alerta.
- Exemplo crítico em `apps/alertas/regras/sobretensao_ac.py`: guarda de `pac_kw is None` retorna `False`; `tensao_ac_v is None` retorna `None`. **Semântica diferente**.

**Frontend — captura curta + mensagem amigável:**
- Hooks usam try/catch retornando `error: string | null`. Exemplo `frontend/src/hooks/use-usinas.ts`:
```ts
try {
  const response = await api.get(...);
  setData(...);
} catch {
  setError('Erro ao carregar usinas');
}
```
- Erros de API estruturados em `extrairErroConfiguracaoRegra` (`frontend/src/hooks/use-configuracao-regras.ts`): 403 vira mensagem sobre permissão; resto monta de `data.detail` ou junta entradas DRF.
- Toast notifications via `sonner` (`toast.success`, `toast.error`).

**Frontend — refresh JWT transparente (`frontend/src/lib/api.ts`):**
- Interceptor de response: 401 → único refresh em flight (deduplicado em `refreshing`) → reexecuta a request original com `_retried=true`.

## Logging

**Backend:**
- `logger = logging.getLogger(__name__)` no topo de cada módulo que loga.
- Exemplos: `apps/alertas/motor.py`, `apps/coleta/tasks.py`, `apps/coleta/ingestao.py`.
- `logger.info("...")` para fluxo normal; `logger.warning("...")` para erros recuperáveis (ex.: `buscar_inversores falhou para usina %s`); `logger.exception` quando exceção interrompe.

**Padrão de mensagem:** placeholder `%s` (`logger.warning("conta %s — %s", conta_id, exc)`), nunca f-string dentro de logger.

**Frontend:** `console.error` somente em casos extremos; UI sempre tem fallback amigável.

## Comments

**Docstrings:**
- Sempre presentes em módulos com lógica não-trivial (motor, tasks, adapters, ingestao). Português, multi-linhas, descrevem propósito + invariantes + gotchas.
- Exemplo em `apps/alertas/regras/base.py`: docstring de módulo explica `null ≠ ok`, e cada classe `RegraUsina`/`RegraInversor` tem docstring com semântica de retorno.
- Classes/funções públicas: docstring breve sobre comportamento; helpers privados podem ser comment-only.

**Comments inline (PT-BR):**
- Decisões com data: `# Decisão 2026-04-27: sobretensão é problema de rede (concessionária), não derruba o sistema; rebaixado de CRITICO para AVISO.` (`apps/alertas/regras/sobretensao_ac.py`).
- Notas sobre fixtures reais: `# Fixture real é monofásica — verifica payload eletrica_ac completo` (`apps/provedores/adapters/solis/tests/test_normalizacao.py`).
- Razões de gotchas: `# JSON.stringify evita loop infinito quando params é objeto literal recriado a cada render` (`frontend/src/hooks/use-usinas.ts`).

**`help_text` em campos de model:** sempre presente em `models.py` para qualquer campo com lógica não-trivial — alimenta admin Django e documentação OpenAPI gerada por drf-spectacular. Exemplo `apps/usinas/models.py::Usina.capacidade_kwp`.

## Function Design

**Size:** Funções/métodos curtos (10–40 linhas típico). Métodos `_aplicar` no motor passam de 60 linhas — exceção tolerável quando agrega ciclo.

**Parâmetros nomeados (kwargs):** Para argumentos opcionais e contexto, usa keyword-only com `*`:
```python
def _criar_leitura_inversor(inversor, *, estado, coletado_em, medido_em=None):
```

**Return values:**
- Tri-state explícito em regras (`Anomalia | None | bool`).
- Dataclasses para dados estruturados retornados de adapters (`DadosUsina`, `DadosInversor`, `ResultadoIngestao`).
- Dicts para resultados resumidos de tasks (`{"status": "sucesso", "usinas_vistas": 5, ...}`).

## Module Design

**Exports:**
- Backend: `__all__` em `apps/alertas/regras/__init__.py` reexporta a API pública do pacote.
- Frontend: export nomeado, raramente `export default` (exceções: páginas top-level como `RegrasPage` que é importada por router).

**Decorator de registro:** padrão `@registrar` em `apps/alertas/regras/base.py` e `apps/provedores/adapters/registry.py` — registra classes no boot via import side-effect, sem reflection.

**`AppConfig.ready()` para registry:** `apps/provedores/apps.py::ProvedoresConfig.ready()` faz `from apps.provedores.adapters import auxsol, foxess, ...  # noqa: F401`. Mesmo padrão para regras via `apps/alertas/motor.py::_carregar_regras()`.

**Barrel files:** evitados no backend. No frontend, há reexportações pontuais (ex.: `@/components/trylab/primitives` exporta `Card`, `Confirm` etc).

## Multi-tenancy (regra obrigatória)

- Todo model com escopo de empresa herda `apps/empresas/models.py::EscopoEmpresa` que injeta `empresa = FK(Empresa)` + manager `EscopoEmpresaManager` com `.da_empresa(empresa)`.
- ViewSets escopadas: herdar de `apps/core/api.py::EmpresaModelViewSet` (CRUD), `EmpresaReadOnlyViewSet` (leitura), ou `EmpresaListUpdateViewSet` (singletons). Todas aplicam `EmpresaQuerysetMixin.get_queryset` + `perform_create` automaticamente.
- Permissão padrão: `apps/usuarios/permissions.py::AdminEmpresaOuSomenteLeitura` (leitura: membro; escrita: `is_admin_empresa`). Para entidades de auditoria, `PertenceEmpresa` (read-only para qualquer membro).
- Cross-tenant: somente endpoints `/api/superadmin/*` com permissão `EhSuperadmin`.

## Adapters de provedor (padrão obrigatório)

- Subclasse de `apps/provedores/adapters/base.py::BaseAdapter` decorada com `@registrar` em `apps/provedores/adapters/registry.py`.
- Diretório: `apps/provedores/adapters/<tipo>/{__init__.py, autenticacao.py, consultas.py, adapter.py}`.
- Construtor recebe `dict` de credenciais já descriptografadas (via Fernet em `apps/provedores/cripto.py`).
- `buscar_usinas()` e `buscar_inversores(id_usina_externo)` retornam `DadosUsina`/`DadosInversor` (dataclasses com `slots=True`) com unidades canônicas (kW/kWh/V/A/Hz/°C) — conversões em `apps/provedores/adapters/unidades.py`.
- Regra do null: campo não exposto → `None`. **Nunca `0` como sentinela** — `0` é leitura legítima.
- Adapter **não consulta alertas nativos** do provedor — payload bruto vai em `DadosUsina.raw`/`DadosInversor.raw` para auditoria.
- Adapters stateful (Hoymiles, FusionSolar, Auxsol) implementam `obter_cache_token()` retornando dict serializável persistido em `ContaProvedor.cache_token_enc`.
- Para registrar: adicionar import em `apps/provedores/apps.py::ProvedoresConfig.ready()`.

---

*Convention analysis: 2026-05-12*
