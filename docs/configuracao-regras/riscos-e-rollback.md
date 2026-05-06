---
title: Configuração de Regras — Riscos e Rollback
status: rascunho
tags: [planejamento, alertas, riscos]
---

# Riscos e Rollback

Volta para [[index]]. Plano em [[plano-execucao]].

## Riscos

### R1 — Motor passa a consultar `ConfiguracaoRegra` a cada empresa por ciclo

**Risco:** uma query a mais por empresa por ciclo de avaliação.

**Mitigação:**
- Query é simples (`filter(empresa=...)`), retorna no máximo ~12 linhas.
- Cache em memória dentro do `avaliar_empresa` (1 query por chamada, não por regra).
- Indexada por `empresa` (UniqueConstraint já cobre).

**Sinal de problema:** `LogColeta.duracao_ms` aumenta consistentemente após F1/C2. Investigar se está consultando dentro do loop de regra em vez de uma vez no início.

### R2 — Regra desativada deixa alerta aberto "fantasma"

**Risco:** se admin desativa uma regra com alertas abertos, esses alertas não são mais avaliados — ficam abertos para sempre até alguém resolver manualmente.

**Mitigação F1/C3:**
- Decisão explícita: alertas abertos **continuam abertos** (não fechamos por desativação para preservar o histórico do problema).
- UI de listagem de alertas mostra badge "Regra desativada" em alertas afetados.
- Operador pode resolver manualmente com um clique.

**Alternativa rejeitada:** fechar automaticamente alertas quando a regra é desativada. Rejeitada porque pode mascarar problemas reais que não desapareceram só porque o admin mudou a configuração.

### R3 — Severidade dinâmica conflita com override do usuário

**Risco:** usuário tenta fixar `sem_comunicacao` em "info"; regra continua subindo para crítico após 48h. Confusão.

**Mitigação:** UI desabilita o select para regras dinâmicas e mostra texto explicativo. API ignora a tentativa de override de severidade nessas regras (mas `ativa` continua editável).

### R4 — Admin desativa `sem_geracao_horario_solar` por engano

**Risco:** essa é a regra mais importante do produto (descoberta de churn 12.8% no antigo). Desativar por engano = clientes ficam sem alerta.

**Mitigação:** UI exibe modal de confirmação ao desativar regras `severidade_padrao=critico`. Texto: "Esta é uma regra crítica. Tem certeza que quer desativar?"

### R5 — Migração `0XXX_configuracaoregra` falha em produção

**Risco:** a migration cria tabela vazia, baixíssimo risco de falha.

**Mitigação:** padrão `make migrate` em ambiente de homologação antes de produção. Migration é puramente CreateModel + UniqueConstraint, reversível com `migrate alertas <previous>`.

### R6 — Regression nos testes de alertas

**Risco:** mudança no motor pode quebrar `test_motor_agregacao`, `test_thresholds_tensao`, etc.

**Mitigação:** F1/C2 inclui rodar a suíte completa de `apps/alertas/tests/` antes do commit. Padrão "nada vermelho merge" estabelecido.

## Rollback

### Cenário: bug descoberto após F1 deployado

```bash
# Reverte commits do backend
git revert <hash-F1-C3> <hash-F1-C2> <hash-F1-C1>
git push origin main

# Na VPS
ssh -i ~/.ssh/monitoramento_firmasolar.pem ubuntu@monitoramento.firmasolar.com.br
cd /home/ubuntu/monitoramento
git pull
docker compose exec backend python manage.py migrate alertas 0XXX_anterior
docker compose restart backend worker beat
```

A migration de criação é segura de reverter (CreateModel sem dados em uso quando recém-criado). Se houver dados na `ConfiguracaoRegra`, a migration reversa apaga a tabela junto — isso é aceitável porque o sistema volta a usar defaults do código.

### Cenário: bug descoberto após F2 ou F3 deployado

A reversão envolve mais arquivos (frontend), mas a estratégia é a mesma: `git revert` dos commits da fase, push, deploy.

Se o problema for **só na UI**, podemos fazer um hotfix bloqueando temporariamente o item de menu (`adminOnly && false`) enquanto a UI é corrigida — backend continua funcionando via Django Admin.

## Checklist pré-deploy

- [ ] `make test` passa sem regressão (excluindo as 3 falhas pré-existentes em `test_sem_geracao_horario_solar_astral.py`).
- [ ] Migration testada em snapshot do banco da VPS.
- [ ] Pelo menos 1 empresa de teste com 2-3 overrides configurados, validando o motor.
- [ ] UI testada em 2 navegadores (Chrome + Firefox) por causa de comportamento de Switch shadcn.
- [ ] CLAUDE.md atualizado com a seção sobre `ConfiguracaoRegra`.

## Limites do MVP — não escalar antes de provar valor

Não fazer no primeiro release:
- Configuração granular por usina (override por instalação).
- Histórico de auditoria de quem mudou o quê.
- Templates pré-definidos ("Perfil instalador residencial", "Perfil integrador comercial").
- Editar thresholds numéricos junto na mesma página (cabe em outra fase, talvez "ConfiguracaoCompleta").

Validar com 2-3 clientes reais usando F1+F2+F3 antes de evoluir.
