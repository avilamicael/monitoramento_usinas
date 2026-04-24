# Análise dos dados reais coletados na VPS

> Captura do banco da VPS (2026-04-24) — base para desenhar o schema unificado e as regras de alerta do sistema novo.

## 1. Volume real (o doc antigo estava desatualizado)

| Provedor | Usinas | Inversores | Intervalo coleta |
|---|---|---|---|
| solarman | 105 | 273 | 60 min |
| hoymiles | 79 | 259 | 60 min |
| fusionsolar | 52 | 60 | 60 min |
| foxess | 14 | 50 | 30 min |
| solis | 12 | 12 | 60 min |
| auxsol | 5 | 5 | 60 min |
| **Total** | **267** | **659** | |

## 2. Disponibilidade real de dados por provedor

### Nível usina (`SnapshotUsina`)

| Campo normalizado | auxsol | solarman | hoymiles | solis | fusionsolar | foxess |
|---|---|---|---|---|---|---|
| potencia_kw | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| energia_hoje_kwh | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| energia_mes_kwh | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| energia_total_kwh | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| capacidade_kwp | ✓ | ✓ | ✓ | ✓ | ⚠️ bugado (0.00805) | ✓ |
| latitude/longitude | ✓ | ✗ | ✗ | ✗ | ✓ (no inversor) | ✗ |
| endereço | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| último contato | ✓ `dt` | ✓ `lastUpdateTime` | ✓ `last_data_time` | ✓ `dataTimestamp` | ✗ | ✗ |
| qtd_inversores | ✗ 0/0 | ✗ 0/0 | ✗ 0/0 | ✓ 1/0 | ✗ 0/0 | ✓ 4/4 |

### Nível inversor (`SnapshotInversor`)

| Campo elétrico | auxsol | solarman | hoymiles | solis | fusionsolar | foxess |
|---|---|---|---|---|---|---|
| pac_kw | ✓ 1.48 | **✗ 0.0** | ✓ 0.78 | ✓ 6.96 | **✗ 0.0** | ✓ 1.71 |
| tensao_ac_v | ✓ 217.9 | ✗ | ✓ 221.0 | ✓ 230.4 | ✗ | ✓ 219.3 |
| corrente_ac_a | ✓ 7.1 | ✗ | ✗ | ✓ 29.7 | ✗ | ✓ 7.8 |
| tensao_dc_v | ✓ 288 | ✗ | ✓ 38.9 | ✓ 164.2 | ✗ | ✓ 39.3 |
| corrente_dc_a | ✓ 2.33 | ✗ | ✓ 20.12 | ✓ 9.3 | ✗ | ✓ 11.4 |
| frequencia_hz | ✓ 59.98 | ✗ | ✓ 60.01 | ✓ 59.98 | ✗ | ✓ 60.03 |
| temperatura_c | ✓ 54.3 | ✗ | ✓ 43.2 | ✓ 64.6 | ✗ | ✓ 48.0 |
| strings_mppt | ✓ 2 strings | ✗ `{}` | ✓ 4 ports | ✓ 32 strings¹ | ✗ `{}` | ✓ 4 strings |
| soc_bateria | ✗ | ✗ | ✗ | ✓ (quando tem) | ✗ | ✗ |
| nº série / modelo | ✓/✓ | ✓/✗ | ✓/✓ | ✓/✓ | ✓/✓ | ✓/✓ |

¹ Solis: 32 slots mas só 2 costumam estar populados; o resto vem `0.0`.

**Provedores "completos" (todos dados elétricos)**: Auxsol, Hoymiles (menos corrente AC/freq/temp ausentes em alguns), Solis, Foxess.
**Provedores "mutilados"**: Solarman (273 inversores sem **nenhum** dado elétrico), FusionSolar (60 inversores só com metadata e `_kpi` todo null).

⚠️ Solarman e FusionSolar **provavelmente têm endpoints realtime separados que o sistema antigo não usa**. Vale investigar antes de tratá-los como limitados.

## 3. Unidades e status — caos entre provedores

- **Potência**: Hoymiles em W (5176.7), Solis oscila kW/W (`power` vs `power1`), Fusion em kW, Foxess em kW. **Todo adapter precisa converter pra kW antes de devolver.**
- **Status de usina**: auxsol `"01"`, solarman `"NORMAL"`, hoymiles `40`, solis `2`, fusion `3`, foxess `3`. Enum unificado obrigatório.

## 4. Alertas — por que o sistema atual não funciona

### Distribuição atual (total histórico)

| Origem | Nível | Estado | N |
|---|---|---|---|
| interno | importante | resolvido | 108 |
| interno | aviso | resolvido | 47 |
| provedor | aviso | resolvido | 42 |
| provedor | crítico | resolvido | 36 |
| interno | importante | **ativo** | 29 |
| interno | aviso | **ativo** | 14 |
| provedor | aviso | **ativo** | 7 |
| provedor | crítico | **ativo** | 1 |

### Churn dos últimos 7 dias

| Provedor | Resolvidos | Fechou em <1h | % |
|---|---|---|---|
| **solis** | 13 | 6 | **46.2%** 🔴 |
| foxess | 11 | 2 | 18.2% |
| fusionsolar | 22 | 2 | 9.1% |
| hoymiles | 70 | 7 | 10.0% |
| solarman | 16 | 0 | 0% |
| auxsol | 1 | 0 | 0% |
| **Geral** | 133 | 17 | **12.8%** |

15 alertas fecharam em menos de **30 minutos** — quase certeza de falso positivo (abriu numa coleta, fechou na seguinte, durou <1 ciclo).

### Top 30 tipos de alerta

- **198 alertas sem `catalogo_alarme`** (registro interno sem tipo mapeado — 43 ainda ativos). Provavelmente `sem_comunicacao` e variantes.
- Hoymiles concentra os alarmes de provedor: 32 `l3_warn` (isolamento L3), 32 `s_uoff` (sistema desligado), 8 `g_warn` (rede elétrica) — **são flags reinterpretadas pelo adapter, não alertas nativos úteis**.
- **108 alertas nível "importante" resolvidos sozinhos** — a calibração de severidade está errada: importante deveria persistir.

**Conclusão**: sua tese está certa. O caminho não é "melhorar o uso dos alertas do provedor" — é **ignorar** os alarmes nativos e gerar tudo a partir das leituras.

## 5. Coletas funcionando bem (auditoria)

Todas as 6 credenciais estão rodando sem erro (`status=sucesso` nas últimas 5 coletas de cada). Duração:
- auxsol: ~4.5s | solis: ~17s | hoymiles: ~27s | fusionsolar: ~24s | solarman: ~42s | foxess: ~65s

Foxess é o mais lento (65s/ciclo, 30min intervalo) — vale revisar paralelização ou cache do adapter.

## 6. Campos "bons" presentes em (quase) todos — base do schema unificado

**Usina, obrigatórios**: `id_externo`, `nome`, `capacidade_kwp`, `potencia_atual_kw`, `energia_hoje_kwh`, `energia_total_kwh`, `status_normalizado`, `medido_em`.

**Usina, opcionais**: `energia_mes_kwh` (falta em foxess), `latitude`, `longitude`, `endereco`, `fuso_horario`, `qtd_inversores`, `qtd_inversores_online`.

**Inversor, obrigatórios**: `numero_serie`, `modelo` (pode ser vazio), `estado`, `pac_kw`, `energia_hoje_kwh`, `energia_total_kwh`, `medido_em`.

**Inversor, opcionais (null quando provedor não expõe)**: `tensao_ac_v`, `corrente_ac_a`, `tensao_dc_v`, `corrente_dc_a`, `frequencia_hz`, `temperatura_c`, `soc_bateria`, `strings_mppt`.

**Strings MPPT — formato unificado sugerido**:
```json
[
  {"indice": 1, "tensao_v": 39.0, "corrente_a": 6.73, "potencia_w": 262.9},
  {"indice": 2, "tensao_v": 39.0, "corrente_a": 6.66, "potencia_w": 259.7}
]
```
Cada adapter traduz seu formato original (dict numerado, lista, chaves diferentes) pra essa lista uniforme. Strings com todos os valores zero são omitidas (solis não expande os 30 slots vazios).

## 7. Próximo passo: regras de alerta internas (derivadas de leituras)

| # | Nome | Condição | Severidade | Pré-requisito |
|---|---|---|---|---|
| 1 | `sem_comunicacao` | `agora - medido_em > X min` | aviso → crítico em 2x | nenhum |
| 2 | `sem_geracao_horario_solar` | `potencia_kw ≈ 0` entre (nascer+1h) e (pôr−1h) por ≥2 coletas | **crítico** | lat/lng |
| 3 | `subdesempenho` | `potencia / capacidade < 30%` por N ciclos em horário pleno (10h-15h) | aviso | lat/lng, capacidade |
| 4 | `inversor_offline` | `estado==offline` durante horário solar com usina ativa | aviso | — |
| 5 | `sobretensao_ac` | `tensao_ac_v > limite_usina` (default 240 V) | crítico | `tensao_ac_v` |
| 6 | `subtensao_ac` | `tensao_ac_v < 200 V` | aviso | `tensao_ac_v` |
| 7 | `frequencia_anomala` | `freq < 59.5` ou `freq > 60.5` | aviso | `frequencia_hz` |
| 8 | `temperatura_alta` | `temperatura_c > 70 °C` | aviso | `temperatura_c` |
| 9 | `string_mppt_zerada` | uma string tem 0 W enquanto outras geram >500 W, durante ≥2 ciclos | aviso | `strings_mppt` |
| 10 | `queda_rendimento` | produção diária < 60% da média móvel 7 dias (ajustado por clima, se disponível) | aviso | histórico |
| 11 | `garantia_vencendo` | `dias_restantes ≤ config.aviso_previo` | info → aviso | — |

**Ciclo de vida**: cada regra roda a cada coleta. Abre `Alerta` quando condição vira verdadeira + persiste por N ciclos. Fecha automaticamente quando condição volta a falso por M ciclos (anti-flicker). Sem dependência de flag de provedor.

**Histerese anti-falso-positivo**: toda regra tem "N ciclos para abrir" e "M ciclos para fechar" configuráveis. Evita o problema Solis de 46% de churn.

**Ausência de dado ≠ ok**: se o campo está `null`, a regra **não avalia** — não assume "sem problema". Isso previne falso negativo em Solarman/Fusion (dados elétricos ausentes) e falso positivo (não abre alerta por dado que não temos).
