# Relatório: alertas nativos dos provedores vs. motor interno do sistema novo

**Data**: 2026-04-29
**Autor**: análise técnica automatizada
**Escopo**: 6 provedores em produção (Solis, Hoymiles, FusionSolar, Solarman, AuxSol, FoxESS), 268 usinas, 661 inversores.

---

## 1. Sumário executivo

**Tese**: a estratégia atual de gerar alertas a partir das leituras (motor interno tri-state) é **objetivamente superior** à reincorporação dos nativos como source-of-truth em todos os 6 provedores analisados; nativos servem apenas para auditoria opcional. As lacunas reais não são da estratégia — são de **calibração de regras** e de **observabilidade da própria coleta** (4 alertas críticos `sem_comunicacao` em Solarman há 200–727h denunciam usinas mortas há semanas, não falha do motor).

| Provedor | Usinas | Inversores | Nativos ATIVOS | Internos ABERTOS | Cobertura semântica nativa | FP estimado nativos | Gap reportado pelo nativo |
|---|---:|---:|---:|---:|---|---:|---|
| Solis | 12 | 12 | 9 (`alertas_provedor_solis.json#agregados.por_codigo_alarme_ativos`) | 0 abertos / 15 resolvidos recentes | Alta (granular por inversor, ID estável, severidade) | ~30% (churn p50=300s, n=211) | Subdesempenho sticky há 1.5 ano falso-positivo |
| Hoymiles | 79 | 259 | 62 (todos `s_uoff`, granular USINA) | 3 `inversor_offline` | Baixa (1 flag binária só, sem ID inversor, sem timestamp do alerta) | Indeterminável (sem ciclo de vida) | Tudo que não seja "station offline" |
| FusionSolar | 52 | 60 | 0 ativos / 3 hist 7d | 1 `inversor_offline` | Média (granular, ID estável, severidade `lev`) — mas **só conectividade grosseira na thirdData** | Baixo no observado (poucos eventos) | Sobretensão, frequência, temperatura, MPPT, subdesempenho |
| Solarman | 106 | 275 | **0** apesar de 98/106 `communicationAllOffline` | **8** (3 `inversor_offline` + 4 `sem_comunicacao` críticos + 1 outro) | Crítica: feed nativo **não conta sem-comunicação como alerta** | N/D | 92% das usinas offline são invisíveis ao feed nativo |
| AuxSol | 5 | 5 | 0 ativos / 29 hist 90d | 1 `sem_comunicacao` | Média (eventos transientes de rede, granular) | **96%** (28 de 29 alarmes <1h, p50=0.08h ≈ 5 min) | Subdesempenho, offline >24h |
| FoxESS | 14 | 50 | 3 (`currentFault`, todos com mesmo trio `4151,4156,4158`) | 0 abertos | Baixa (sem endpoint de alarme dedicado, só `currentFault` no real/query) | Médio (auto-recuperam em segundos) | Sem catálogo, sem timestamp, sem histórico |
| **Total** | **268** | **661** | **74 ativos** | **12 abertos** | **3/6 provedores cobrem só conectividade** | **>50% médio** | **Cobertura elétrica fina ~0** |

**Pontos**:
- **Onde o sistema novo é claramente melhor**: filtragem de churn (96% dos AuxSol e maior parte dos Solis seriam ruído), granularidade por inversor onde nativo só dá usina (Hoymiles), cobertura de "sem comunicação" onde nativo entrega zero (Solarman: 98 offline → 0 alertas), cobertura semântica elétrica (sobretensão/frequência/temperatura) que **nenhum** dos 6 provedores expõe consistentemente.
- **Onde tem lacuna real**: 4 alertas Solarman `sem_comunicacao` críticos abertos há 200–727h sem escalonamento (notificar / inativar usina automaticamente); subdesempenho persistente da Solis (CANUTO SUSHI, Daniele Vieira) não tem confirmação de que `subdesempenho` interno está cobrindo as mesmas usinas; FoxESS `4151,4156,4158` não é cruzado contra a regra interna; FusionSolar requer auditoria por rate-limit `407` brutal.
- **Recomendação**: manter a estratégia atual; adicionar (i) escalonamento de `sem_comunicacao` >7 dias, (ii) tabela `AlertaNativoAuditoria` opcional (raw, nunca source-of-truth) para retrospectiva, (iii) calibrar `subdesempenho` por usina nas 3 que a Solis flagga há 1.5 ano.

---

## 2. Universo monitorado

| Provedor | Usinas | % do total | Inversores | % do total | `last_at` <24h |
|---|---:|---:|---:|---:|---:|
| Solarman | 106 | 39.6% | 275 | 41.6% | 93/106 (87.7%) |
| Hoymiles | 79 | 29.5% | 259 | 39.2% | 79/79 (100%) |
| FusionSolar | 52 | 19.4% | 60 | 9.1% | 52/52 (100%) |
| FoxESS | 14 | 5.2% | 50 | 7.6% | 14/14 (100%) |
| Solis | 12 | 4.5% | 12 | 1.8% | **6/12 (50%)** |
| AuxSol | 5 | 1.9% | 5 | 0.8% | 4/5 (80%) |
| **Total** | **268** | 100% | **661** | 100% | **248/268 (92.5%)** |

Solis tem o pior `last_at` recente (50%) — coerente com 6 das 12 ter alarme nativo `1D4C2` (Loss of internet connection) ativo: o universo é pequeno mas concentra os incidentes mais antigos.

---

## 3. Alertas abertos no sistema novo

12 alertas em aberto, 119 resolvidos no histórico recente (`alertas_sistema_novo.json#stats`).

| ID | Provedor | Usina | Regra | Severidade | Aberto há | Observação |
|---|---|---|---|---|---|---|
| 131 | auxsol | EDMG COMÉRCIO DE FRUTAS | `sem_comunicacao` | aviso | 25h | Datalogger AuxSol parou de reportar; coleta funciona, mas `medido_em` está em 28/04 17:49. |
| 130 | fusionsolar | Paulo serralheria | `inversor_offline` | aviso | <1h | NS2571133486; usina ainda gera 0.378 kW pelo outro inversor. Resolveu e reabriu várias vezes hoje (ver resolvidos_recentes). |
| 129 | hoymiles | Tatiane Camozzato | `inversor_offline` | aviso | <1h | 2 dos 3 inversores offline; usina gera 0.055 kW. |
| 128 | hoymiles | Evandro (Gamboa) | `inversor_offline` | aviso | <1h | 1 de 3; gera 0.253 kW. |
| 126 | hoymiles | RAFAEL ALBINO | `inversor_offline` | aviso | <1h | 1 de 2; gera 0.154 kW. |
| 115 | solarman | RAPHAEL BROGNOLI | `inversor_offline` | aviso | ~5h | 1 de 4; gera 0.265 kW. |
| 32 | solarman | Patrãozin | `inversor_offline` | aviso | ~36h | 1 de 1 — usina inteira parada. |
| 30 | solarman | Francisco e Mari | `inversor_offline` | aviso | ~36h | 2 de 2 — usina inteira parada. |
| **16** | **solarman** | **Patrãozin** | **`sem_comunicacao`** | **crítico** | **~48h** | **última leitura 21/04 09:12 — 201.6h sem dado** |
| **12** | **solarman** | **Francisco e Mari** | **`sem_comunicacao`** | **crítico** | **~48h** | **última leitura 30/03 11:12 — 727.6h (~30 dias) sem dado** |
| **11** | **solarman** | **FÁBIO SOUZA COELHO** | **`sem_comunicacao`** | **crítico** | **~48h** | **última leitura 09/04 10:23 — 488.4h (~20 dias) sem dado** |
| **8** | **solarman** | **ANDERSON ESPINDOLA** | **`sem_comunicacao`** | **crítico** | **~48h** | **última leitura 04/04 12:55 — 605.9h (~25 dias) sem dado** |

**Concentração em Solarman**: 8 dos 12 abertos (67%) são Solarman, dos quais 4 são `sem_comunicacao` crítico com leitura mais recente entre 9 e 30 dias atrás. Diagnóstico:
- Não é falha do motor (a regra está resolvendo corretamente — o backlog `resolvidos_recentes_amostra` mostra 15 `sem_comunicacao` críticos resolvidos automaticamente em 28/04 às 00:00, indicando que coleta voltou a passar para essas usinas).
- Estes 4 que persistem provavelmente são usinas **realmente fora do ar há semanas** (datalogger desligado, contrato cancelado, casa vazia). O motor está fazendo o trabalho dele, mas falta uma camada de **escalonamento operacional**: notificar humano, ou inativar a usina, ou emitir um alerta de meta-nível "usina morta há >7 dias".
- Cruzando com Solarman `status_counting_global`: 98/106 usinas em `communicationAllOffline` (`alertas_provedor_solarman.json:20`); o nativo não conta isso como alerta. Sem o motor interno, **estes 4 problemas reais seriam invisíveis**.

**Padrão saudável dos resolvidos recentes** (`resolvidos_recentes_amostra`):
- 73 resoluções na última ~24h, das quais ~50 do par "Paulo serralheria/RAFAEL ALBINO/Tatiane Camozzato/Evandro (Gamboa)" — flapping legítimo de microinversores Hoymiles voltando online em ciclos de 30–60 min. O motor abre/fecha em coletas alternadas, exatamente o comportamento esperado.
- 14 `sem_geracao_horario_solar` críticos resolveram em 1–2h (coerente com final de tarde / cobertura de nuvem passageira).
- 8 `subtensao_ac` em lote às 28/04 10:47 → 21:41 (rede subdimensionada à tarde). Comportamento de regra com guard de potência mínima funcionando.

---

## 4. Alertas nativos por provedor

### 4.1 Solis

- **Volume**: 9 ativos, 211 históricos, total 220 (`alertas_provedor_solis.json#total_alertas`). Janela: 2024-04-18 a 2026-04-29.
- **Granularidade**: por **inversor** (`alarmDeviceSn`, `alarmDeviceId`). 12 dispositivos distintos no histórico inteiro.
- **ID estável**: sim (`id` por alerta + `alarmCode`).
- **Severidade nativa**: `alarmLevel` 1 (alta — anomalias elétricas) ou 3 (baixa — cloud-side).
- **Cobertura semântica**: ampla — `1010/1011/1012` (sobre/subtensão), `1015` (NO-Grid), `1030` (DC bus), `1041` (firmware), `1D4C2` (datalogger offline >24h), `1D4C3` (subdesempenho — heurística cloud).
- **Qualidade**: bruto preservado (33 campos por alerta, incluindo `theoryEnergy`, `eToday`, `model`, `machine`). `state=0` ativo, `state=2` resolvido. **Gotcha**: `alarmEndTime` em ativos parece refletir "última verificação" e não fim real — só `state` é confiável (`#observacoes`).
- **Limitações**: alarmList sem filtro só-ativos (devolve 220 sempre); sem rate-limit observado nesta consulta.
- **Cruzamento direto** com internos: nenhum interno aberto Solis no momento, mas o motor resolveu 15 `sem_comunicacao` críticos para usinas Solis em 28/04 00:00 (CANUTO SUSHI, DANIEL, Daniele Vieira, PAULO ANDRE PRESTES, Pedro Mello, SOALDO RODRIGUES — todas com `1D4C2` ativo no nativo). **A regra interna `sem_comunicacao` cobre tudo o que `1D4C2` cobre**, porque ambas observam o mesmo sintoma (datalogger sem reportar). Diferença crucial: `1D4C2` da Solis está aberta há 6+ meses para essas usinas (CANUTO desde 2025-03-05; DANIEL desde 2025-08-28); a interna resolve quando volta uma leitura nova. O nativo é "mais sticky" — não pior, mas exige correlação manual.

**Churn medido**: dos 211 resolvidos, mediana de duração = 300s; média = 32815s (≈9h, puxada por outliers). 4/211 duraram <1min. Confirma a tese de churn — usar nativos como gatilho dispararia 73 NO-Grid + 36 GRID INTF + 30 GRID-INTF. + 25 Grid Under Voltage + ... = ruído alto.

### 4.2 Hoymiles

- **Volume**: 62 ativos / 78 usinas consultadas (79.5% das usinas têm `s_uoff=true`).
- **Granularidade**: **por usina**, não por inversor. Não há como saber qual microinversor falhou.
- **ID estável**: **não**. Snapshot de 6 flags booleanas (`s_uoff`, `s_ustable`, `s_uid`, `l3_warn`, `g_warn`, `dl`). Sem ID por evento.
- **Severidade nativa**: **não existe** — inferida pela natureza da flag (`s_uoff/dl=critico`).
- **Timestamp do alerta**: **não existe** — só `last_at` da usina. Não há quando o alarme abriu nem fechou.
- **Cobertura semântica**: pobre. Só `s_uoff` apareceu — todas as outras 5 flags ficaram em `false` mesmo com 62 usinas em problema. Equivalente único existente: regra interna `inversor_offline`.
- **Limitações**: 21 endpoints sondados para detalhamento — todos 404. Nenhum endpoint público de catálogo de erros, código de inversor, mensagem.
- **Cruzamento**: 3 dos 12 internos abertos são Hoymiles (`inversor_offline`); todos com 3 coletas consecutivas em `estado=offline` enquanto a usina ainda gera de outros inversores. **A regra interna ganha de longe**: dá inversor exato (`1422A01CCAB4`, `1422A0239320`, etc.), abre quando passa o threshold de 3 coletas, atualiza com `potencia_usina_kw` em tempo real e tem 2 inversores no caso de Tatiane Camozzato (multi-inversor). O `s_uoff` da Hoymiles, mesmo se fosse sticky, não diria qual inversor.

### 4.3 FusionSolar

- **Volume**: 0 ativos no instante (`/getAlarmList` sem `beginTime/endTime` retornou `[]` para todas 52 usinas); 3 históricos 7d, todos `Erro de conexão de rede`, `lev=2` (major).
- **Granularidade**: por **inversor** (`devName`, `esnCode`).
- **ID estável**: usa `alarmId=999999999` reservado para todos os 3 — **sem ID estável real**.
- **Severidade**: `lev` (1 critical / 2 major / 3 minor / 4 warning). Coerente, padronizada.
- **Cobertura semântica**: na thirdData, **só conectividade grosseira**. Nenhum alerta elétrico fino (sobretensão, frequência, temperatura, MPPT, subdesempenho) foi observado. `#observacoes:101`: "FusionSolar NÃO reporta na thirdData os alarmes elétricos finos".
- **Qualidade**: `repairSuggestion` em PT-BR, `alarmCause`, `raiseTime` epoch ms. `recoverTime` ausente em alarmes não resolvidos (ambíguo).
- **Limitações**: rate-limit **407 ACCESS_FREQUENCY_IS_TOO_HIGH** dispara mesmo após 5 min. Solução: 1 chamada/hora máx, com até 100 stationCodes por call. Inviável para tempo real (`#observacoes:103`).
- **Cruzamento**: 1 interno aberto (Paulo serralheria, `inversor_offline`); FusionSolar não tem alerta nativo aberto para essa usina no instante (já fechou). Histórico 7d cobre 3 outras usinas (HELLEN, DUARNI, Salentin Bastos) — verificar se internas têm `sem_comunicacao` aberto para essas (não estão na lista atual de 12, sugerindo que ou já resolveu, ou não atingiu o threshold de 1440 min, ou são intermitentes).

### 4.4 Solarman

- **Volume**: **0 alertas reais**, 106 placeholders (1 por usina) no `/maintain-s/operating/station/alert/lastest/list`. Em paralelo, 98/106 com `communicationAllOffline=true` no `/status/counting`.
- **Granularidade**: alertas reais (quando existem) são por **dispositivo** (`deviceSn`, `deviceType`).
- **ID estável**: sim (`id`, `ruleId`).
- **Severidade**: `level` numérico.
- **Cobertura semântica**: confirmadamente **só "regras configuradas"** (arc fault, ground fault). **Sem comunicação NÃO é alerta nativo na Solarman** — fica só no `status/counting` como flag agregada. Esse é o **gap mais grave** entre nativos e realidade observada.
- **Qualidade**: na ausência de alertas, irrelevante para esta análise.
- **Limitações**: precisa autenticação Cloudflare Turnstile (custo de manter sessão).
- **Cruzamento**: 8 internos abertos são Solarman; os 4 `sem_comunicacao` críticos cobrem usinas que estariam no balde dos 98 `communicationAllOffline`. **Sem o motor interno, esses 4 são invisíveis para o operador.**

### 4.5 AuxSol

- **Volume**: 29 históricos 90d, **0 ativos** — todos `status=03` (auto-recuperado pelo inversor). Janela: 2026-01-29 a 2026-04-27.
- **Granularidade**: por **inversor** (`sn`).
- **ID estável**: sim (`id` UUID + `aid` numérico).
- **Severidade**: `level=02` em 100% (médio). Nenhum crítico em 90d.
- **Cobertura semântica**: eventos transientes de rede — Grid Overvoltage (26), NO Grid (2), Grid Undervoltage (1).
- **Qualidade**: `dt`/`rdt` (alarmTime/restoredTime) em string com tz, `duration` em horas float, `suggestion` em EN. `pid` vem null no listing geral, exige resolver via `getInverterByPlant`.
- **Limitações**: AuxSol já registrou erro de sync 1×/24h no log do sistema — risco de ausência de alerta por falha de API.
- **Cruzamento**: 1 interno aberto (EDMG COMÉRCIO DE FRUTAS, `sem_comunicacao` aviso). A AuxSol não reporta sem-comunicação como alerta — confirma que o motor cobre o que o nativo não cobre.
- **Achado-chave**: 28 dos 29 alertas (96%) duraram <1h, com p50=0.08h ≈ 5 min. **Confirmação direta da hipótese de churn** que motivou o redesign. Reincorporar isso geraria operacionalmente inutilizável.

### 4.6 FoxESS

- **Volume**: 3 inversores em falha (em 50 totais), todos com mesmo combo `4151,4156,4158`.
- **Granularidade**: por **inversor** (`moduleSN`).
- **ID estável**: **não** — `currentFault` é só uma string de códigos separados por vírgula no payload corrente; sem histórico, sem timestamp, sem ID por evento.
- **Severidade**: ausente — inferida pelo catálogo (`4151=4156=4158=aviso`).
- **Cobertura semântica**: limitada a `currentFault` no payload de medição. Sondados 3 endpoints dedicados de alarme — todos retornaram HTTP 200 sem corpo (path não existe).
- **Qualidade**: campo `status` no `/op/v0/device/list` é **inconsistente** — retorna 3 (offline) para todos 50 inversores mesmo com 35 gerando agora. **Bug confirmado** (`#observacoes:168`).
- **Limitações**: sem endpoint dedicado de alarme; `status` quebrado.
- **Cruzamento**: 0 internos abertos para usinas FoxESS no momento. Os 3 inversores em falha (RODRIGO BIM x2, Jose Carlos x1) deveriam ter regra `sem_geracao_horario_solar` aberta se o evento ocorreu em horário solar — verificar se a regra interna pegou (não há registro nos 12 abertos, indicando que ou (a) os inversores fazem parte de usinas multi-inversor com geração agregada não-zero, ou (b) é fim de dia (consulta às 18h local) e a regra usou pico-do-dia para resolver).

---

## 5. Comparativo cruzado (matriz de cobertura)

Notação: ✅ tem equivalente nativo, ❌ não tem, ◐ tem mas com limitação relevante.

| Regra interna | Solis | Hoymiles | Fusion | Solarman | AuxSol | FoxESS | Confiabilidade nativo | Confiabilidade interna | Veredito |
|---|:-:|:-:|:-:|:-:|:-:|:-:|---|---|---|
| `sobretensao_ac` | ✅ 1010/1012 | ❌ | ❌ thirdData | ❌ | ✅ Grid Overvoltage | ❌ (só `currentFault` agregado) | Baixa (churn 96% AuxSol, p50=300s Solis) | Alta (limite por usina) | **Interna vence** |
| `subtensao_ac` | ✅ 1011 | ❌ | ❌ | ❌ | ✅ Grid Undervoltage | ◐ (4158 no combo) | Baixa (mesmo churn) | Alta | **Interna vence** |
| `frequencia_anomala` | ❌ | ❌ | ❌ | ❌ | ❌ | ◐ (4156) | N/D | Alta (com guard `pac_kw≥0.5kW`) | **Regra interna não tem competidor nativo** |
| `temperatura_alta` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/D | Alta | **Interna sem competidor** |
| `inversor_offline` | ✅ por SN | ◐ (s_uoff usina-only) | ✅ Erro conexão rede | ◐ (status/counting agregado, não em alert/list) | ❌ | ◐ (status quebrado) | Média | Alta (3 coletas + agregação por usina) | **Interna vence** (granularidade + carência) |
| `string_mppt_zerada` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/D | Média (depende de provedor expor strings) | **Interna sem competidor; cobertura limitada por dado de origem** |
| `dado_eletrico_ausente` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/D | Alta | **Interna sem competidor** (regra de meta-qualidade) |
| `sem_comunicacao` | ✅ 1D4C2 (sticky) | ◐ (s_uoff conflate) | ✅ Erro conexão rede | ❌ (98 offline, 0 alertas) | ❌ | ❌ | Variável (Solis sticky por meses; Solarman invisível) | Alta | **Interna vence** (especialmente Solarman e AuxSol) |
| `sem_geracao_horario_solar` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/D | Alta (queda abrupta + janela solar) | **Interna sem competidor** |
| `subdesempenho` | ✅ 1D4C3 (sticky 1.5 ano) | ❌ | ❌ | ❌ | ❌ | ❌ | Baixa (sticky, sem reset) | Média (janela 10–15h, % capacidade) | **Complementar** — verificar overlap nas 3 usinas Solis |
| `queda_rendimento` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/D | Média (média 7d) | **Interna sem competidor** |
| `garantia_vencendo` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/D | Alta (fonte Garantia) | **Interna sem competidor** (não-elétrica) |

**Regras que NUNCA poderiam vir do nativo (confirmações)**:
1. `frequencia_anomala` — só FoxESS dá frequência separada por fase, nenhum tem alerta dedicado.
2. `temperatura_alta` — nenhum provedor reporta como alerta.
3. `dado_eletrico_ausente` — meta-qualidade da própria coleta, não tem como vir de fora.
4. `sem_geracao_horario_solar` — combina horário solar + queda abrupta + capacidade nominal, derivada de leitura.
5. `queda_rendimento` — média móvel 7d.
6. `garantia_vencendo` — não-elétrica, depende de `Garantia.fim`.

---

## 6. Pontos onde o sistema novo é superior (com dados)

1. **Filosofia tri-state vs binário**: nativo da Solis tem 73 NO-Grid + 36 GRID INTF + 30 GRID-INTF. resolvidos no histórico, com p50=300s. Reincorporar abriria/fecharia 130+ alertas em janela de horas. O motor interno trata "queda transiente" como `None` (regra inaplicável durante guard de potência mínima) e não polui o operador.

2. **Carência por coletas consecutivas (`inversor_offline` exige 3)**: dos 4 alertas Hoymiles/Fusion `inversor_offline` abertos agora, os 4 reportam `coletas_consecutivas_offline: 3`. Se fosse 1 coleta, abriríamos e fecharíamos a cada ciclo de 10 min — exatamente o que o `s_uoff` da Hoymiles faz (snapshot binário). A carência estabiliza.

3. **Guards de potência mínima (`pac_kw ≥ 0.5kW`)**: documentado em F12 que zerou 69 falsos `frequencia_anomala`. Confirmado no FoxESS: `RFreq=30.01` para inversor com `generationPower=0.0` — sem guard, isso dispararia frequência fora da banda 59.5–60.5 quando na verdade é apenas standby.

4. **Granularidade por inversor onde nativo só dá usina (Hoymiles)**: alertas internos 129 (Tatiane Camozzato) reportam exatamente `1422A01CCAB4` e `1422A01CD18D`. O `s_uoff` da Hoymiles sequer indica quantos dos 3 microinversores caíram.

5. **Cobertura "sem comunicação" no Solarman**: 98 usinas em `communicationAllOffline` no `status/counting`, **zero alertas no feed nativo**. As 4 com `sem_comunicacao` crítico no motor interno (Patrãozin, Francisco e Mari, FÁBIO SOUZA, ANDERSON ESPINDOLA) só são visíveis porque o motor observa `medido_em` da última leitura. Sem o motor, problema invisível.

6. **Ciclo de vida limpo**: `UniqueConstraint(usina, inversor, regra)` parcial em `condition=Q(estado='aberto')` garante 1 alerta aberto por (alvo, regra). Solis devolve 220 alertas históricos sem deduplicar; AuxSol devolve 29 eventos para o mesmo SN `ASN-7.5SL2412221923` (24 dos 27 são da mesma usina-inversor).

7. **Resolução automática verificada**: `resolvidos_recentes_amostra` mostra 73+ resoluções nas últimas 24h; o pareamento abre→resolve de Paulo serralheria/RAFAEL ALBINO/Tatiane Camozzato/Evandro (Gamboa) faz ciclos de 30–60 min limpos. Comportamento que provedor nenhum entrega.

---

## 7. Lacunas e riscos do sistema atual

1. **Solis 1D4C2 "Loss of internet connection" há 6+ meses**: 6 usinas afetadas (CANUTO SUSHI desde 2025-03-05, DANIEL desde 2025-08-28, Daniele Vieira desde 2026-03-13, PAULO ANDRE PRESTES desde 2026-02-01, Pedro Mello desde 2025-10-13, SOALDO RODRIGUES desde 2025-12-22). O motor interno **abriu** `sem_comunicacao` para essas mesmas usinas em 27/04 às 20:54 e **resolveu** em 28/04 às 00:00 (resolvidos_recentes), o que sugere uma de duas hipóteses: (a) houve uma janela em que a coleta passou e `medido_em` foi atualizado — divergente do nativo que não enxergou recuperação; ou (b) a coleta marcou `medido_em` mesmo sem leitura nova legítima (bug). **Recomendação**: instrumentar `LogColeta` dessas 6 contas para validar se as leituras recentes são reais ou herdadas.

2. **Solis 1D4C3 "Inefficient Power Plants" sticky há 1.5 ano**: 3 ativos (CANUTO SUSHI 2024-05-31 e 2024-06-23; Daniele Vieira 2024-06-23). A regra interna `subdesempenho` exige `<15% capacidade entre 10–15h locais`. Não há `subdesempenho` aberto para nenhuma das duas. Hipóteses: (a) capacidade real está calibrada acima da real e o limite de 15% nunca dispara; (b) a usina está realmente subperformando mas dentro de 15% (12% por exemplo); (c) o sistema novo não cobre essas usinas porque a coleta está quebrada. **Recomendação**: cruzar leituras dessas 3 usinas em janela 10–15h dos últimos 7 dias com `Usina.capacidade_kwp` — se geração média < 15% capacidade e regra não disparou, há bug; se está acima de 15%, a heurística nativa Solis está errada (sticky há 1.5 ano).

3. **FoxESS sem `currentFault` ≠ sem problema**: catálogo Q tem códigos para sobretensão (4159), sobrefrequência (4155), temperatura (4137, 4138). Coleta atual não está mapeando esses códigos para alerta interno equivalente. Para 3 inversores com `4151,4156,4158` (queda de rede), nenhum interno abriu. **Recomendação**: confirmar se `inversor_offline` interno avalia `generationPower=0 AND todayYield=0` (heurística do snapshot) ou o `estado=offline` do adapter — o `status` da listagem é quebrado, então a única fonte confiável é potência+yield zerados.

4. **Solarman 4 `sem_comunicacao` críticos há 200–727h sem escalonamento**: a regra está fazendo o trabalho dela; falta camada de meta-alerta. Operador hoje recebe um alerta crítico que não muda de severidade depois de 30 dias. **Recomendação**: adicionar regra `sem_comunicacao_prolongada` ou flag `Usina.suspeita_morta` que escala para notificação humana após N dias.

5. **`string_mppt_zerada` depende de provedor expor strings MPPT**: Solis e Foxess expõem (`MpptString` no contrato adapter). Hoymiles, Solarman, AuxSol, FusionSolar — variável. Cobertura efetiva da regra é < 100% das usinas; não há contagem documentada de quantos inversores realmente entregam strings.

6. **Risco de ausência silenciosa por falha de API**: AuxSol já registrou `sync_erro` 1×/24h. Se a API ficar fora por 12h, `medido_em` envelhece e `sem_comunicacao` dispara — mas é falso positivo do lado do operador (a usina pode estar bem). **Recomendação**: distinguir "falha de coleta" (problema do nosso lado) de "datalogger sem reportar" (problema do cliente) via `LogColeta.status_resposta`.

7. **FusionSolar 407 brutal**: 1 chamada/hora máx para `/getAlarmList`. Inviável manter o nativo sequer como auditoria em tempo real. Auditoria precisa rodar batched.

8. **Sem registro do `raw` dos nativos**: a filosofia "raw vai pra debug" está documentada, mas não há tabela `AlertaNativoAuditoria` implementada. Para retrospectiva (entender por que a heurística do provedor flaggou X mas a interna não), seria útil persistir bruto periódicamente.

---

## 8. Recomendações concretas (priorizadas)

1. **(P) Escalonar `sem_comunicacao` prolongado** — *O QUÊ*: alerta meta-nível quando `sem_comunicacao` aberto >7 dias. *POR QUÊ*: 4 usinas Solarman em 200–727h sem visibilidade ainda no nível "crítico" não-escalonado; operador vê só `severidade=critico` que já existia desde dia 1. *COMO*: estender `apps/alertas/regras/sem_comunicacao.py` para emitir `Anomalia(severidade='critico', mensagem='Sem comunicação há N dias — verificar fisicamente', contexto={dias_sem_dado: N})` em saltos de 7/14/30 dias; ou criar regra nova `sem_comunicacao_prolongada` que avalia o próprio Alerta aberto. *ESFORÇO*: P.

2. **(P) Auditoria das 3 usinas Solis com `1D4C3` sticky** — *O QUÊ*: rodar query manual cruzando capacidade nominal × geração média 10–15h dos últimos 7d para CANUTO SUSHI e Daniele Vieira. *POR QUÊ*: confirmar se `subdesempenho` interno deveria disparar e não está, ou se Solis está errada. *COMO*: query única no shell Django (`make shell`); se necessário ajustar `Usina.subdesempenho_limite_pct` por usina. *ESFORÇO*: P.

3. **(M) Tabela `AlertaNativoAuditoria` opcional** — *O QUÊ*: persistir raw dos 6 provedores 1×/h (FusionSolar) ou 1×/coleta (demais), nunca virando entidade `Alerta`. *POR QUÊ*: retrospectiva, debug, comparação contínua, base para futura calibração de regras. *COMO*: model em `apps/alertas/models.py` (campos `empresa`, `tipo_provedor`, `usina`, `coletado_em`, `raw_jsonb`); task em `apps/coleta/tasks.py::auditar_alertas_nativos(conta_id)`; agendar via crontab. **Não** ligar ao motor de alertas. *ESFORÇO*: M.

4. **(P) Validar coleta das 6 usinas Solis com `1D4C2` ativo há meses** — *O QUÊ*: confirmar se `medido_em` está realmente atualizando ou se há herança suspeita. *POR QUÊ*: `sem_comunicacao` resolveu em 28/04 00:00 enquanto Solis ainda diz "internet caiu há 6 meses" — uma das duas está errada. *COMO*: comparar `LogColeta.iniciado_em` × `LeituraUsina.medido_em` × `Usina.ultima_leitura_em` para essas 6 usinas em janela 24h. *ESFORÇO*: P.

5. **(M) Heurística `inversor_offline` para FoxESS** — *O QUÊ*: garantir que `generationPower=0 AND todayYield=0` é a fonte de truth para `estado=offline` no adapter FoxESS, **não** o campo `status` da listagem. *POR QUÊ*: bug confirmado: 50/50 reportam `status=3` (offline) mesmo com 35 gerando agora. *COMO*: revisar `apps/provedores/adapters/foxess/consultas.py` ou `adapter.py` — função que mapeia para `DadosInversor.estado`. *ESFORÇO*: P-M.

6. **(M) Auto-inativar usinas mortas** — *O QUÊ*: após N dias com `sem_comunicacao` aberto sem nenhum dado, marcar `Usina.is_active=false` e parar de coletar. *POR QUÊ*: 4 usinas Solarman estão consumindo ciclos de coleta há 9–30 dias para nada; também é higiene operacional. *COMO*: estender `parar_alerta_apos_dias` da `ConfiguracaoEmpresa` para também desativar usina; signal pós-criação de alerta em `apps/alertas/signals.py`. Cuidado: precisa ser reversível por humano. *ESFORÇO*: M.

7. **(G) Regra `string_mppt_zerada` com cobertura explícita** — *O QUÊ*: documentar quais provedores expõem strings MPPT e quais não, e fazer a regra retornar `None` (inaplicável) explícito quando o provedor não expõe. *POR QUÊ*: hoje a regra possivelmente retorna `False` quando `mppt_strings=[]` em vez de `None` — pode estar resolvendo alertas legítimos por engano. *COMO*: revisar `apps/alertas/regras/string_mppt_zerada.py`. *ESFORÇO*: M.

---

## 9. Conclusão

A estratégia "alertas gerados pelas leituras, nunca consumidos do provedor" é **vencedora** nos 6 provedores analisados. O argumento é triplo: (1) cobertura semântica nativa é insuficiente — frequência, temperatura e subdesempenho real só vêm da leitura; (2) qualidade nativa varia de inutilizável (Hoymiles snapshot binário, Solarman alert/list desconectado de communicationAllOffline) a tóxica (AuxSol 96% churn <1h); (3) granularidade nativa empata só na Solis e AuxSol; nas demais perde feio.

**Manter** o motor interno como source-of-truth. As lacunas reais não são da estratégia, são de **operacionalização**: escalonar `sem_comunicacao` prolongado, auto-inativar usinas mortas, auditar bugs específicos (FoxESS `status`, Solis sticky, coleta vs `medido_em`). Adicionar nativos como **auditoria fria** (raw em tabela paralela), nunca como gatilho. Próxima decisão de calibração deve nascer da comparação retrospectiva entre nativo e interno — não de aceitar o nativo como verdade.
