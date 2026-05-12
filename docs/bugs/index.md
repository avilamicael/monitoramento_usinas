---
title: Bugs em aberto
description: Lista de bugs identificados aguardando investigação ou fix
tags: [bugs, indice]
---

# Bugs em aberto

Inventário de problemas conhecidos. Cada bug vira um arquivo próprio nesta pasta.

| Bug | Severidade | Status |
|---|---|---|
| [[logcoleta-contadores-zerados]] | cosmético | aberto, sem urgência |
| [[coleta-tasks-perdidas-no-boot]] | importante | aberto, mitigação manual disponível |
| [[geracao-horaria-bucket-00h-provedores-china]] | aviso | aberto, descoberto 2026-05-12 |

## Resolvidos

| Bug | Resolvido em |
|---|---|
| [[resolvidos/adapter-hoymiles-estado-vs-pac]] | 2026-05-07 |

## Convenções

- Frontmatter com `severidade` (info/aviso/critico/cosmetico) e `status` (aberto/investigando/em-fix/resolvido).
- Cada bug deve ter: sintoma, contexto/reprodução, hipóteses, próximos passos.
- Quando resolvido, mover para `docs/bugs/resolvidos/` com link pro commit do fix.
