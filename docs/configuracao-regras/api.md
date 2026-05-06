---
title: Configuração de Regras — API REST
status: rascunho
tags: [planejamento, alertas, api]
---

# API REST

Volta para [[index]]. Modelo em [[modelo-dados]].

## Endpoints

Todos sob `/api/alertas/configuracao-regras/`. Permissão: `AdminEmpresaOuSomenteLeitura`.

### `GET /api/alertas/configuracao-regras/`

Lista todas as regras conhecidas pelo motor, mesclando defaults com overrides da empresa logada. **Sempre retorna 12 linhas** (uma por regra registrada), mesmo que ainda não tenham sido configuradas.

```json
{
  "results": [
    {
      "regra_nome": "sobretensao_ac",
      "ativa": true,
      "severidade": "info",
      "is_default": true,
      "severidade_default": "info",
      "ativa_default": true,
      "descricao": "Tensão AC acima do limite (240V)",
      "severidade_dinamica": false,
      "configurada_em": null
    },
    {
      "regra_nome": "sem_comunicacao",
      "ativa": true,
      "severidade": "aviso",
      "is_default": true,
      "severidade_default": "aviso",
      "ativa_default": true,
      "descricao": "Usina sem comunicação por mais de N minutos",
      "severidade_dinamica": true,
      "configurada_em": null
    }
  ]
}
```

Campos:
- `is_default: true` — não há `ConfiguracaoRegra` para essa regra; está usando os defaults do código.
- `severidade_dinamica: true` — a regra escala severidade internamente; o select de severidade na UI fica desabilitado.
- `configurada_em` — `updated_at` do registro, ou `null` se nunca configurada.

### `PUT /api/alertas/configuracao-regras/<regra_nome>/`

Cria ou atualiza override (upsert).

```json
// PUT /api/alertas/configuracao-regras/sobretensao_ac/
{
  "ativa": false,
  "severidade": "info"
}
```

Resposta: 200 com o objeto atualizado (mesmo schema do GET).

Validações:
- `regra_nome` precisa existir em `regras_registradas()`. Se não, 404.
- `severidade` precisa ser um dos `SeveridadeAlerta.choices`.

### `DELETE /api/alertas/configuracao-regras/<regra_nome>/`

Remove o override e volta para os defaults da regra. Resposta 204.

### `POST /api/alertas/configuracao-regras/reset-todos/`

Atalho para apagar todos os overrides da empresa (volta tudo aos defaults). Pede confirmação na UI. Resposta 204.

## Implementação

```python
# apps/alertas/views.py

class ConfiguracaoRegraView(APIView):
    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def get(self, request):
        overrides = {
            c.regra_nome: c
            for c in ConfiguracaoRegra.objects.filter(empresa=request.empresa)
        }
        results = []
        for cls in regras_registradas():
            cfg = overrides.get(cls.nome)
            results.append({
                "regra_nome": cls.nome,
                "ativa": cfg.ativa if cfg else True,
                "severidade": cfg.severidade if cfg else cls.severidade_padrao,
                "is_default": cfg is None,
                "severidade_default": cls.severidade_padrao,
                "ativa_default": True,
                "descricao": cls.__doc__.strip().split("\n")[0] if cls.__doc__ else "",
                "severidade_dinamica": getattr(cls, "severidade_dinamica", False),
                "configurada_em": cfg.updated_at.isoformat() if cfg else None,
            })
        return Response({"results": results})


class ConfiguracaoRegraDetalheView(APIView):
    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def put(self, request, regra_nome):
        nomes_validos = {cls.nome for cls in regras_registradas()}
        if regra_nome not in nomes_validos:
            return Response(status=404)
        # ... validar payload via serializer ...
        obj, _ = ConfiguracaoRegra.objects.update_or_create(
            empresa=request.empresa,
            regra_nome=regra_nome,
            defaults={"ativa": data["ativa"], "severidade": data["severidade"]},
        )
        # Retorna no mesmo formato do GET (uma linha)
        ...

    def delete(self, request, regra_nome):
        ConfiguracaoRegra.objects.filter(
            empresa=request.empresa, regra_nome=regra_nome
        ).delete()
        return Response(status=204)
```

## Roteamento

Endpoints sob `/api/alertas/configuracao-regras/` (não `/api/configuracao-regras/`) porque pertencem ao app `alertas` — mantém modularidade. Em `apps/alertas/urls.py`, os paths precisam vir **antes do router** para não colidir com o `<pk>` permissivo do `AlertaViewSet`. Ordem importa: `reset-todos/` antes de `<str:regra_nome>/` para não cair como uma "regra de nome reset-todos".

```python
# apps/alertas/urls.py

urlpatterns = [
    # Antes do router. Ordem: reset-todos antes de <regra_nome>.
    path("configuracao-regras/", views.ConfiguracaoRegraView.as_view()),
    path("configuracao-regras/reset-todos/", views.ConfiguracaoRegraResetView.as_view()),
    path("configuracao-regras/<str:regra_nome>/", views.ConfiguracaoRegraDetalheView.as_view()),
    # ... router e demais URLs do app
]
```

## Marcação de regra com severidade dinâmica

Adicionar `severidade_dinamica: bool = False` em `RegraBase` (em `apps/alertas/regras/base.py`). Subir para `True` em:

- `sem_comunicacao` (escala 24h → 48h)
- `garantia_vencendo` (escala 30d → 7d)

Na UI, esses dois ficam com o select de severidade desabilitado e um tooltip explicando.

## Próximo: [[ui]]
