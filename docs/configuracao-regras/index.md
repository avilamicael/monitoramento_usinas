---
title: Configuração de Regras pelo Usuário
status: planejado
criado_em: 2026-05-06
tags: [planejamento, alertas, configuracao]
---

# Configuração de Regras pelo Usuário

Permite que cada empresa configure individualmente **severidade** e **estado ativo/inativo** das regras do motor de alertas, via interface web. Hoje essas decisões ficam fixadas em código (`severidade_padrao = SeveridadeAlerta.X` em cada `apps/alertas/regras/<nome>.py`), o que obriga deploy para qualquer ajuste.

## Motivação

- Cada cliente tem prioridades operacionais diferentes. O integrador pode achar `sobretensao_ac` crítica (vai queimar inversor); o instalador residencial pode achar irrelevante (concessionária resolve sozinha).
- Alguns clientes não querem ser notificados de certas regras (ex: `temperatura_alta` em climas quentes vira ruído).
- Mudança de severidade hoje = mudar código + deploy. Inviável em escala.

## Escopo do MVP

**Dentro:**
- Configuração de **severidade** (info / aviso / crítico) por regra, por empresa.
- Configuração de **regra ativa/inativa** por empresa (regra inativa não é avaliada).
- Página administrativa para listar e editar.
- Defaults vindos do código quando não há configuração explícita.
- Alertas já abertos migram automaticamente para a nova severidade (motor já reavalia a cada ciclo).

**Fora (fases futuras):**
- Configuração granular por usina (override por instalação específica).
- Histórico de mudanças de configuração (auditoria).
- Edição dos thresholds numéricos junto (já parcialmente cobertos por [[modelo-dados#configuracaoempresa]] — discussão à parte).
- Configuração por canal de notificação por regra (cruzar com [[../../frontend/src/pages/notificacoes/GestaoNotificacoesPage]]).

## Estado atual (mapeamento)

12 regras estão registradas. Severidades atuais (após commit `cbd529c` de 2026-05-06):

| Regra | Severidade default |
|---|---|
| `sem_geracao_horario_solar` | crítico |
| `sem_comunicacao` | aviso → crítico após 2× tempo |
| `inversor_offline` | aviso |
| `string_mppt_zerada` | aviso |
| `dado_eletrico_ausente` | aviso |
| `frequencia_anomala` | aviso |
| `garantia_vencendo` | info → aviso próximo do fim |
| `queda_rendimento` | info |
| `subdesempenho` | info (desativada por padrão) |
| `temperatura_alta` | info |
| `subtensao_ac` | info |
| `sobretensao_ac` | info |

Dados ao vivo: `SELECT regra, severidade, count(*) FROM alertas_alerta WHERE estado='aberto' GROUP BY regra, severidade;` na VPS.

## Decisões de design

1. **Tabela nova vs. config dentro de [[modelo-dados#configuracaoempresa]]**: vai ser tabela nova. `ConfiguracaoEmpresa` é 1:1 com `Empresa` e tem campos numéricos globais. Config por regra é 1:N (uma linha por regra) — cabe num model próprio.

2. **Defaults explícitos no banco vs. na regra**: defaults ficam **na regra (código)**. Quando uma empresa nunca configurou uma regra, o motor usa o default do código. Vantagem: adicionar regra nova não exige migration ou seed. Desvantagem: o admin só vê a config explícita; precisamos gerar a tela mostrando "linhas virtuais" para regras não-configuradas (resolvido na [[ui]]).

3. **Auditoria**: fora de escopo no MVP. Se for relevante depois, viraria `HistoricoConfiguracaoRegra` separado, sem mudar o model principal.

4. **Permissão**: apenas usuário com `papel=administrador` consegue editar (mesmo padrão de [[../../frontend/src/pages/notificacoes/GestaoNotificacoesPage]]).

## Próximos documentos

- [[modelo-dados]] — schema e migrations
- [[api]] — endpoints REST
- [[ui]] — desenho das telas
- [[plano-execucao]] — fases e commits
- [[riscos-e-rollback]] — o que pode dar errado e como reverter
