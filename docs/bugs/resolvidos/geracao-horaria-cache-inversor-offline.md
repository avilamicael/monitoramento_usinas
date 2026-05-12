---
title: Geração horária — bucket 00h infla por cache do provedor quando inversor está offline
severidade: aviso
status: resolvido
descoberto_em: 2026-05-12
resolvido_em: 2026-05-12
fix_commit: 960006b
afeta: /api/dashboard/geracao_horaria/, gráfico "Geração de hoje" na dashboard
tags: [bugs, dashboard, ingestao, provedores]
---

> **RESOLVIDO em 2026-05-12** — commit `960006b`. Implementada a mitigação 1
> (1ª leitura do dia vira baseline). Validação em prod: bucket 00h voltou a
> zero. Item de roadmap longo prazo: alinhar adapters chineses com
> `null-on-offline` (mitigação 4) pra resolver na origem em outras métricas.

---

# Sintoma

O bucket `hora=0` (00h–01h local) do endpoint `/api/dashboard/geracao_horaria/`
e do gráfico "Geração de hoje" exibe **energia substancialmente maior que zero**
mesmo sendo madrugada (sem geração solar real).

Smoke check em prod 2026-05-12 ~01h BRT:

```
=== Energia atribuída ao bucket 00h (max(energia_hoje_kwh) na primeira hora do dia local)
  solarman           2244.6 kWh  (111 usinas)
  foxess              386.6 kWh  (14 usinas)
  hoymiles            312.8 kWh  (79 usinas)
  solis               218.1 kWh  (12 usinas)
  auxsol                0.0 kWh  (6 usinas)
  fusionsolar           0.0 kWh  (52 usinas)
```

Solarman, FoxESS, Hoymiles e Solis inflam o bucket. AuxSol e FusionSolar
ficam em 0.

# Causa-raiz (corrigida)

A hipótese inicial de "fuso UTC+8" estava errada. **O `energia_hoje_kwh` é
zerado corretamente à 00:00 BRT.** O problema é o comportamento do servidor
do provedor quando o inversor está **offline durante a noite**.

Série temporal real de uma usina Solarman em SC (CLEVERSON DE OLIVEIRA):

```
2026-05-10 17:00 BRT   energia_hoje = 73.90  pac = 0.49 kW    ← último sol
2026-05-10 18:00 BRT   energia_hoje = 74.00  pac = 0.12 kW    ← pôr do sol
2026-05-10 19:00 → 06:59 BRT  energia_hoje = 74.00 (CONGELADO) ← inversor desligado
2026-05-11 07:00 BRT   energia_hoje =  0.00  pac = 0.06 kW    ← reset, novo dia
2026-05-11 08:00 BRT   energia_hoje =  1.10
```

Mecanismo:

1. Inversor desliga ao pôr do sol (sem sol → sem comunicação com servidor).
2. Servidor do provedor **devolve o último valor cacheado** quando consultado
   entre 18h e 06:59 (`medido_em` fica congelado também).
3. A coleta às 00:00 BRT recebe esse valor cacheado (= total do dia anterior).
4. O algoritmo de `DashboardGeracaoHorariaView`:

   ```python
   anterior = 0.0
   for h in range(24):
       atual = horas.get(h)
       if atual is None: continue
       inc = max(0.0, atual - anterior)  # ← na hora 0, inc = atual - 0 = cache do dia anterior
       por_hora[h] += inc
       anterior = atual
   ```

   Resultado: o cache do dia anterior cai inteiro no bucket 00h.

5. Quando o inversor acorda (~07h) e envia `0`, nosso `anterior` continua
   alto, então `max(0, 0 - 74)` é clamp em 0 e a queda é absorvida. Mas o
   bucket 0 já carregava os 74 kWh fantasma.

## Por que AuxSol e FusionSolar não inflam

[CLAUDE.md](../../CLAUDE.md) registra explicitamente para FusionSolar:
**"tratamento MW→kWp + null-on-offline"**. O adapter converte para `null`
quando o inversor está offline. AuxSol tem comportamento análogo (retorna
zero/null à noite). Resultado: a 1ª leitura do dia local já vem como `0` ou
`null`, e o bucket 0 fica vazio.

Os 4 chineses não fazem isso — devolvem o valor cacheado.

## Por que `geracao_diaria` NÃO é afetado

`DashboardGeracaoDiariaView` usa `max(energia_hoje_kwh)` por (usina, dia)
agrupado por `TruncDate("coletado_em")`. O pico do dia é o mesmo independente
da hora em que foi capturado. O cache da madrugada só "repete" o pico do dia
anterior, mas não infla o agrupamento porque cada dia tem seu próprio max.

# Possíveis mitigações

1. **Primeira leitura como baseline** (recomendado). Em vez de
   `anterior = 0.0` no início, usar o valor da 1ª leitura do dia como
   baseline e contar incrementos só a partir da 2ª. Funciona pra todos os
   provedores: pros chineses descarta o cache, pros nacionais (já em 0)
   não muda nada.

   Validado contra a série da CLEVERSON: total recalculado = 79.40 kWh
   (igual ao pico final do dia). Sem o fix, daria 91.10 kWh (= pico + cache
   do dia anterior).

2. **Ignorar leituras com `medido_em` congelado** — quando `medido_em` da
   leitura atual é igual ou anterior à última leitura registrada, é
   provavelmente um cache do provedor. Pular essa leitura na agregação.
   Mais robusto mas exige mexer também na ingestão pra carregar `medido_em`
   junto.

3. **Marcar `energia_hoje_kwh = None` no adapter chinês quando
   `medido_em < inicio_dia_local`** — corrige na origem. Bom mas mais
   invasivo: 4 adapters mudam.

4. **`null-on-offline` por padrão em todos os adapters** — adapt nascentes
   (Solarman/FoxESS/Hoymiles/Solis) chamariam `null` se o snapshot for
   estale. Alinha comportamento com FusionSolar/AuxSol. Bom e correto,
   mas é mudança grande que afeta também outras métricas.

Decisão sugerida: **opção 1** pro fix imediato no dashboard. Considerar
opção 4 como item de roadmap pra alinhamento geral.

# Próximos passos

- [ ] Implementar opção 1 em `apps/core/dashboard.py::DashboardGeracaoHorariaView`.
- [ ] Teste `apps/core/tests/test_dashboard_geracao_horaria.py` cobrindo:
  - usina Solarman com cache da madrugada (regressão deste bug)
  - usina FusionSolar com null à noite (não-regressão)
  - usina coletando ao longo do dia (cálculo correto)
- [ ] Avaliar opção 4 (`null-on-offline` global) como follow-up.
