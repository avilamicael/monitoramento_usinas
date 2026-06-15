# Feature Landscape

**Domain:** Monitoramento solar fotovoltaico SaaS multi-tenant para integradoras/empresas de O&M (mercado BR)
**Researched:** 2026-05-12
**Confidence overall:** MEDIUM-HIGH (ecossistema bem documentado; especificidades BR levantadas via Canal Solar, SolarView, SolarMarket)

---

## Resumo executivo

Produtos maduros de monitoramento solar pra integradora em 2026 já convergiram em um conjunto **core de "table stakes"** bem definido — dashboard de frota, alertas configuráveis, relatório mensal pro cliente, app mobile pelo operador. O que diferencia hoje é:

1. **Multi-marca de verdade** (SurgePV, SolarView, Solytic) — agregar SolarEdge + Enphase + Solis + Huawei numa só visão é o maior valor real, eliminando 2-3h/semana de troca de apps.
2. **Pós-venda como receita** (SolarView, Sunvoy) — relatório branded vai pro cliente final, integradora cobra por isso. **É a tese central do produto BR**.
3. **App white-label pro cliente final** (Sunvoy, mySolarEdge derivados) — substitui o app do fabricante com a marca da integradora.
4. **Performance Ratio com irradiância real** (IEC 61724-1) — comparar com expectativa, não só "kWh hoje".
5. **AI/ML pra anomalia** (Raycatch DeepSolar, Solytic) — diferenciador alto mas custo elevado.

O produto monitoramento_usinas tem o **motor de alertas custom** como vantagem técnica concreta (12.8% → ~0% de churn <1h já demonstrado), mas precisa preencher rapidamente: **notificações reais (M2)**, **relatório PDF mensal**, **performance vs expectativa**. App mobile e portal do cliente final são alavancas grandes pro mercado BR onde "monetizar pós-venda" é o discurso vencedor de plataformas como SolarView.

Anti-features fortes: auto-remediação (já decidido), comerciais (proposta/CRM de vendas — outro produto), consumo de alarmes nativos (já decidido), bilhete de luz / cálculo de ROI inicial (outro produto).

---

## Table Stakes

Features que **operador de integradora espera** em 2026. Sem essas o produto parece incompleto frente a SolarView/Solarman/SolisCloud.

### Dashboard & visualização

| Feature | Por que esperado | Complexidade | Notas |
|---------|------------------|--------------|-------|
| Dashboard de frota (todas as usinas em um mapa) | Padrão SolarEdge Go, SolarView, Solytic. "Fleet overview" é primeira tela esperada. | Baixa | **Já existe** parcialmente (mapa em `/usinas`). Falta cor por estado consolidado. |
| Lista de usinas com filtros (status, capacidade, provedor, cidade) | Operador filtra "só problemas hoje" 20×/dia | Baixa | **Já existe**. Falta filtro composto persistente. |
| Detalhe da usina (gráfico potência/dia, energia/mês, energia/ano) | Mínimo absoluto | Baixa | **Já existe** (DashboardPage da usina). |
| Detalhe do inversor (potência, tensão CA, frequência, temperatura, strings MPPT) | Operador tem que conseguir clicar e ver o inversor problemático | Baixa | **Já existe** em `/inversores/:id`. |
| Histórico de leituras (download CSV/Excel) | Cliente final às vezes pede; operador precisa pra auditoria | Baixa | **Falta**. Backend tem `LeituraUsina` append-only; falta endpoint de export. |
| Heatmap mensal de geração | Padrão SolarView, SolisCloud — "comparar com mês anterior" | Média | **Falta**. |
| Comparação entre usinas (ranking por kWh/kWp) | Identificar usinas piores que a média da frota | Média | **Falta**. Útil pra detectar problemas crônicos. |

### Alertas & motor

| Feature | Por que esperado | Complexidade | Notas |
|---------|------------------|--------------|-------|
| Alertas com severidade + estado aberto/resolvido | Universal. Todas as plataformas têm. | Baixa | **Já existe**. 12 regras + tri-state, validado contra produção. |
| Regras configuráveis por empresa (ativar/desativar, severidade) | Cada integradora tem perfil diferente de rede/cliente | Baixa | **Já existe** (`/configuracao/regras`). |
| Override de threshold por usina/inversor | Usina BT em região com tensão alta crônica precisa subir o limite | Baixa | **Já existe** (cascata Inversor → Usina → Empresa). |
| Resolver/reconhecer alerta manualmente | Operador às vezes resolve no campo, sistema não detectou ainda | Baixa | **Já existe** (`POST /api/alertas/:id/resolver`). |
| Agrupamento de alertas (mesma usina, mesma janela) | 5 inversores com mesmo problema = 1 linha visual, não 5 | Média | **Falta** (HARD-12 do M1 toca isso). |
| Histórico do alerta (timeline: aberto → escalado → resolvido) | Auditoria; cliente final cobra "quando vocês souberam disso?" | Baixa | **Falta**. Hoje só `aberto_em` e `resolvido_em`. |
| Filtro de alertas por usina/severidade/regra/data | Triagem | Baixa | **Já existe** parcialmente. |

### Notificações (Milestone 2 next)

| Feature | Por que esperado | Complexidade | Notas |
|---------|------------------|--------------|-------|
| Email para operador | Universal absoluto | Baixa | **Backend é scaffold** (`RegraNotificacao`, `EntregaNotificacao` em models, sem worker real). UI promete; M2 implementa. |
| WhatsApp (texto simples, 1 alerta = 1 mensagem) | **Diferencial BR**: SolarMarket tem, SolarView tem. Operador BR vive no WhatsApp. | Média | **Falta**. Twilio ou Meta Business API. LGPD: opt-in explícito (consentimento granular). |
| Webhook (POST JSON pra URL configurável) | Integração com Slack, Discord, sistemas internos. Padrão SolarEdge, Enphase. | Baixa | **Já tem model** (`EndpointWebhook`). Falta executor. |
| Configuração granular: quais regras notificam, quais severidades, quem recebe | Spam de alerta info mata o canal | Média | **Falta**. Crítico — UI precisa ser boa. |
| Janela de silêncio (não notificar entre 22h e 6h, exceto crítico) | Operador não quer WhatsApp 3h da manhã pra info | Baixa | **Falta**. |
| Resumo diário (digest 8h: "5 alertas abertos, 2 críticos") | Substitui spam por relatório curto | Média | **Falta**. |
| Histórico de entregas (entregue / falhou / clicado) | Auditoria + debugging "por que ninguém respondeu?" | Baixa | **Já tem model** `EntregaNotificacao`. Falta UI. |

### Gestão de equipamentos e contas

| Feature | Por que esperado | Complexidade | Notas |
|---------|------------------|--------------|-------|
| CRUD de usinas (criar manual, editar, ativar/desativar monitoramento) | Universal | Baixa | **Já existe**. |
| CRUD de contas de provedor (credenciais encriptadas) | Universal | Baixa | **Já existe**. |
| Sincronização manual (botão "sincronizar agora") | Operador testa configuração nova | Baixa | **Já existe** (`POST /api/contas-provedor/:id/sincronizar`). |
| LogColeta com detalhe por ciclo (erro, contadores, duração) | Debugging "por que não atualizou?" | Baixa | **Já existe** (com bug cosmético dos contadores — HARD-08). |
| Garantia por usina (data fim, alerta antes de vencer) | Padrão BR — integradora vende garantia, precisa saber quando vence | Baixa | **Já existe** (`Garantia`, regra `garantia_vencendo`). |
| Gestão de usuários (admin + operacional) | Universal | Baixa | **Já existe** (`/usuarios`). |
| Multi-empresa por superadmin (cross-tenant) | Sysadmin do produto precisa | Baixa | **Já existe** (`/superadmin/*`). |

### Documentação ao usuário

| Feature | Por que esperado | Complexidade | Notas |
|---------|------------------|--------------|-------|
| `/docs` em PT-BR explicando regras e thresholds | Operador BR precisa entender por que disparou | Baixa | **Já existe**. Regra obrigatória de manutenção no CLAUDE.md. |

---

## Diferenciadores

Features que **distinguem do mercado** ou apoiam a tese "informar com confiança, sem ruído". Ordem aproximada de impacto pra próximos milestones.

### Confiabilidade dos alertas (já é o diferencial técnico — fortalecer)

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Calibração automática de thresholds por usina (aprende a faixa normal em 30d) | Reduz FP sem o operador ter que ajustar manualmente. **Avança a tese central**. | Alta | M3+. Análogo a Solytic "smart benchmarks". Precisa cuidado: começa com sugestão pro admin aprovar, não auto-aplicar. |
| Performance Ratio (PR) com irradiância real (NASA POWER / OpenMeteo / Solcast por lat/lon) | Comparar "potência real vs esperada hoje considerando o clima" é o padrão IEC 61724-1. Substitui `sem_geracao_horario_solar` por algo robusto. | Média-Alta | **HARD-11 do M1 já antecipa**. NASA POWER é grátis (resolução 0.5°×0.625° pra meteorologia, 1°×1° pra solar; latência 7 dias com FLASHFlux). Solcast é pago mas tem real-time. **Decisão importante**: usar NASA POWER (free, latência aceitável) ou Solcast (pago, real-time). |
| Janela astral por lat/lon (substituir horário solar fixo) | Reduz FP de `sem_geracao_horario_solar` em latitudes diferentes (PT-MG vs RS) | Baixa | **HARD-11 parcial**. Python `astral` lib resolve. |
| Detecção de queda de rendimento por degradação (vs vizinhas, vs ano passado) | Identifica sujeira/sombreamento crônico antes do cliente reclamar | Alta | M4+. Precisa ≥1 ano de histórico. |
| Predição de falha (ML em séries temporais) | Solytic faz, Raycatch faz. Mercado caminha pra isso. | Muito alta | M5+. Diferencial alto mas custo alto. **Caution**: muito risco de FP em ML mal calibrado — fere a tese central. Só faz se PR > 90% nos testes. |

### Relatórios e pós-venda (a tese da integradora BR)

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| **Relatório PDF mensal por usina, branded com logo da empresa** | **A maior alavanca comercial pro mercado BR**. SolarView vende a feature como "monetize pós-venda". Cliente final recebe email mensal "Sua usina gerou X kWh este mês". | Média | M3 forte candidato. Stack: WeasyPrint ou Playwright headless renderizando HTML do template. Inclui: produção mensal, comparação com mês anterior, economia estimada (sem entrar em ROI complexo), tempo de funcionamento, alertas resolvidos. |
| Envio automático do relatório por email pro cliente final | Reduz trabalho manual do operador | Baixa | Depende do M2 (motor de email funcional). |
| Customização de campos do relatório (mostrar/ocultar economia, créditos, etc) | Cada integradora vende serviço diferente | Média | M3+. |
| Histórico de relatórios (cliente final consulta no portal) | Cliente conserva | Baixa | Depende do portal do cliente final. |
| Exportação CSV/Excel da frota inteira (relatório anual de portfolio) | Auditoria, prestação de contas | Baixa | M3. |

### Multi-marca de verdade (já é vantagem do produto)

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Visão unificada de 6 provedores na mesma UI (Solis + Hoymiles + Fusion + Solarman + Auxsol + Foxess) | **Já é vantagem**. SurgePV cobra isso como diferencial #1 (economia de 2-3h/semana). Solytic é multi-marca. Concorrentes diretos do fabricante (SolisCloud, mySolarEdge) são single-brand. | Baixa | **Já existe**. Comunicar melhor em landing/docs. |
| Adicionar novo provedor sem deploy (admin cadastra credenciais → adapter detecta) | Mantém liderança de cobertura | Já existe | **Já existe** (`@registrar`). Falta esforço só pra novos provedores (ex.: Growatt, SAJ se vier demanda). |
| Drill-through pro portal nativo do provedor (link "abrir no SolisCloud") | Operador às vezes precisa do raw do provedor pra suporte | Baixa | M3+. |

### Portal do cliente final (segundo perfil, futuro)

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Login do cliente final vendo só a própria usina | Padrão Enphase/SolarEdge têm app do dono. SolarView tem portal cliente. Sunvoy é especializado nisso. **Mercado BR cobra isso.** | Alta | M5+. Requer: novo perfil de usuário, restrição de queryset, UI simplificada, talvez subdomínio branded. Decisão out-of-scope de M1/M2 — confirmado em PROJECT.md. |
| Painel "minha usina" com gráficos simples (sem severidade técnica) | Cliente final não quer ver "subtensao_ac em IT" — quer "tá funcionando? quanto gerou hoje?" | Média | Depende do anterior. |
| Notificação ao cliente final quando o operador resolveu (escolha do operador) | Trust signal — cliente vê que a integradora cuidou | Baixa | Depende do anterior + M2. |

### App mobile (futuro)

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| App mobile do operador (push native, ver mapa, resolver alerta) | SolarEdge Go é referência (lançado 2025-26). SolarView tem app. Diferencia bastante. | Muito alta | M6+. PWA com push (Web Push API) é meio-termo barato; nativo iOS/Android é projeto separado. **PWA é o caminho realista**. |
| Push notification (mobile) | Complementar a WhatsApp | Média | Depende do anterior. |
| Modo offline / cache (PWA) | Operador no campo sem 4G | Média | Depende do anterior. |

### Integrações

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Webhook configurável (já listado em table stakes) | — | — | — |
| API pública documentada (Swagger já existe) com chave por empresa | Integradoras técnicas conectam ao próprio ERP | Média | **Já tem Swagger**. Falta sistema de API keys persistente. |
| Integração com SolarView/SolarMarket (BR) via webhook | Migração gradual do legado da integradora | Baixa | M5+ se houver demanda. |
| Integração com CRM (Bitrix24, RD Station, HubSpot via Zapier/Make) | Lead vira usina sem digitação | Média | M5+. **Diferenciador médio** mas ecossistema brasileiro pesa. |
| Integração com sistemas de OS / ticketing (Pipedrive, Jira) | Fluxo: alerta crítico → OS automática | Média | M5+. |

### Bilhetagem SaaS interna (futuro)

| Feature | Valor | Complexidade | Notas |
|---------|-------|--------------|-------|
| Cobrança por usina monitorada / por kWp / por conta | Modelo SaaS padrão. Solar Analytics, Solytic cobram assim. | Alta | M7+. Out-of-scope confirmado em PROJECT.md. |
| Trial de 30 dias por empresa | Onboarding | Média | Depende do anterior. |
| Portal de pagamento (Stripe, Pagar.me pra BR) | Receita recorrente | Alta | Depende do anterior. |

---

## Anti-Features

Features explicitamente **NÃO** construir. Decisões já tomadas ou que ferem a filosofia central.

| Anti-feature | Por que evitar | O que fazer no lugar |
|--------------|----------------|----------------------|
| **Auto-remediação na rede elétrica** (desligar inversor remotamente, ajustar tensão) | Decisão estratégica explícita em PROJECT.md. Risco de responsabilidade civil + a tese é "informar". SolarEdge faz "weather guard" pra bateria mas não é nosso domínio. | Sempre apenas informar. Quem age é o operador. |
| **Consumir alertas nativos do provedor** (`alarmList`, `warn_data`) | Decisão fundadora. 12.8% churn <1h provou que é ruído. | Motor próprio de regras, raw fica em `LeituraUsina.raw` só pra debug. |
| **CRM de vendas / proposta solar / dimensionamento** | Outro produto (Aurora, OpenSolar, SolarMarket fazem isso). Misturar dilui foco. | Integrar com CRMs existentes via webhook/API quando necessário. |
| **Cálculo de ROI / payback / TIR financeira pro cliente** | "Bilhete/contas de luz" está fora de escopo (PROJECT.md). Calculadora financeira é outro produto. | Mostrar economia bruta estimada no PDF mensal (kWh × tarifa fixa simples). Não calcular payback. |
| **Configuração do inversor pelo portal** (set point, curva, anti-ilhamento) | Operação direta no equipamento; risco regulatório (Procel/distribuidora) + responsabilidade. | Documentar que precisa intervenção física do técnico. |
| **Faturamento de energia / billing da concessionária** | É vertical de Smart Meter (SolarView Smart Meter). Outro produto. | Não tocar. Eventualmente integrar via webhook se algum cliente pedir. |
| **Notificação por SMS pro Brasil** | Custo alto (R$ 0,15-0,30 por SMS no BR via Twilio); WhatsApp é o canal cultural correto. | WhatsApp Business API (Meta Cloud API gratuita até 1.000 conversas/mês). Email pra crítico. |
| **Aplicativo mobile nativo iOS/Android (Swift/Kotlin)** | Custo de manutenção alto (2 stacks separadas). PWA cobre 90% do uso real. | PWA com Web Push (M6+). Nativo só se PWA falhar em alguma métrica. |
| **Multi-idioma na UI** (i18n) | Mercado BR. Mais código, mais manutenção, zero ganho até internacionalizar. | PT-BR fixo. Internacionalizar é decisão de mercado, não técnica. |
| **Dark mode "feature flagship"** | Tailwind v4 + shadcn já suportam tema; é trivial. Não destacar como diferencial. | Habilitar quando der. Não vender como feature. |
| **Histerese clássica em regras (timer "X minutos abaixo do limite")** | Substituído por tri-state + carência por coletas consecutivas (`inversor_offline=3 coletas`). Já validado em produção. | Manter abordagem atual: coletas consecutivas + guard de potência mínima. |
| **Replicar alarmes "esquisitos" do fabricante** (ex.: "DC switch open", "PV string lost") | Mesmo motivo de não consumir alarmes nativos. São específicos do hardware e raramente acionáveis remotamente. | Se for crítico, criar regra própria derivada das leituras (ex.: `string_mppt_zerada` já cobre o caso útil). |
| **Predição de falha ML em M2–M4** | Risco de FP destrói a tese "alertas confiáveis". Só vale a pena com PR > 90% nos testes. | Adiar pra M5+, gastar M2–M4 em PR/irradiância (determinístico) e relatórios. |
| **Permitir editar a leitura crua** (`LeituraUsina.raw`) | Append-only protege auditoria. | Imutável. Bugs corrigidos por reprocessamento de cima pra baixo. |

---

## Dependências entre features

```
Notificações funcionais (M2)
  ├── habilita → Email do alerta para operador
  ├── habilita → WhatsApp do alerta para operador
  ├── habilita → Resumo diário (digest)
  ├── habilita → Janela de silêncio
  └── habilita → Relatório PDF mensal (envio automático)

Performance Ratio com irradiância real (M3-M4)
  ├── precisa de → lat/lon nas usinas (geocode já existe parcial)
  ├── precisa de → fonte de irradiância (NASA POWER vs Solcast — decisão)
  ├── habilita → Janela astral por usina (substitui horário solar fixo)
  ├── habilita → Detecção de queda de rendimento (vs expectativa, não vs histórico)
  └── habilita → Calibração automática de thresholds (no longo prazo)

Relatório PDF mensal (M3)
  ├── precisa de → motor de notificação por email funcional (M2)
  ├── precisa de → template HTML + WeasyPrint/Playwright
  ├── precisa de → tarifa fixa por empresa (campo novo em ConfiguracaoEmpresa)
  └── habilita → Pós-venda como produto comercial (tese central BR)

Portal do cliente final (M5+)
  ├── precisa de → novo papel de usuário (`cliente_final`) em Usuario.papel
  ├── precisa de → vínculo Usuario ↔ Usina (1:N — um cliente pode ter várias)
  ├── precisa de → restrição agressiva de queryset (não só por empresa, por usina específica)
  ├── precisa de → UI simplificada separada
  └── habilita → Notificação ao cliente quando alerta resolvido (M2-dependente)

App mobile PWA (M6+)
  ├── precisa de → Service Worker + manifest.json
  ├── precisa de → Web Push (VAPID keys; chave pública no frontend, privada no backend)
  ├── precisa de → adaptação de telas existentes pra layout mobile
  └── habilita → Notificação push nativa (complemento de WhatsApp)

Bilhetagem SaaS (M7+)
  ├── precisa de → modelo `Plano`, `Assinatura`, `Fatura`
  ├── precisa de → integração com gateway (Stripe internacional ou Pagar.me/Asaas para BR)
  ├── precisa de → enforcement de limite (não monitora se assinatura inativa)
  └── precisa de → conformidade fiscal BR (nota fiscal de serviço, ISS, etc — complexo)
```

---

## Especificidades do mercado BR

### LGPD (Lei Geral de Proteção de Dados — Lei 13.709/2018)

- **Dados pessoais coletados**: nome, email, telefone, endereço da usina (lat/lon), CPF/CNPJ (do cliente final no futuro).
- **Bases legais aplicáveis**: execução de contrato (operador da empresa); consentimento (cliente final recebendo email/WhatsApp).
- **Direitos do titular**: acesso, correção, eliminação, portabilidade — implementar `GET /api/usuarios/me/dados-pessoais/`, `DELETE /api/usuarios/me/anonimizar/` em algum momento.
- **Notificação de incidente**: 72h pra ANPD. Já temos `LogColeta` + `EntregaNotificacao`; falta processo documentado.
- **Hospedagem em território BR**: já temos (`trylab-vps` HostGator BR). Documentar em `/docs` como diferencial.
- **Multa**: até 2% do faturamento BR, limitado a R$ 50M por infração.
- **DPO** (Encarregado): obrigatório se a empresa cliente é controladora. Não muda nosso produto, mas afeta venda B2B.

### Tarifa Branca e GD (Marco Legal da GD — Lei 14.300/2022)

- **Fio B subiu**: 15% (2023) → 30% (2024) → 45% (2025) → 60% (2026). Reduz economia do cliente final → operador precisa mostrar isso com clareza no PDF mensal.
- **Tarifa branca automática** em discussão na ANEEL pra Grupo B com consumo >1.000 kWh. Diferencia tarifa por horário (ponta/fora-ponta).
- **Impacto pro produto**: o cálculo de "economia estimada" no PDF mensal precisa usar a tarifa correta por horário se o cliente for tarifa branca. M3+: campo `Empresa.modelo_tarifario` (convencional/branca/horossazonal-verde/horossazonal-azul) + `tarifa_ponta_rs_kwh`, `tarifa_fora_ponta_rs_kwh`.

### Distribuidoras

- **Faturas variam por distribuidora** (Energisa, Neoenergia, Cemig, CPFL, Light, Enel...): SolarView mantém docs separados de "Como identificar campos na fatura da [distribuidora]". Para nosso produto, não precisa entrar em parsing de fatura (Out of Scope). Só precisamos da **tarifa em R$/kWh** que o operador digita.

### Modo de operação

- **Maioria das usinas são GD (microgeração ≤ 75 kWp, minigeração ≤ 5 MW)** monitoradas remotamente. Volume legado do firmasolar (267 usinas / 6 empresas) confirma esse perfil.
- **Operador BR é WhatsApp-first**. Email pro crítico, WhatsApp pro dia-a-dia. SolarMarket destaca isso explicitamente.

---

## Recomendação MVP (próximo milestone após M1 hardening)

### M2 — Notificações funcionais

Priorizar (em ordem):

1. **Worker de email** consumindo `EntregaNotificacao` pendente; provedor SES/Resend/Sendgrid (decisão simples).
2. **Executor de webhook** (POST JSON, retry exponencial, log de status). Fechado HTTP, padrão simples.
3. **Configuração por empresa** de "quem recebe o quê" (regras × severidades × canais × usuários) — UI existe parcialmente.
4. **WhatsApp via Meta Cloud API** (token + número de business). Free até 1.000 conversas/mês; passa disso é R$ 0,01-0,07 por conversa. Templates aprovados pela Meta (3-5 templates pra cobrir aberto/escalado/resolvido).
5. **Janela de silêncio** (`config.notificacao_silencio_inicio/_fim`, ignorada se severidade=crítico).
6. **Resumo diário** (digest) — task Celery diária; 1 email/WhatsApp por usuário em vez de N notificações soltas.

Deixar pra **M3+**:

- Relatório PDF mensal (depende do worker de email funcionando).
- Performance Ratio com NASA POWER (substitui `sem_geracao_horario_solar` mais robusto).
- Tarifa por empresa (preparação pro PDF mensal com economia estimada).

Deixar pra **M5+**:

- Portal do cliente final.
- App mobile PWA.

Deixar pra **M7+**:

- Bilhetagem SaaS interna.

---

## Sources

### Plataformas internacionais
- [SolarEdge Monitoring Platform](https://www.solaredge.com/en/products/software-tools/monitoring-platform) — fleet management, mobile app SolarEdge Go (2026)
- [SolarEdge Go Mobile App](https://www.solaredge.com/us/products/software-tools/solaredge-go) — instala + frota + remoto num app só
- [What's New at SolarEdge 2026](https://marketing.solaredge.com/whats-new-at-solaredge-2026) — atualizações 2026
- [Enphase Enlighten — installer apps](https://enphase.com/installers/apps) — Enlighten Manager, Installer Toolkit
- [Enphase notifications preferences](https://support.enphase.com/s/article/What-are-different-notification-preferences-and-how-to-customize-for-your-system) — granularidade de notificação
- [SolisCloud (Solis monitoring)](https://www.solisinverters.com/us/accessories6/SolisCloud_us.html) — plataforma do fabricante, single-brand
- [Best Solar Monitoring Software for Installers 2026 (SurgePV)](https://www.surgepv.com/best-solar-software/monitoring) — comparativo de top 5 incluindo SolarEdge, Enphase, SMA, Fronius, Huawei aggregation
- [Sunvoy — white-label customer portal](https://sunvoy.com/) — referência pra portal cliente final branded
- [Solytic monitoring + Databricks](https://www.databricks.com/customers/solytic) — AI-driven multi-brand monitoring (300k+ devices)
- [Raycatch DeepSolar — AI diagnostics](https://raycatch.com/solution/) — ML pra root-cause analysis (escala grande/utility)
- [Top 10 Solar Asset Monitoring Software (scmGalaxy)](https://www.scmgalaxy.com/tutorials/top-10-solar-asset-monitoring-software-features-pros-cons-comparison/) — features comuns
- [Multi-brand monitoring (photovoltaic-software.com)](https://photovoltaic-software.com/pv-monitoring/monitoring-solar-pv-multi-brand) — Solar-Log, Mana, etc

### Mercado brasileiro
- [SolarView](https://solarview.com.br/) — referência BR de monitoramento + pós-venda pro integrador
- [SolarView PRO — recursos](https://solarview.com.br/centraldeajuda/central-de-monitoramento/duvidas-frequentes-central-de-monitoramento/quais-recursos-estao-disponiveis-na-solarview-pro) — features do plano pago
- [SolarView — novo modelo de relatório](https://solarview.com.br/blog/conheca-novo-modelo-relatorio-solarview/) — exemplo de PDF mensal pro cliente
- [SolarMarket — CRM solar BR com WhatsApp](https://www.solarmarket.com.br/) — suporte humanizado via WhatsApp como diferencial
- [Canal Solar — Fio B 60% em 2026](https://canalsolar.com.br/consumidores-60-do-fio-b-2026/) — impacto regulatório no cálculo de economia
- [Canal Solar — Tarifa Branca e GD](https://canalsolar.com.br/tarifa-branca-gd-consumidor-sistema-eletrico/) — tendência regulatória que afeta cálculo de economia

### Padrões técnicos
- [IEC 61724-1 Performance Ratio (PVsyst)](https://www.pvsyst.com/help-pvsyst7/performance_ratio.htm) — definição canônica
- [SolarEdge PR Calculation guide](https://knowledge-center.solaredge.com/sites/kc/files/monitoring_performance_ratio_calculation.pdf) — referência de implementação
- [NASA POWER Daily API](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) — irradiância grátis pra cálculo de PR
- [NASA POWER overview](https://power.larc.nasa.gov/) — homepage da API
- [Open-Meteo Satellite Radiation API](https://open-meteo.com/en/docs/satellite-radiation-api) — alternativa free ao NASA POWER
- [Hukseflux — How to calculate PV PR](https://www.hukseflux.com/applications/solar-energy-pv-system-performance-monitoring/how-to-calculate-pv-performance-ratio) — guia prático

### LGPD
- [LGPD Compliance Guide 2026-ready (Secure Privacy)](https://secureprivacy.ai/blog/lgpd-compliance-requirements) — checklist pra SaaS
- [Brazil LGPD SaaS Guide (Complydog)](https://complydog.com/blog/brazil-lgpd-complete-data-protection-compliance-guide-saas) — específico pra SaaS
- [LGPD Brazil Data Protection (DLA Piper)](https://www.dlapiperdataprotection.com/index.html?t=law&c=BR) — referência jurídica

### Integrações / API
- [OpenSolar API + Webhooks](https://www.opensolar.com/api/) — referência de design (webhooks GET com UUIDs)
- [Aurora Solar Sync API](https://aurorasolar.com/blog/scale-your-solar-organization-seamlessly-with-apis/) — 29 APIs separadas pra CRM/ERP sync

### Confidence assessment

| Área | Confidence | Razão |
|------|------------|-------|
| Table stakes (dashboard, alertas, CRUD) | HIGH | Convergência entre todas as plataformas pesquisadas + já implementado parcialmente |
| Notificações (WhatsApp BR, email, webhook) | HIGH | SolarMarket/SolarView confirmam o padrão BR; Meta Cloud API é padrão técnico documentado |
| Relatório PDF mensal | HIGH | SolarView vende isso como feature flagship pro BR; tecnologia (WeasyPrint/Playwright) é trivial |
| Performance Ratio + irradiância | MEDIUM-HIGH | IEC 61724-1 é padrão; NASA POWER tem limitações de resolução/latência que precisam ser validadas em piloto |
| Portal cliente final | MEDIUM | Sunvoy/mySolarEdge confirmam que existe demanda; impacto comercial específico no BR é hipótese (operador BR pode preferir manter cliente longe) |
| App mobile PWA vs nativo | MEDIUM | PWA cobre 90% dos casos; nativo é benchmark mas custo alto. Decisão depende de pesquisa com operador BR |
| AI/ML pra anomalia | LOW-MEDIUM | Solytic/Raycatch fazem em utility scale; aplicação em GD residencial brasileira é hipótese — risco de FP fere tese central |
| Bilhetagem SaaS interna | LOW | Out-of-scope confirmado; pesquisar quando chegar perto |
| Tarifa branca / Fio B | HIGH | Canal Solar + ANEEL têm documentação clara da regulação atual |
