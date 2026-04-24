"""Parser do binário protobuf de `down_module_day_data` da Hoymiles.

A Hoymiles não expõe os dados elétricos de microinversor num JSON fácil —
tudo vem num protobuf próprio (sem .proto publicado). Essa engenharia
reversa foi validada contra payloads reais da conta de produção.

Layout (descoberto empiricamente):
- Top-level: field 3 repetido = 1 bloco por microinversor.
- Dentro de cada bloco:
  - varint = micro_id.
  - bytes  = micro_data_raw (sub-blob).
- Dentro do sub-blob:
  - field 5 (bytes) = packed float32[] — frequência Hz (último valor válido)
  - field 6 (bytes) = packed float32[] — temperatura °C
  - field 7 (bytes) = packed float32[] — tensão AC V
  - field qualquer (bytes) = bloco por port com datapoints.
- Dentro de cada bloco de port:
  - varint = port_num (1..4).
  - bytes  = lista de datapoints (22 bytes cada).
- Dentro de cada datapoint:
  - field 1 (f32)    → tensão DC V
  - field 2 (f32)    → corrente DC A
  - field 3 (f32)    → potência DC W
  - field 4 (varint) → energia Wh acumulada no dia
  - field 5 (varint) → status
"""
from __future__ import annotations

import struct

# Field num → chave CA no resultado agregado por microinversor.
_CAMPOS_CA = {5: "frequencia_hz", 6: "temperatura_c", 7: "tensao_ac_v"}


def _ler_varint(data: bytes, pos: int) -> tuple[int, int]:
    result = 0
    shift = 0
    while pos < len(data):
        b = data[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            break
        shift += 7
    return result, pos


def _packed_floats(data: bytes) -> list[float]:
    n = len(data) // 4
    if n == 0:
        return []
    return list(struct.unpack_from(f"<{n}f", data, 0))


def _ultimo_valido(vs: list[float]) -> float | None:
    for v in reversed(vs):
        if v and v == v and abs(v) < 1e9:
            return round(v, 3)
    return None


def _blob(data: bytes) -> list[tuple]:
    """Decodifica um blob protobuf em lista de (field_num, kind, value).

    kind ∈ {"varint", "f32", "str", "bytes"}.
    Encerra no primeiro erro (tolerante).
    """
    pos = 0
    fields: list[tuple] = []
    while pos < len(data):
        try:
            tag, pos = _ler_varint(data, pos)
            fn = tag >> 3
            wt = tag & 0x7
            if wt == 0:
                v, pos = _ler_varint(data, pos)
                fields.append((fn, "varint", v))
            elif wt == 2:
                length, pos = _ler_varint(data, pos)
                raw = data[pos:pos + length]
                pos += length
                try:
                    fields.append((fn, "str", raw.decode("utf-8")))
                except Exception:
                    fields.append((fn, "bytes", raw))
            elif wt == 5:
                v = struct.unpack("<f", data[pos:pos + 4])[0]
                pos += 4
                fields.append((fn, "f32", v))
            else:
                break
        except Exception:
            break
    return fields


def _datapoint(dp: bytes) -> dict:
    mapa_float = {1: "tensao_dc_v", 2: "corrente_dc_a", 3: "potencia_dc_w"}
    r: dict = {}
    pos = 0
    while pos < len(dp):
        try:
            tag = dp[pos]
            pos += 1
            fn = tag >> 3
            wt = tag & 7
            if wt == 5:
                val = struct.unpack("<f", dp[pos:pos + 4])[0]
                pos += 4
                if fn in mapa_float:
                    r[mapa_float[fn]] = round(val, 3)
            elif wt == 0:
                val, pos = _ler_varint(dp, pos)
                if fn == 4:
                    r["energia_hoje_wh"] = val
                elif fn == 5:
                    r["status"] = val
            else:
                break
        except Exception:
            break
    return r


def parsear_dados_dia(blob: bytes) -> dict[int, dict]:
    """Recebe o payload binário e devolve dict `{micro_id: dados_agregados}`.

    `dados_agregados` contém:
        tensao_dc_v      — média entre ports (V)
        corrente_dc_a    — soma dos ports (A)
        pac_kw           — soma das potências DC / 1000 (kW)
        energia_hoje_kwh — soma das energias / 1000 (kWh)
        strings_mppt     — {port_str: {tensao, corrente}}
        tensao_ac_v, frequencia_hz, temperatura_c — último valor válido
    """
    resultado: dict[int, dict] = {}
    top = _blob(blob)

    for fn, ft, val in top:
        if fn != 3 or ft != "bytes":
            continue
        inner = _blob(val)
        micro_id = next((v for f, t, v in inner if t == "varint"), None)
        micro_data_raw = next((v for f, t, v in inner if t == "bytes"), None)
        if micro_id is None or micro_data_raw is None:
            continue

        inner2 = _blob(micro_data_raw)
        port_blocks = [(f, v) for f, t, v in inner2 if t == "bytes"]

        ca: dict[str, float | None] = {}
        for f, t, v in inner2:
            if t == "bytes" and f in _CAMPOS_CA:
                ca[_CAMPOS_CA[f]] = _ultimo_valido(_packed_floats(v))

        port_data: dict[int, dict] = {}
        for _, pb in port_blocks:
            pb_fields = _blob(pb)
            port_num = next(
                (v for f, t, v in pb_fields if t == "varint"), None
            )
            if port_num is None or port_num == 0:
                continue
            dp_raw = next((v for f, t, v in pb_fields if t == "bytes"), None)
            if dp_raw is None:
                continue
            dps = [v for f, t, v in _blob(dp_raw) if t == "bytes"]
            if not dps:
                continue
            # Último datapoint com dados válidos
            escolhido = None
            for raw in reversed(dps):
                dp = _datapoint(raw)
                if dp.get("potencia_dc_w", 0) > 0 or dp.get("energia_hoje_wh", 0) > 0:
                    escolhido = dp
                    break
            if escolhido is None and dps:
                escolhido = _datapoint(dps[-1])
            if escolhido:
                port_data[port_num] = escolhido

        if not port_data:
            continue

        tensoes = [p["tensao_dc_v"] for p in port_data.values() if "tensao_dc_v" in p]
        correntes = [p["corrente_dc_a"] for p in port_data.values() if "corrente_dc_a" in p]
        potencias = [p["potencia_dc_w"] for p in port_data.values() if "potencia_dc_w" in p]
        energias = [p["energia_hoje_wh"] for p in port_data.values() if "energia_hoje_wh" in p]

        resultado[micro_id] = {
            "tensao_dc_v": round(sum(tensoes) / len(tensoes), 2) if tensoes else None,
            "corrente_dc_a": round(sum(correntes), 3) if correntes else None,
            "pac_kw": round(sum(potencias) / 1000, 4) if potencias else None,
            "energia_hoje_kwh": round(sum(energias) / 1000, 4) if energias else None,
            "strings_mppt": {
                str(port): {
                    "tensao": p.get("tensao_dc_v"),
                    "corrente": p.get("corrente_dc_a"),
                }
                for port, p in port_data.items()
            },
            **ca,
        }

    return resultado
