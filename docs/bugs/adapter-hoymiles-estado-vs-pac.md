---
title: Adapter Hoymiles reporta estado=offline com pac_kw>0
descoberto_em: 2026-05-06
severidade: aviso
status: aberto
tags: [bug, adapter, hoymiles, alertas]
---

# Adapter Hoymiles: `estado=offline` com `pac_kw > 0`

## Sintoma

Em produção há ao menos um inversor reportando `LeituraInversor.estado='offline'` enquanto `pac_kw > 0` na mesma leitura. Estados são contraditórios — se o inversor está produzindo potência ativa, ele está fisicamente online.

## Caso concreto encontrado em 2026-05-06

- **Usina:** RAFAEL ALBINO (id 88)
- **Inversor:** id 141, número de série `1422B022ED08`, microinversor Hoymiles
- **Leituras observadas:** 4 coletas seguidas com `estado='offline'` e `pac_kw` entre **1.222 e 1.648 kW**.

## Impacto

- A regra `inversor_offline` confia em `estado` para decidir abrir/fechar alerta. Como o estado vem `offline`, o motor pode abrir alerta para um inversor que está, de fato, gerando.
- O dashboard pode mostrar a usina gerando energia normalmente (porque `pac_kw` é somado), mas listar um inversor "parado" que na verdade está produzindo. UX confusa.
- Outras regras que olham `pac_kw` (sobretensão, subtensão, frequência) podem ser silenciadas por engano se o motor pular avaliação por `estado=offline`.

## Hipótese principal

O adapter Hoymiles em `apps/provedores/adapters/hoymiles/adapter.py` (provavelmente em `_normalizar_inversor`) está tratando o status do **gateway/DTU** (que pode estar offline) como o status do **microinversor** (que está reportando produção MPPT). Em microinversores Hoymiles, o gateway é o DTU; um microinversor pode estar gerando enquanto o DTU está com problema de comunicação (ou vice-versa). A API `/website/realtime` (ou similar) costuma trazer ambos os status.

Conferir mapeamento atual:

```bash
grep -n "estado\|status\|warn_data\|connect" backend/apps/provedores/adapters/hoymiles/adapter.py
```

A linha provavelmente relevante já existe:
```python
conectado = (r.get("warn_data") or {}).get("connect", False)
estado = "online" if conectado else "offline"
```

`warn_data.connect` parece ser o status de conexão do **microinversor** com o DTU, mas talvez quando o DTU está offline o `warn_data.connect` vem `False` mesmo com produção positiva de outro caminho (ex: `_realtime`). Investigar resposta crua da API.

## Próximos passos

1. Coletar payload bruto (`raw`) de uma leitura afetada — ler `LeituraInversor.raw` da última coleta da usina RAFAEL ALBINO inversor `1422B022ED08`.
2. Decidir regra correta: se `pac_kw > limiar` mantém `estado=online`, OU manter o status do gateway e mudar a interpretação do motor.
3. Criar teste unitário com fixture do payload bruto antes de mudar.
4. Conferir se o Hoymiles tem cenários equivalentes para outros tipos de inversor.

## Workaround temporário

Operador pode fechar manualmente alertas órfãos pela tela `/alertas` (já é fluxo previsto). Dado que o sintoma parece raro (1 caso identificado em 31 alertas abertos), não vale fix urgente — mas vale registrar agora antes de esquecer.

## Arquivos relevantes

- `backend/apps/provedores/adapters/hoymiles/adapter.py`
- `backend/apps/alertas/regras/inversor_offline.py`
- `backend/apps/provedores/adapters/hoymiles/tests/` — fixtures podem ajudar a entender a forma do payload

## Como investigar em produção

```bash
# Pegar o raw da última leitura afetada:
docker exec monitoramento-db-1 psql -U monitoramento -d monitoramento -c "
SELECT li.coletado_em, li.estado, li.pac_kw, li.raw
FROM monitoramento_leiturainversor li
WHERE li.inversor_id = 141
ORDER BY li.coletado_em DESC LIMIT 3;
" | head -80
```

A coluna `raw` traz o JSON bruto que o adapter recebeu do Hoymiles — base para reproduzir o cenário em fixture.
