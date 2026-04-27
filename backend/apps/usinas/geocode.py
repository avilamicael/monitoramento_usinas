"""Geocoding via Nominatim (OpenStreetMap) — gratuito, rate limit 1 req/s.

Usado pelo endpoint `POST /api/usinas/geocode/` e pelo management command
`geocode_usinas`. Mantém um pequeno cache LRU em memória do processo para
evitar chamadas repetidas com o mesmo input.

Política Nominatim:
- 1 requisição por segundo por IP.
- User-Agent identificável obrigatório.
- Sem chave de API.

Referência: https://operations.osmfoundation.org/policies/nominatim/
"""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass
from functools import lru_cache
from threading import Lock

import requests

logger = logging.getLogger(__name__)

USER_AGENT = "monitoramento-firmasolar/1.0"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
TIMEOUT_S = 8

# Garante 1 req/s para todo o processo (Nominatim TOS).
_lock_rate = Lock()
_ultima_chamada = 0.0


def _aplicar_rate_limit() -> None:
    global _ultima_chamada
    with _lock_rate:
        agora = time.monotonic()
        delta = agora - _ultima_chamada
        if delta < 1.05:
            time.sleep(1.05 - delta)
        _ultima_chamada = time.monotonic()


def normalizar_cep(cep: str) -> str:
    """Devolve apenas dígitos do CEP, ou string vazia."""
    if not cep:
        return ""
    return re.sub(r"\D", "", cep)[:8]


@dataclass(frozen=True)
class ResultadoGeocode:
    latitude: float
    longitude: float
    endereco_normalizado: str


class GeocodeError(Exception):
    """Erro genérico do serviço de geocoding (timeout, rede, parse)."""


class GeocodeNaoEncontrado(GeocodeError):
    """Endereço/CEP não retornou resultados."""


@lru_cache(maxsize=512)
def geocode(query: str) -> ResultadoGeocode:
    """Resolve uma query livre via Nominatim. Cacheia em memória.

    Levanta `GeocodeNaoEncontrado` se a API responde 200 com lista vazia,
    ou `GeocodeError` em qualquer falha de rede/timeout/parse.
    """
    if not query or not query.strip():
        raise GeocodeNaoEncontrado("query vazia")

    _aplicar_rate_limit()
    try:
        resp = requests.get(
            NOMINATIM_URL,
            params={
                "q": query,
                "format": "jsonv2",
                "limit": 1,
                "addressdetails": 1,
                "countrycodes": "br",
            },
            headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR"},
            timeout=TIMEOUT_S,
        )
    except requests.RequestException as exc:
        raise GeocodeError(f"falha de rede: {exc}") from exc

    if resp.status_code != 200:
        raise GeocodeError(f"http {resp.status_code}: {resp.text[:200]}")

    try:
        dados = resp.json()
    except ValueError as exc:
        raise GeocodeError("resposta não-JSON do Nominatim") from exc

    if not dados:
        raise GeocodeNaoEncontrado(f"sem resultados para: {query!r}")

    top = dados[0]
    try:
        lat = float(top["lat"])
        lon = float(top["lon"])
        nome = top.get("display_name", "")
    except (KeyError, TypeError, ValueError) as exc:
        raise GeocodeError("payload inesperado do Nominatim") from exc

    return ResultadoGeocode(latitude=lat, longitude=lon, endereco_normalizado=nome)


def geocode_por_cep(cep: str) -> ResultadoGeocode:
    """Geocode usando apenas CEP (com ou sem hífen).

    Nominatim aceita "01001-000, Brasil" diretamente.
    """
    cep_limpo = normalizar_cep(cep)
    if len(cep_limpo) != 8:
        raise GeocodeNaoEncontrado(f"CEP inválido: {cep!r}")
    cep_formatado = f"{cep_limpo[:5]}-{cep_limpo[5:]}"
    return geocode(f"{cep_formatado}, Brasil")


def geocode_por_endereco(
    *,
    endereco: str = "",
    bairro: str = "",
    cidade: str = "",
    estado: str = "",
    cep: str = "",
) -> ResultadoGeocode:
    """Geocode por componentes — concatena o que estiver presente."""
    partes = [p.strip() for p in (endereco, bairro, cidade, estado) if p and p.strip()]
    if cep:
        cep_limpo = normalizar_cep(cep)
        if len(cep_limpo) == 8:
            partes.append(f"{cep_limpo[:5]}-{cep_limpo[5:]}")
    if not partes:
        raise GeocodeNaoEncontrado("nenhum componente de endereço fornecido")
    partes.append("Brasil")
    return geocode(", ".join(partes))
