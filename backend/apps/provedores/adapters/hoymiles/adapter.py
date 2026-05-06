"""Adapter Hoymiles — S-Cloud com token persistido e dados elétricos via
protobuf reverso.

- Autenticação stateful (token "3.xxx..."). Token é guardado via
  `cache_token_enc` da `ContaProvedor` e reutilizado entre coletas — login
  custa caro (Argon2 para v3).
- Unidade: Hoymiles retorna potência em W, energia em Wh. Adapter converte
  tudo para kW/kWh antes de emitir `DadosUsina`/`DadosInversor`.
- Dados elétricos DC + tensão AC / freq / temp por microinversor vêm do
  binário protobuf de `down_module_day_data`, decodificado em `protobuf.py`.
  A API cloud da Hoymiles NÃO expõe corrente AC por micro — fica null.

Microinversores Hoymiles são monofásicos por design (cada micro interfaceia
1 a 4 painéis com a rede em ligação fase-neutro). O protobuf cloud expõe um
único valor de tensão AC por micro, sem decomposição por fase. Quando há
`tensao_ac_v`, classificamos como `tipo_ligacao="monofasico"` e populamos
`eletrica_ac.fases_neutro.a`. Quando ausente, ambos ficam `None` para
respeitar a regra null≠0.

Adapter hidrata um cache por instância (1 ciclo de coleta): `buscar_usinas`
dispara tudo (lista + realtime paralelo), `buscar_inversores` lê o cache
e dispara `down_module_day_data` uma vez por usina.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import requests

from apps.provedores.adapters.base import (
    BaseAdapter,
    Capacidades,
    DadosInversor,
    DadosUsina,
    ErroAutenticacaoProvedor,
    MpptString,
)
from apps.provedores.adapters.registry import registrar
from apps.provedores.adapters.unidades import (
    a,
    hz,
    kw,
    kwh,
    temp_c,
    v,
    w_para_kw,
    wh_para_kwh,
)

from .autenticacao import HEADERS_BASE, fazer_login
from .consultas import baixar_dados_dia, listar_inversores, listar_usinas

logger = logging.getLogger(__name__)

_MAPA_STATUS = {
    0: "offline",
    1: "offline",
    2: "alerta",
    3: "online",
    40: "online",
}


def _mapear_status(v: Any) -> str:
    try:
        return _MAPA_STATUS.get(int(v), "offline")
    except (TypeError, ValueError):
        return "offline"


@registrar
class HoymilesAdapter(BaseAdapter):
    """Hoymiles S-Cloud — autenticação nonce-hash com token reutilizável.

    Credenciais: `{"username": "...", "password": "...", "token": "..."?}`.
    Worker passa `token` via merge do `cache_token_enc` se houver.

    Capacidades: microinversores; expõe strings_mppt (por port). Tensão AC
    e frequência/temperatura só vêm via protobuf agregado por micro —
    correntes AC por micro não existem na API cloud (só Modbus local).
    """

    tipo = "hoymiles"
    capacidades = Capacidades(
        expoe_inversores=True,
        expoe_strings_mppt=True,
        requisicoes_por_janela=5,
        janela_segundos=10,
        intervalo_minimo_minutos=10,
    )

    def __init__(self, credenciais: dict[str, Any]) -> None:
        super().__init__(credenciais)
        self._usuario = credenciais["username"]
        self._senha = credenciais["password"]
        self._token: str | None = credenciais.get("token")
        self._sessao = requests.Session()
        self._sessao.headers.update(HEADERS_BASE)

        self._usinas_raw: list[dict] | None = None
        # Cache de dados do dia por usina
        self._dados_dia: dict[str, dict[int, dict]] = {}

    # ── Token ────────────────────────────────────────────────────────────

    def _garantir_autenticado(self) -> None:
        if not self._token:
            self._token = fazer_login(self._usuario, self._senha, self._sessao)

    def _renovar_token(self) -> None:
        """Invalida cache e força re-login. Usado quando a API rejeita o token
        (senha trocada, token revogado pelo provedor, etc)."""
        self._token = None
        self._token = fazer_login(self._usuario, self._senha, self._sessao)

    def obter_cache_token(self) -> dict[str, Any] | None:
        return {"token": self._token} if self._token else None

    # ── Contrato ─────────────────────────────────────────────────────────

    def buscar_usinas(self) -> list[DadosUsina]:
        self._garantir_autenticado()
        assert self._token
        try:
            self._usinas_raw = listar_usinas(self._sessao, self._token)
        except ErroAutenticacaoProvedor:
            # Token cached inválido (senha trocada, etc) — força re-login.
            self._renovar_token()
            self._usinas_raw = listar_usinas(self._sessao, self._token)
        return [self._normalizar_usina(r) for r in self._usinas_raw]

    def buscar_inversores(self, id_usina_externo: str) -> list[DadosInversor]:
        self._garantir_autenticado()
        assert self._token
        try:
            registros = listar_inversores(
                id_usina_externo, self._sessao, self._token
            )
        except ErroAutenticacaoProvedor:
            self._renovar_token()
            registros = listar_inversores(
                id_usina_externo, self._sessao, self._token
            )
        if id_usina_externo not in self._dados_dia:
            try:
                self._dados_dia[id_usina_externo] = baixar_dados_dia(
                    id_usina_externo, self._sessao, self._token
                )
            except ErroAutenticacaoProvedor:
                self._renovar_token()
                self._dados_dia[id_usina_externo] = baixar_dados_dia(
                    id_usina_externo, self._sessao, self._token
                )
        dia = self._dados_dia.get(id_usina_externo, {})
        return [
            self._normalizar_inversor(r, id_usina_externo, dia) for r in registros
        ]

    # ── Normalização — usina ─────────────────────────────────────────────

    def _normalizar_usina(self, r: dict) -> DadosUsina:
        rt = r.get("_realtime") or {}
        status = _mapear_status(r.get("status"))
        # Hoymiles S-Cloud não retorna timestamp da última medição. Quando
        # a usina está offline (status mapeado), `now()` mascara perda de
        # comunicação. `medido_em=None` deixa `sem_comunicacao` operar
        # contra a última leitura real preservada em `Usina.ultima_leitura_em`.
        medido_em = datetime.now(timezone.utc) if status == "online" else None
        return DadosUsina(
            id_externo=str(r.get("id", "")),
            nome=r.get("name") or "(sem nome)",
            capacidade_kwp=kw(r.get("capacitor") or r.get("capacity")),
            potencia_kw=w_para_kw(rt.get("real_power")),
            energia_hoje_kwh=wh_para_kwh(rt.get("today_eq")),
            energia_mes_kwh=wh_para_kwh(rt.get("month_eq")),
            energia_total_kwh=wh_para_kwh(rt.get("total_eq")),
            status=status,
            medido_em=medido_em,
            endereco=r.get("address") or "",
            fuso_horario=r.get("tz_name") or "America/Sao_Paulo",
            raw=r,
        )

    # ── Normalização — inversor (microinversor) ──────────────────────────

    def _normalizar_inversor(
        self, r: dict, id_usina_externo: str, dia: dict[int, dict]
    ) -> DadosInversor:
        sn = r.get("sn") or r.get("dtu_sn") or str(r.get("id", ""))
        micro_id = r.get("id")
        eletrico = dia.get(micro_id, {}) if micro_id is not None else {}

        conectado = (r.get("warn_data") or {}).get("connect", False)
        estado = "online" if conectado else "offline"

        strings_mppt: list[MpptString] = []
        for port_str, vals in (eletrico.get("strings_mppt") or {}).items():
            try:
                idx = int(port_str)
            except (TypeError, ValueError):
                continue
            tensao = v(vals.get("tensao"))
            corrente = a(vals.get("corrente"))
            if tensao is None and corrente is None:
                continue
            strings_mppt.append(
                MpptString(
                    indice=idx,
                    tensao_v=tensao,
                    corrente_a=corrente,
                    potencia_w=None,
                )
            )

        # Microinversor é monofásico por design. Cloud expõe um único valor
        # de tensão AC, sem corrente AC nem decomposição por fase. Se houver
        # tensão, classificamos como monofásico e mapeamos pra fase A; caso
        # contrário, deixamos `tipo_ligacao=None` e `eletrica_ac=None` pra
        # não inventar dado.
        tensao_ac = v(eletrico.get("tensao_ac_v"))
        if tensao_ac is not None:
            tipo_ligacao: str | None = "monofasico"
            eletrica_ac: dict[str, Any] | None = {
                "fases_neutro": {"a": tensao_ac},
            }
        else:
            tipo_ligacao = None
            eletrica_ac = None

        # Hoymiles cloud não expõe timestamp da última medição. Para micro
        # offline, `now()` é informação falsa — usar `None` preserva o sinal
        # honesto de "sem dados frescos".
        medido_em = datetime.now(timezone.utc) if estado == "online" else None

        return DadosInversor(
            id_externo=str(micro_id or sn),
            id_usina_externo=id_usina_externo,
            numero_serie=sn,
            modelo=r.get("model") or r.get("model_no") or f"tipo-{r.get('type', '?')}",
            tipo="microinversor",
            estado=estado,
            medido_em=medido_em,
            pac_kw=Decimal(str(eletrico.get("pac_kw"))) if eletrico.get("pac_kw") else None,
            energia_hoje_kwh=Decimal(str(eletrico.get("energia_hoje_kwh")))
            if eletrico.get("energia_hoje_kwh") else None,
            energia_total_kwh=None,  # Hoymiles não expõe total por micro
            tensao_ac_v=tensao_ac,
            corrente_ac_a=None,  # API cloud não expõe (só Modbus local)
            frequencia_hz=hz(eletrico.get("frequencia_hz")),
            tensao_dc_v=v(eletrico.get("tensao_dc_v")),
            corrente_dc_a=a(eletrico.get("corrente_dc_a")),
            temperatura_c=temp_c(eletrico.get("temperatura_c")),
            soc_bateria_pct=None,
            tipo_ligacao=tipo_ligacao,
            eletrica_ac=eletrica_ac,
            strings_mppt=strings_mppt,
            raw=r,
        )
