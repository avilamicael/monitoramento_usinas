"""Regra `dado_eletrico_ausente`.

Dispara quando os campos elétricos centrais de um inversor vêm `null` em
N coletas consecutivas. Cobre o cenário onde o provedor nos responde com
sucesso (HTTP 200) mas mantém todos os campos vazios — sintoma típico de
datalogger pendurado em estado degradado, ou de adapter que está pulando
uma chamada de detalhe (Solarman antes do fix do `stats/day`, FusionSolar
quando `getDevRealKpi` falha em massa).

Threshold: `ConfiguracaoEmpresa.alerta_dado_ausente_coletas` (default 10).
A regra olha as N leituras mais recentes do inversor e dispara se TODAS
têm `pac_kw` null OU todos os campos elétricos null. O motivo de exigir
N seguidas é que dados elétricos podem oscilar legitimamente (inversor
em standby reporta nulls em alguns provedores).
"""
from __future__ import annotations

from apps.alertas.models import SeveridadeAlerta
from apps.monitoramento.models import LeituraInversor

from .base import Anomalia, RegraInversor, registrar


def _eletricos_nulls(leitura: LeituraInversor) -> bool:
    """Considera "elétricos ausentes" quando *todos* os principais estão null."""
    return (
        leitura.pac_kw is None
        and leitura.tensao_ac_v is None
        and leitura.frequencia_hz is None
        and leitura.tensao_dc_v is None
    )


@registrar
class DadoEletricoAusente(RegraInversor):
    nome = "dado_eletrico_ausente"
    severidade_padrao = SeveridadeAlerta.AVISO
    # Datalogger degradado / adapter pulando chamada normalmente afeta
    # vários inversores da mesma usina. Agrega.
    agregar_por_usina = True

    def avaliar(self, inversor, leitura, config) -> Anomalia | None | bool:
        if leitura is None:
            return None

        n = config.alerta_dado_ausente_coletas
        if n <= 0:
            return None

        ultimas = list(
            LeituraInversor.objects
            .filter(inversor=inversor)
            .order_by("-coletado_em")
            .values("coletado_em", "pac_kw", "tensao_ac_v", "frequencia_hz", "tensao_dc_v")[:n]
        )

        # Sem histórico suficiente ainda — ignora.
        if len(ultimas) < n:
            return None

        todas_nulls = all(
            row["pac_kw"] is None
            and row["tensao_ac_v"] is None
            and row["frequencia_hz"] is None
            and row["tensao_dc_v"] is None
            for row in ultimas
        )

        if not todas_nulls:
            return False

        return Anomalia(
            severidade=self.severidade_padrao,
            mensagem=(
                f"Inversor {inversor.numero_serie or inversor.id_externo} "
                f"sem dados elétricos em {n} coletas consecutivas — possível "
                f"datalogger degradado ou problema de adapter."
            ),
            contexto={
                "coletas_consecutivas": n,
                "primeira_coleta_null": ultimas[-1]["coletado_em"].isoformat(),
                "ultima_coleta_null": ultimas[0]["coletado_em"].isoformat(),
            },
        )
