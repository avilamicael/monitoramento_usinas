---
title: Configuração de Regras — Plano de Execução
status: rascunho
tags: [planejamento, alertas, execucao]
---

# Plano de Execução

Volta para [[index]]. Modelo em [[modelo-dados]], API em [[api]], UI em [[ui]].

Plano dividido em fases que mantêm o sistema em estado consistente entre commits. Estilo análogo ao [[../PLANO]] do projeto.

## F1 — Fundação (backend)

Cria o model + integração com o motor sem mudar a UI. Após F1 a configuração já funciona via Django Admin (suficiente para validar a lógica antes de investir em frontend).

- **F1/C1** — `feat(alertas): adiciona ConfiguracaoRegra model`
  - Cria `apps/alertas/models.py::ConfiguracaoRegra`.
  - Migration gerada.
  - Registro no Django Admin com filtro por empresa.
  - **Saída esperada**: `make migrate` aplica; admin lista 0 linhas no início.

- **F1/C2** — `feat(alertas): motor consulta ConfiguracaoRegra`
  - Em `apps/alertas/motor.py::avaliar_empresa`, carrega overrides antes do loop.
  - Pula regras com `ativa=false`. Sobrescreve `severidade` para regras não-dinâmicas.
  - Marca `RegraBase.severidade_dinamica = False` (default) e sobe para `True` em `sem_comunicacao` e `garantia_vencendo`.
  - **Testes**: novo `test_motor_respeita_configuracao_regra.py` com 4 cenários:
    1. Sem override → comportamento atual preservado.
    2. Override `ativa=False` → regra não dispara, alerta aberto pré-existente fica congelado (não fechado por silêncio).
    3. Override de severidade → próximo alerta aberto/atualizado usa nova severidade.
    4. Regra dinâmica + override de severidade → motor ignora override e usa decisão da regra.
  - **Saída esperada**: testes passam, motor funcional sem regressão.

- **F1/C3** — `feat(alertas): tratamento de regra desativada com alertas abertos`
  - Decisão de design: ao desativar uma regra, os alertas abertos dela ficam **congelados** (não são fechados automaticamente; ficam visíveis com flag "regra desativada"). Operador pode resolvê-los manualmente.
  - Adiciona `Alerta.regra_desativada` (bool computed via property) e exibe na API (`/api/alertas/`).
  - **Testes**: cenário "ativa → desativa → reativa" sem perder histórico de alertas.

## F2 — API REST

Coloca os endpoints REST conforme [[api]]. Após F2, integradores podem usar Postman/curl para configurar.

- **F2/C1** — `feat(alertas): endpoint GET /configuracao-regras/`
  - View que mescla overrides com defaults e retorna 12 linhas.
  - Permission `AdminEmpresaOuSomenteLeitura`.
  - **Testes**: 3 cenários (sem overrides, parcial, total).

- **F2/C2** — `feat(alertas): endpoint PUT/DELETE /configuracao-regras/<regra_nome>/`
  - Upsert + remoção. Validação de regra existente.
  - **Testes**: criação, atualização, deleção, regra inválida (404), payload inválido (400), permissão (403).

- **F2/C3** — `feat(alertas): endpoint POST /configuracao-regras/reset-todos/`
  - Deleta todos os overrides da empresa.
  - **Testes**: idempotente, permissão.

## F3 — Frontend

Implementa a UI conforme [[ui]]. Após F3, admin consegue gerenciar pela tela.

- **F3/C1** — `feat(frontend/configuracao-regras): hook + tipos`
  - Cria `src/hooks/use-configuracao-regras.ts` com 4 hooks (listar, atualizar, resetar 1, resetar tudo).
  - Tipo `ConfiguracaoRegra` em `src/types/configuracao-regras.ts`.

- **F3/C2** — `feat(frontend/configuracao-regras): pagina e rota`
  - Cria `src/pages/configuracao/RegrasPage.tsx`.
  - Adiciona rota em `src/routes/router.tsx`.
  - Adiciona item de menu (`adminOnly`) em `src/components/layout/AppLayout.tsx`.

- **F3/C3** — `feat(frontend/configuracao-regras): componente de linha + interacoes`
  - Card por regra com toggle, select e botão "Resetar para padrão".
  - Lógica: severidade dinâmica → select desabilitado.
  - Toast de "Salvo" após cada mutation.

- **F3/C4** — `feat(frontend/configuracao-regras): modal "Resetar tudo"`
  - `Dialog` shadcn. Confirma e chama POST /reset-todos.

## F4 — Polish + Documentação

- **F4/C1** — `docs(configuracao-regras): atualiza CLAUDE.md`
  - Adiciona seção sobre `ConfiguracaoRegra` em `CLAUDE.md` na arquitetura do motor de alertas.
  - Atualiza tabela de regras mencionando que severidade default agora é editável.

- **F4/C2** — `docs(configuracao-regras): tutorial usuario final`
  - Cria `docs/configuracao-regras/manual-usuario.md` para o cliente final entender a tela.

- **F4/C3** — `chore(configuracao-regras): seed em ambiente de testes`
  - Em `apps/alertas/management/commands/`, comando `seed_configuracao_regras_dev` opcional para o usuário do dev poder testar UI rapidamente.

## Estimativa

| Fase | Esforço estimado | Risco |
|---|---|---|
| F1 | 1-2 dias | Médio (motor é central, regressão potencial) |
| F2 | 0.5-1 dia | Baixo |
| F3 | 1-2 dias | Baixo |
| F4 | 0.5 dia | Baixo |
| **Total** | **3-5 dias** | — |

## Critérios de aceite global

1. Admin de empresa A pode desativar `temperatura_alta`. Empresa B continua avaliando essa regra normalmente.
2. Admin de empresa A pode subir `sobretensao_ac` para crítico. Próxima coleta atualiza alertas abertos para crítico.
3. Admin pode "Resetar para padrão" e a regra volta ao default do código.
4. Admin pode "Resetar tudo" e todas as 12 regras voltam aos defaults.
5. Usuário operacional (não-admin) consegue **ler** a página mas não consegue editar (botões disabled).
6. Adicionar regra nova no código não exige migration nem mudança na tela — aparece automaticamente com defaults.

## Próximo: [[riscos-e-rollback]]
