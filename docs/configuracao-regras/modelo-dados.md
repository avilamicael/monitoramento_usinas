---
title: Configuração de Regras — Modelo de Dados
status: rascunho
tags: [planejamento, alertas, modelo]
---

# Modelo de Dados

Volta para [[index]].

## Novo model: `ConfiguracaoRegra`

Nasce no app `apps/alertas/`. 1 linha por (empresa, nome de regra). Contém apenas os 2 campos que o usuário deve poder mexer no MVP — `ativa` e `severidade`.

```python
# apps/alertas/models.py

class ConfiguracaoRegra(models.Model):
    """Override por empresa de defaults declarados em
    `apps/alertas/regras/<nome>.py`.

    Quando não há linha para uma regra/empresa, o motor usa os defaults
    da própria classe da regra (`severidade_padrao`, sempre ativa).
    """
    empresa = models.ForeignKey(
        "empresas.Empresa", on_delete=models.CASCADE, related_name="configuracoes_regra"
    )
    regra_nome = models.CharField(max_length=64, db_index=True)
    ativa = models.BooleanField(default=True)
    severidade = models.CharField(
        max_length=20,
        choices=SeveridadeAlerta.choices,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["empresa", "regra_nome"],
                name="configuracaoregra_unica_por_empresa_regra",
            ),
        ]
        indexes = [
            models.Index(fields=["empresa", "regra_nome"]),
        ]
```

**Observações:**
- `regra_nome` é validado contra `apps.alertas.regras.regras_registradas()` no `clean()` para evitar lixo (regras renomeadas/removidas).
- Não tem `is_active` porque já tem `ativa` específico do domínio (não é o padrão `is_active` de soft delete).
- Não herda `EscopoEmpresa` porque a tabela já tem o FK `empresa` explícito; o uso é sempre `ConfiguracaoRegra.objects.filter(empresa=...)` direto.

## Como o motor usa

```python
# apps/alertas/motor.py (esboço)

def avaliar_empresa(empresa_id: UUID) -> None:
    config_empresa = ConfiguracaoEmpresa.objects.get(empresa_id=empresa_id)
    overrides = {
        cr.regra_nome: cr
        for cr in ConfiguracaoRegra.objects.filter(empresa_id=empresa_id)
    }

    for regra_cls in regras_registradas():
        cfg = overrides.get(regra_cls.nome)
        if cfg is not None and not cfg.ativa:
            continue  # pula regra desativada

        severidade_efetiva = (
            cfg.severidade if cfg is not None else regra_cls.severidade_padrao
        )
        # ... resto do loop, passando severidade_efetiva pra `_aplicar`
```

A `Anomalia` retornada pela regra hoje carrega `severidade` própria. Para algumas regras (`sem_comunicacao`, `garantia_vencendo`) a severidade é dinâmica (escala com tempo). Decisão:

- **Regras com severidade fixa**: motor sobrescreve com `severidade_efetiva` se houver `ConfiguracaoRegra`.
- **Regras com severidade dinâmica**: continuam decidindo internamente. `ConfiguracaoRegra.severidade` para essas regras é interpretado como "teto" (não ultrapassa) ou "piso" — a definir. Mais simples para o MVP: ignorar `ConfiguracaoRegra.severidade` para regras dinâmicas e marcá-las na UI como "severidade gerenciada pela regra".

## Migration

```bash
make makemigrations alertas
# Gera: 0XXX_configuracaoregra.py — apenas CreateModel + UniqueConstraint
```

Sem dados iniciais. A tabela começa vazia; defaults vêm do código.

## Backfill (opcional)

Para empresas existentes, podemos rodar um management command `popular_configuracao_regras` que cria as 12 linhas com os defaults atuais. Isso facilita o admin (vê tudo na tela), mas não é necessário para o motor funcionar.

Trade-off:
- **Sem backfill**: empresa nova vê tela vazia; precisa "ativar" cada regra. Tela tem que ser inteligente (mostrar regras virtuais com defaults visíveis e botão "personalizar").
- **Com backfill**: 12 linhas por empresa. ~12 × N empresas — irrelevante em volume, mas precisa rodar o command toda vez que adicionar regra nova.

Decisão proposta: **sem backfill**. UI mostra todas as regras com defaults; só cria linha quando o admin muda alguma coisa. Mantém DB enxuto e elimina a obrigação de rodar command.

## Vinculação com [[../../backend/apps/empresas/models|Empresa]] e [[../../backend/apps/core/models|ConfiguracaoEmpresa]]

`ConfiguracaoRegra` é independente de `ConfiguracaoEmpresa`. Coexistem:
- `ConfiguracaoEmpresa` — 1:1 com Empresa, tem thresholds numéricos globais (limites de tensão, % subdesempenho, etc.).
- `ConfiguracaoRegra` — 1:N, define ativa/severidade por regra.

Não há sobreposição. Editar uma não afeta a outra.

## Próximo: [[api]]
