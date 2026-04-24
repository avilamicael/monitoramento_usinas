from __future__ import annotations

from .base import (
    BaseAdapter,
    Capacidades,
    DadosInversor,
    DadosUsina,
    ErroAutenticacaoProvedor,
    ErroProvedor,
    ErroRateLimitProvedor,
    MpptString,
)
from .registry import adapter_para, registrar, tipos_registrados

__all__ = (
    "BaseAdapter",
    "Capacidades",
    "DadosInversor",
    "DadosUsina",
    "ErroAutenticacaoProvedor",
    "ErroProvedor",
    "ErroRateLimitProvedor",
    "MpptString",
    "adapter_para",
    "registrar",
    "tipos_registrados",
)
