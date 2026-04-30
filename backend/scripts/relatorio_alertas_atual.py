"""Relatório do estado atual: última coleta + alertas internos.

Roda dentro do container backend:
    docker compose exec backend python scripts/relatorio_alertas_atual.py
"""
from __future__ import annotations

import os
import sys
from collections import Counter, defaultdict
from datetime import timedelta

import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")
sys.path.insert(0, "/app")
django.setup()

from django.db.models import Count, Max, Min, Q  # noqa: E402
from django.utils import timezone as djtz  # noqa: E402

from apps.alertas.models import Alerta  # noqa: E402
from apps.coleta.models import LogColeta  # noqa: E402
from apps.inversores.models import Inversor  # noqa: E402
from apps.provedores.models import ContaProvedor  # noqa: E402
from apps.usinas.models import Usina  # noqa: E402


def sec(titulo: str) -> None:
    print(f"\n{'=' * 78}\n{titulo}\n{'=' * 78}")


def fmt_dt(dt) -> str:
    if dt is None:
        return "—"
    return dt.astimezone(djtz.get_current_timezone()).strftime("%d/%m %H:%M:%S")


def fmt_idade(dt) -> str:
    if dt is None:
        return "—"
    delta = djtz.now() - dt
    h = delta.total_seconds() / 3600
    if h < 1:
        return f"{int(delta.total_seconds() / 60)}min"
    if h < 24:
        return f"{h:.1f}h"
    return f"{h / 24:.1f}d"


# ── 1. Universo monitorado ────────────────────────────────────────────────
sec("1. UNIVERSO MONITORADO")
contas = ContaProvedor.objects.all()
print(f"Contas de provedor: {contas.count()} ({contas.filter(is_active=True).count()} ativas)")
print(f"Usinas: {Usina.objects.filter(is_active=True).count()} ativas / {Usina.objects.count()} total")
print(f"Inversores: {Inversor.objects.filter(is_active=True).count()} ativos / {Inversor.objects.count()} total")
print()
print(f"{'Provedor':<14} {'Contas':>6}  {'Usinas':>6}  {'Inversores':>10}  {'Última coleta':<22}")
print("-" * 70)
por_prov = (
    ContaProvedor.objects
    .values("tipo_provedor")
    .annotate(
        n_contas=Count("id"),
        ultima=Max("ultima_sincronizacao_iniciada_em"),
    )
    .order_by("tipo_provedor")
)
for row in por_prov:
    n_usinas = Usina.objects.filter(
        conta_provedor__tipo_provedor=row["tipo_provedor"]
    ).count()
    n_inv = Inversor.objects.filter(
        usina__conta_provedor__tipo_provedor=row["tipo_provedor"]
    ).count()
    print(
        f"{row['tipo_provedor']:<14} {row['n_contas']:>6}  {n_usinas:>6}  "
        f"{n_inv:>10}  {fmt_dt(row['ultima'])} ({fmt_idade(row['ultima'])})"
    )

# ── 2. Última coleta — saúde por conta ────────────────────────────────────
sec("2. ÚLTIMA COLETA POR CONTA")
print(f"{'Provedor':<14} {'Conta':<28} {'Início':<22} {'Status':<10} "
      f"{'L_us':>5} {'L_inv':>5} {'Erro':<30}")
print("-" * 130)
for conta in contas.filter(is_active=True).order_by("tipo_provedor", "id"):
    ultimo = (
        LogColeta.objects
        .filter(conta_provedor=conta)
        .order_by("-iniciado_em")
        .first()
    )
    if ultimo is None:
        print(f"{conta.tipo_provedor:<14} {(conta.nome_amigavel or str(conta.id))[:27]:<28} "
              f"{'(sem coletas)':<22}")
        continue
    erro = (ultimo.erro or "")[:28]
    print(
        f"{conta.tipo_provedor:<14} "
        f"{(conta.nome_amigavel or str(conta.id))[:27]:<28} "
        f"{fmt_dt(ultimo.iniciado_em)} ({fmt_idade(ultimo.iniciado_em):>5}) "
        f"{ultimo.status:<10} "
        f"{ultimo.leituras_usinas:>5} "
        f"{ultimo.leituras_inversores:>5} "
        f"{erro:<30}"
    )

# ── 3. Falhas e atrasos de coleta ─────────────────────────────────────────
sec("3. ÚLTIMAS 24h DE COLETA — RESUMO")
agora = djtz.now()
janela_24h = agora - timedelta(hours=24)
logs_24h = LogColeta.objects.filter(iniciado_em__gte=janela_24h)
total = logs_24h.count()
sucesso = logs_24h.filter(status="sucesso").count()
falha = logs_24h.filter(status="falha").count()
parcial = logs_24h.filter(status="parcial").count()
em_andamento = logs_24h.filter(status="em_andamento").count()
print(f"Total ciclos: {total}")
print(f"  Sucesso:      {sucesso} ({sucesso/total*100:.1f}%)" if total else "  (sem ciclos)")
print(f"  Parcial:      {parcial}")
print(f"  Falha:        {falha}")
print(f"  Em andamento: {em_andamento}")

print("\nTop falhas (últimas 24h):")
falhas_por_conta = (
    logs_24h.filter(status="falha")
    .values("conta_provedor__tipo_provedor", "conta_provedor__nome_amigavel")
    .annotate(n=Count("id"), ultimo=Max("iniciado_em"))
    .order_by("-n")[:10]
)
for f in falhas_por_conta:
    print(f"  {f['conta_provedor__tipo_provedor']:<14} "
          f"{(f['conta_provedor__nome_amigavel'] or '')[:30]:<30} "
          f"{f['n']:>3} falhas  últ: {fmt_dt(f['ultimo'])}")

# ── 4. Alertas abertos ────────────────────────────────────────────────────
sec("4. ALERTAS ABERTOS (estado=aberto)")
abertos = (
    Alerta.objects
    .filter(estado="aberto")
    .select_related("usina", "inversor", "usina__conta_provedor")
    .order_by("-severidade", "aberto_em")
)
total_abertos = abertos.count()
print(f"Total: {total_abertos}\n")

por_severidade = Counter(a.severidade for a in abertos)
print("Por severidade:")
for sev in ("critico", "aviso", "info"):
    print(f"  {sev:<10} {por_severidade.get(sev, 0)}")

por_regra = Counter(a.regra for a in abertos)
print("\nPor regra:")
for regra, n in sorted(por_regra.items(), key=lambda x: -x[1]):
    print(f"  {regra:<32} {n}")

por_provedor = Counter(
    (a.usina.conta_provedor.tipo_provedor if a.usina else "?")
    for a in abertos
)
print("\nPor provedor:")
for prov, n in sorted(por_provedor.items(), key=lambda x: -x[1]):
    print(f"  {prov:<14} {n}")

# Listagem detalhada
print("\nListagem (ordem: severidade desc, mais antigo primeiro):")
print(f"{'ID':>5} {'Sev':<8} {'Provedor':<12} {'Usina':<30} {'Regra':<28} "
      f"{'Aberto há':<10} {'Inversor':<20}")
print("-" * 130)
for a in abertos:
    inv = (a.inversor.numero_serie or a.inversor.id_externo)[:18] if a.inversor else "—"
    usina_nome = (a.usina.nome if a.usina else "?")[:28]
    prov = a.usina.conta_provedor.tipo_provedor if a.usina else "?"
    print(
        f"{a.id:>5} "
        f"{a.severidade:<8} "
        f"{prov:<12} "
        f"{usina_nome:<30} "
        f"{a.regra:<28} "
        f"{fmt_idade(a.aberto_em):<10} "
        f"{inv:<20}"
    )

# ── 5. Alertas resolvidos recentes (últimas 24h) ──────────────────────────
sec("5. ALERTAS RESOLVIDOS (últimas 24h)")
resolvidos = Alerta.objects.filter(estado="resolvido", resolvido_em__gte=janela_24h)
print(f"Total: {resolvidos.count()}\n")

print("Por regra:")
por_regra_resolvidos = Counter(a.regra for a in resolvidos)
for regra, n in sorted(por_regra_resolvidos.items(), key=lambda x: -x[1]):
    print(f"  {regra:<32} {n}")

# ── 6. Solarman críticos antigos (P0 do relatório) ────────────────────────
sec("6. CASOS P0 — SOLARMAN sem_comunicacao CRÍTICO ANTIGO")
solarman_antigos = (
    Alerta.objects
    .filter(
        estado="aberto",
        regra="sem_comunicacao",
        severidade="critico",
        usina__conta_provedor__tipo_provedor="solarman",
    )
    .select_related("usina")
    .order_by("aberto_em")
)
print(f"Total: {solarman_antigos.count()}\n")
for a in solarman_antigos:
    print(f"  ID {a.id} | {a.usina.nome[:40]:<40} | "
          f"aberto há {fmt_idade(a.aberto_em)} | "
          f"última leitura: {fmt_idade(a.usina.ultima_leitura_em)}")

# ── 7. Idade dos alertas abertos ──────────────────────────────────────────
sec("7. IDADE DOS ALERTAS ABERTOS")
faixas = {
    "<1h": 0,
    "1-24h": 0,
    "1-7d": 0,
    "7-30d": 0,
    ">30d": 0,
}
for a in abertos:
    delta = agora - a.aberto_em
    h = delta.total_seconds() / 3600
    if h < 1:
        faixas["<1h"] += 1
    elif h < 24:
        faixas["1-24h"] += 1
    elif h < 24 * 7:
        faixas["1-7d"] += 1
    elif h < 24 * 30:
        faixas["7-30d"] += 1
    else:
        faixas[">30d"] += 1
for f, n in faixas.items():
    print(f"  {f:<8} {n}")

# ── 8. Usinas com ultima_leitura_em antiga ────────────────────────────────
sec("8. USINAS COM ÚLTIMA LEITURA ANTIGA (>24h)")
mortas = (
    Usina.objects
    .filter(is_active=True, ultima_leitura_em__lt=agora - timedelta(hours=24))
    .select_related("conta_provedor")
    .order_by("ultima_leitura_em")
)
print(f"Total: {mortas.count()}\n")
print(f"{'Provedor':<14} {'Usina':<40} {'Última leitura':<22}")
print("-" * 80)
for u in mortas:
    print(
        f"{u.conta_provedor.tipo_provedor:<14} "
        f"{u.nome[:39]:<40} "
        f"{fmt_dt(u.ultima_leitura_em)} ({fmt_idade(u.ultima_leitura_em)})"
    )

print("\n" + "=" * 78)
print("FIM DO RELATÓRIO")
print("=" * 78)
