---
title: Geração horária — bucket 00h infla com "carry-over" de provedores chineses
severidade: aviso
status: aberto
descoberto_em: 2026-05-12
afeta: /api/dashboard/geracao_horaria/, gráfico "Geração de hoje" na dashboard
tags: [bugs, dashboard, fuso, provedores]
---

# Sintoma

O bucket `hora=0` (00h–01h local) do endpoint `/api/dashboard/geracao_horaria/`
e do gráfico "Geração de hoje" do dashboard exibe **energia substancialmente
maior que zero** em produção, mesmo sendo madrugada (sem geração solar real).

Smoke check em 2026-05-12 ~01h BRT em produção:

```
=== Energia atribuída ao bucket 00h (max(energia_hoje_kwh) na primeira hora do dia local)
  solarman           2244.6 kWh  (111 usinas)
  foxess              386.6 kWh  (14 usinas)
  hoymiles            312.8 kWh  (79 usinas)
  solis               218.1 kWh  (12 usinas)
  auxsol                0.0 kWh  (6 usinas)
  fusionsolar           0.0 kWh  (52 usinas)
```

**Padrão**: só provedores com servidor na China (Solarman, FoxESS, Hoymiles,
Solis) inflam o bucket. AuxSol (nacional) e FusionSolar (Huawei, fuso regional)
ficam em 0.

# Causa-raiz

Os provedores chineses calculam o `energia_hoje_kwh` cumulativo no fuso do
**servidor deles (UTC+8)** e não no fuso da usina (UTC-3 / America/Sao_Paulo).

Quando bate 00:00 no Brasil (= 03:00 UTC = 11:00 China), o "dia chinês" está em
andamento desde 16:00 UTC do dia anterior (= 13:00 BRT). O contador
`energia_hoje_kwh` retornado pela API do provedor naquele instante carrega o
acumulado do dia brasileiro anterior inteiro — não foi resetado.

A primeira leitura do dia brasileiro cai com esse valor alto, e o cálculo em
[apps/core/dashboard.py](../../backend/apps/core/dashboard.py) faz:

```python
inc = max(0.0, atual - anterior)  # anterior=0 na hora 0
```

Resultado: tudo o que estava acumulado vai pro bucket 00h–01h.

# Reprodução

```bash
ssh trylab-vps "cd /opt/monitoramento && docker compose exec backend \
  python manage.py shell -c '...'"  # consulta agrupada por provedor
```

Ou via dashboard: abrir https://monitoramento.trylab.com.br/ logo após a
meia-noite. Bucket 00h–01h estará anormalmente alto; demais horas até o
amanhecer ficam ~zero (esperado).

# Por que `geracao_diaria` não tem o mesmo problema

`DashboardGeracaoDiariaView` agrupa por `TruncDate("coletado_em")` —
discrimina dias pelo timestamp **da nossa coleta** (não do provedor). O
"carry-over" da virada do dia provedor entra como leitura do dia brasileiro
correto, não como ganho fantasma.

# Possíveis mitigações

1. **Heurística no backend**: na primeira leitura do dia local de cada usina,
   ignorar o ganho `atual - 0` e tratar como baseline (começa a contar
   incrementos só a partir da 2ª leitura do dia). Risco: quem coleta pouco
   pode ficar com 1h de geração legítima descartada.

2. **Detecção de reset do contador**: identificar quando `energia_hoje_kwh`
   cai abruptamente (queda > X%) e considerar isso o início do dia para o
   cálculo, em vez do TruncDate local. Mais correto, mais código.

3. **Cap por bucket**: limitar cada bucket horário a `capacidade_kwp * 1h`
   (geração máxima física). Bucket 0 ficaria limitado, mas é uma máscara, não
   um fix.

4. **Ajuste por provedor**: aplicar offset de fuso para o contador
   `energia_hoje_kwh` dos provedores chineses na ingestão. Mais invasivo —
   exige saber o fuso de cada provedor (registrar no `BaseAdapter.Capacidades`).

A opção 1 é a mais barata e cobre o caso comum.

# Próximos passos

- [ ] Decidir mitigação (sugestão: opção 1, descartar incremento da primeira
      leitura de cada usina).
- [ ] Considerar registrar `fuso_provedor` no adapter (info útil em mais
      lugares).
- [ ] Adicionar teste em `apps/core/tests/test_dashboard_geracao_horaria.py`
      cobrindo cenário de fuso China.
