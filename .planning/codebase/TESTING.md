# Testing Patterns

**Analysis Date:** 2026-05-12

## Test Framework

**Runner:**
- pytest 8 + pytest-django 4.9 (`backend/requirements-dev.txt`).
- Config: `backend/pyproject.toml` seção `[tool.pytest.ini_options]`.
- `DJANGO_SETTINGS_MODULE = "config.settings.dev"`.
- `python_files = ["test_*.py", "*_test.py", "tests.py"]`.
- `addopts = "--reuse-db"` — banco de teste preservado entre runs (ganho de tempo; resetar com `--create-db`).

**Conftest global:** `backend/conftest.py` é placeholder (`"""Pytest config — carrega ajustes globais."""`); fixtures ficam locais a cada app.

**Extras:**
- `factory-boy==3.3.*` listado em `requirements-dev.txt` (usado pontualmente; padrão dominante são fixtures pytest).
- `pytest-cov==6.*` instalado mas sem threshold imposto.

**Frontend:** sem suíte automatizada. Não há `vitest`/`jest` configurado em `frontend/package.json`. ESLint + `tsc -b` (no `build`) servem como gate estático.

**Run Commands:**
```bash
make test                                                       # docker compose exec backend pytest
docker compose exec backend pytest apps/alertas/tests/ -v       # módulo específico
docker compose exec backend pytest -k motor_agregacao            # por nome
docker compose exec backend pytest --create-db                   # recria o banco
docker compose exec backend pytest --cov=apps --cov-report=term  # com cobertura
```

## Test File Organization

**Location:**
- Backend: pasta `tests/` dentro de cada app — `apps/<dominio>/tests/test_*.py`.
- Adapters: pasta dedicada por adapter — `apps/provedores/adapters/<provedor>/tests/test_*.py`.
- Convenção: 1 arquivo por feature/regra/comportamento. Não há `tests.py` monolítico.

**Naming:**
- `test_<feature>.py` — `test_motor_agregacao.py`, `test_normalizacao.py`, `test_sem_comunicacao.py`, `test_api_configuracao_regras.py`.
- Funções: `test_<acao>_<resultado_esperado>` em PT-BR — `test_normalizar_usina_campos_essenciais`, `test_dispara_quando_usina_potencia_zero`, `test_estado_online_resolve_aberto`.

**Distribuição atual (22 arquivos):**
```
apps/alertas/tests/                                  # 11 arquivos — motor, regras, API config-regras
├── conftest.py                                       # fixtures empresa/config/usina/inversor
├── test_motor_agregacao.py
├── test_motor_respeita_configuracao_regra.py
├── test_inversor_offline.py
├── test_sem_comunicacao.py
├── test_sem_geracao_horario_solar_astral.py
├── test_thresholds_tensao.py
├── test_recalibrar_alertas_tensao.py
├── test_subdesempenho_desativada.py
├── test_alerta_regra_desativada.py
├── test_api_configuracao_regras.py
└── test_migrar_alertas_para_agregados.py
apps/core/tests/test_configuracoes_api.py
apps/usinas/tests/test_serializer_tensao_nominal.py
apps/superadmin/tests/test_api.py                    # cross-tenant
apps/provedores/tests/test_cripto.py                 # parser parsear_exp_jwt
apps/provedores/adapters/<6 provedores>/tests/       # 1 test_normalizacao.py cada + relogin do Auxsol
```

**Adapters fixtures:** `apps/provedores/adapters/<provedor>/tests/fixtures/*.json` — payloads reais capturados do provedor (Solis 2026-04-24, etc). Mantidos verbatim com `_load(name)`.

## Test Structure

**Padrão dominante (function-based, sem classes):**
```python
"""Docstring de módulo explica o foco do arquivo."""
from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

import pytest

from apps.alertas.models import SeveridadeAlerta
from apps.alertas.regras.sem_comunicacao import SemComunicacao


@pytest.mark.django_db
def test_acima_do_limite_aviso(usina, config):
    """Acima do limite (24h) mas abaixo de 2× = aviso."""
    usina.ultima_leitura_em = djtz.now() - timedelta(hours=30)
    usina.save()
    resultado = SemComunicacao().avaliar(usina, None, config)
    assert resultado is not None and resultado is not False
    assert resultado.severidade == SeveridadeAlerta.AVISO
    assert "30.0 horas" in resultado.mensagem
```

**Convenções:**
- `from __future__ import annotations` no topo (igual ao código de produção).
- `@pytest.mark.django_db` em todo teste que acessa ORM. Testes puros (ex.: `apps/provedores/tests/test_cripto.py`) não precisam.
- Docstring de 1 linha em PT-BR descrevendo o cenário esperado.
- Arrange/Act/Assert separado por linha em branco quando ajuda leitura — sem header explícito.
- Fixtures por argumento (`usina`, `config`, `inversor`, `empresa`, `monkeypatch`, `db`).
- Helpers locais com prefixo `_` (`_criar_leitura_inversor`, `_montar_jwt`, `_coletado_em`).
- Sem framework BDD (`describe`/`context`) — apenas `test_*` planas.

## Mocking

**Bibliotecas:**
- `pytest.monkeypatch` (built-in) — preferido para substituir atributos/funções.
- `unittest.mock.patch` — usado quando precisa de context manager com múltiplas substituições.

**Padrão monkeypatch (frequente):**
```python
@pytest.mark.django_db
def test_estado_none_retorna_none(usina, inversor, config, monkeypatch):
    """Se estado é None (provedor não conseguiu ler), regra não avalia."""
    monkeypatch.setattr(
        "apps.alertas.regras.inversor_offline.em_horario_solar",
        lambda u, c: True,
    )
    ...
```

**Padrão unittest.mock para mocks externos (`apps/provedores/adapters/auxsol/tests/test_relogin.py`):**
```python
from unittest.mock import patch

with (
    patch("apps.provedores.adapters.auxsol.adapter.listar_usinas", listar_fake),
    patch("apps.provedores.adapters.auxsol.adapter.fazer_login", login_fake),
):
    adapter.buscar_usinas()
```

**Padrão monkeypatch.setitem para registries (`apps/alertas/tests/test_motor_agregacao.py`):**
```python
monkeypatch.setitem(regras_base._REGISTRO, _Dummy.nome, _Dummy)
monkeypatch.setattr(motor_mod, "regras_registradas", lambda: [_Dummy])
```

**Cleanup automático via fixture autouse (`apps/alertas/tests/test_sem_geracao_horario_solar_astral.py`):**
```python
@pytest.fixture(autouse=True)
def _limpar_cache_astral():
    """Limpa o cache do helper antes/depois de cada teste."""
    _helpers._CACHE_JANELA_ASTRAL.clear()
    yield
    _helpers._CACHE_JANELA_ASTRAL.clear()
```

**O que mockar:**
- Adapters: chamadas HTTP via patch em `consultas.py`/`autenticacao.py` (`listar_usinas`, `fazer_login`).
- Regras dependentes de tempo: `em_horario_solar`, `djtz.now`.
- Caches em módulo (limpar com fixture autouse).

**O que NÃO mockar:**
- ORM — usa banco de teste real com `@pytest.mark.django_db`.
- Operações de domínio simples (Decimal, formatação) — chamar direto.
- Serializers/views DRF — usar `APIClient`.

## Fixtures and Factories

**Fixtures compartilhadas por app (`tests/conftest.py`):**
- `apps/alertas/tests/conftest.py` define `empresa`, `config`, `conta_provedor`, `usina` (com `Garantia` ativa — sem ela o motor pula), `inversor`.
- Fixtures aceitam `db` (ativa o transactional DB do pytest-django) + dependências entre si.

**Exemplo (`apps/alertas/tests/conftest.py`):**
```python
@pytest.fixture
def empresa(db):
    return Empresa.objects.create(nome="Empresa Teste", slug="empresa-teste")


@pytest.fixture
def config(db, empresa):
    return ConfiguracaoEmpresa.objects.create(empresa=empresa)


@pytest.fixture
def usina(db, empresa, conta_provedor):
    u = Usina.objects.create(
        empresa=empresa,
        conta_provedor=conta_provedor,
        id_externo="ext-1",
        nome="Usina Teste",
        capacidade_kwp=Decimal("100.000"),
    )
    # Garantia ativa — sem ela o motor pula a usina.
    Garantia.objects.create(
        empresa=empresa, usina=u,
        inicio_em=date.today() - timedelta(days=30),
        meses=24,
    )
    return u
```

**Fixtures locais por arquivo (quando precisa de variações):**
- `apps/superadmin/tests/test_api.py` redefine `empresa_a`, `empresa_b`, `empresa_firma`, `admin_a`, `superadmin`, `operacional_b` + clients (`client_super`, `client_admin`, `client_op`).
- `apps/alertas/tests/test_api_configuracao_regras.py` define múltiplas empresas para testar multi-tenancy: `empresa_a`, `empresa_b`, `admin_a`, `operacional_a`, `admin_b`. Helper `_criar_usuario(empresa, papel, sufixo)` evita duplicação.

**Padrão `_client(user)` para autenticar APIClient:**
```python
def _client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c
```

**Fixtures de JSON real (adapters):**
```python
FIXTURES = Path(__file__).parent / "fixtures"

def _load(name: str) -> dict:
    return json.loads((FIXTURES / name).read_text())


@pytest.fixture
def adapter() -> SolisAdapter:
    return SolisAdapter({"api_key": "dummy", "app_secret": "dummy"})
```
Fixtures em `apps/provedores/adapters/<provedor>/tests/fixtures/` são payloads reais sanitizados (sem credenciais), capturados em datas específicas — comentadas nos docstrings: `"capturados from the production system... observed on 2026-04-24"`.

**Variação de fixture sem duplicar (spread dict):**
```python
raw = _load("inverter_list_record.json")
raw = {**raw, "_detail": {**raw["_detail"], "uAc1": 115.0, "uAc2": 112.0}}
dados = adapter._normalizar_inversor(raw, id_usina_externo="X")
```

**Factory-boy:** instalado mas pouco usado. Padrão dominante é `Model.objects.create(...)` direto em fixtures pytest.

## Coverage

**Requirements:** Sem threshold enforcado. `pytest-cov` instalado em `backend/requirements-dev.txt`.

**View Coverage:**
```bash
docker compose exec backend pytest --cov=apps --cov-report=term
docker compose exec backend pytest --cov=apps --cov-report=html  # gera htmlcov/
```

**Áreas com cobertura forte:**
- Adapters de provedores: ≥7 arquivos de teste, fixtures reais cobrindo normalização, unit conversion, status mapping, null preservation. 44+ testes.
- Motor de alertas: 11 arquivos cobrindo agregação por usina, configuração por empresa, tri-state, escalada de severidade, regra desativada, janela astral, calibração de thresholds.
- Multi-tenancy: `apps/superadmin/tests/test_api.py` valida cross-tenant; `apps/alertas/tests/test_api_configuracao_regras.py` valida que empresa A não enxerga empresa B.

**Áreas sem cobertura automática:**
- Frontend (sem suíte).
- Tasks Celery e signals — testes indiretos via teste do motor.
- Notificações (webhook delivery).

## Test Types

**Unit Tests:**
- Regras de alerta isoladas: `apps/alertas/tests/test_inversor_offline.py`, `test_sem_comunicacao.py`. Chamam `RegraXYZ().avaliar(...)` direto, asserting `Anomalia`/`False`/`None`.
- Parsers e helpers: `apps/provedores/tests/test_cripto.py::parsear_exp_jwt` testa só a função pura.
- Normalização de adapter: `apps/provedores/adapters/solis/tests/test_normalizacao.py` chama `adapter._normalizar_usina(raw)` com fixture JSON real.

**Integration Tests (motor):**
- `apps/alertas/tests/test_motor_agregacao.py` cria leituras reais no banco, chama `avaliar_empresa(empresa.id)`, asserta state final em `Alerta.objects.filter(...)`.
- Cobre ciclo completo: leitura no DB → motor → alerta criado/atualizado/resolvido.

**API Tests (DRF):**
- `apps/superadmin/tests/test_api.py`, `apps/alertas/tests/test_api_configuracao_regras.py`, `apps/core/tests/test_configuracoes_api.py`.
- Usam `rest_framework.test.APIClient` com `force_authenticate`. Resolução de URL via `reverse("nome-da-rota")`.
- Asserta `status_code` (com `from rest_framework import status`), payload (`resp.data["results"]`), e side-effects (objetos criados/alterados).

**Cross-tenant Tests:**
- Padrão estabelecido em `apps/alertas/tests/test_api_configuracao_regras.py` e `apps/superadmin/tests/test_api.py`: criar 2+ empresas, usuários diferentes, verificar que requests de empresa A só veem objetos de A.

**E2E:** não há.

## Common Patterns

**Async / Tasks (Celery):**
- Tasks Celery são chamadas sincronamente nos testes (`task.run(arg)` ou função direta).
- `transaction.on_commit` em motor: cobertos via `avaliar_empresa(empresa_id)` chamada explícita sem precisar do callback de commit.

**Error Testing:**
```python
with pytest.raises(ErroAutenticacaoProvedor):
    adapter.buscar_usinas()
```

**Time / Timezone:**
- `djtz.now()` (`from django.utils import timezone as djtz`) sempre. Nunca `datetime.now()`.
- `coletado_em` arredondado para janela de 10min via helper local `_coletado_em()` em testes do motor.

**Multi-tenant assertion:**
```python
# Operacional de A não vê regras de empresa B.
resp = _client(operacional_a).get(reverse("configuracao-regras-list"))
empresas_de_overrides = {ConfiguracaoRegra.objects.get(...).empresa_id for ...}
assert empresas_de_overrides <= {empresa_a.id}
```

**Tri-state assertion em regras:**
```python
resultado = InversorOffline().avaliar(inversor, leitura, config)

# Anomalia — não é None, não é False
assert resultado is not None and resultado is not False

# Resolve aberto
assert resultado is False

# Não avalia
assert resultado is None
```

**Não usar `assert resultado` ou `assert not resultado`** quando o valor pode ser `None`/`False`/`Anomalia` — sempre `is None`/`is False` explícito.

**Adicionar nova regra → adicionar teste:**
- Criar `apps/alertas/tests/test_<regra>.py`.
- Reaproveitar fixtures `empresa`, `config`, `usina`, `inversor` de `apps/alertas/tests/conftest.py`.
- Cobrir 4 cenários mínimos: dado ausente (`None`), condição falsa (`False`), condição verdadeira (`Anomalia` com severidade certa), guard de potência mínima quando aplicável.

**Adicionar novo adapter → adicionar testes de normalização:**
- Criar `apps/provedores/adapters/<provedor>/tests/test_normalizacao.py`.
- Capturar fixtures reais sanitizadas em `fixtures/` (sem credenciais, sem URLs assinadas — GitHub Push Protection já bloqueou Alibaba OSS).
- Cobrir: `id_externo`, `nome`, `capacidade_kwp`, `status`, `raw` preservado, unit conversion (kW vs W, kWh vs Wh), null-on-offline (campos elétricos vazios viram `None`, nunca `0`).

---

*Testing analysis: 2026-05-12*
