from __future__ import annotations

from django.utils import timezone as djtz
from django_filters import rest_framework as filters
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.api import empresa_do_request, EmpresaQuerysetMixin
from apps.usuarios.permissions import AdminEmpresaOuSomenteLeitura

from .models import Alerta, ConfiguracaoRegra, EstadoAlerta
from .serializers import (
    AlertaSerializer,
    AlertaUpdateSerializer,
    ConfiguracaoRegraInputSerializer,
)


class AlertaFilter(filters.FilterSet):
    desde = filters.IsoDateTimeFilter(field_name="aberto_em", lookup_expr="gte")
    ate = filters.IsoDateTimeFilter(field_name="aberto_em", lookup_expr="lte")
    provedor = filters.CharFilter(field_name="usina__conta_provedor__tipo")

    class Meta:
        model = Alerta
        fields = (
            "estado",
            "severidade",
            "regra",
            "usina",
            "inversor",
            "provedor",
            "desde",
            "ate",
        )


class AlertaViewSet(
    EmpresaQuerysetMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """Read + PATCH. Alertas são criados/resolvidos pelo motor automaticamente.

    O endpoint PATCH/PUT permite que o operador feche manualmente um alerta
    (`estado=resolvido`) ou ajuste severidade. Não há criação manual.
    """

    queryset = (
        Alerta.objects.all()
        .com_regra_desativada()
        .select_related("usina", "inversor", "usina__conta_provedor")
    )
    permission_classes = [AdminEmpresaOuSomenteLeitura]
    filterset_class = AlertaFilter
    search_fields = ("mensagem", "usina__nome", "inversor__numero_serie")
    ordering_fields = ("aberto_em", "atualizado_em", "severidade")
    ordering = ("-aberto_em",)

    def get_serializer_class(self):
        if self.action in ("update", "partial_update"):
            return AlertaUpdateSerializer
        return AlertaSerializer

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        """Marca o alerta como resolvido manualmente."""
        alerta = self.get_object()
        if alerta.estado != EstadoAlerta.RESOLVIDO:
            alerta.estado = EstadoAlerta.RESOLVIDO
            alerta.resolvido_em = djtz.now()
            alerta.save(update_fields=["estado", "resolvido_em", "atualizado_em"])
        return Response(AlertaSerializer(alerta).data)

    @action(detail=True, methods=["post"])
    def reconhecer(self, request, pk=None):
        """Marca o alerta como reconhecido (operador ciente, ainda não resolveu)."""
        alerta = self.get_object()
        if alerta.estado == EstadoAlerta.ABERTO:
            alerta.estado = EstadoAlerta.RECONHECIDO
            alerta.save(update_fields=["estado", "atualizado_em"])
        return Response(AlertaSerializer(alerta).data)


# ── Configuração de regras (F2 do plano configuracao-regras) ──────────────
#
# Endpoints sob `/api/alertas/configuracao-regras/`:
#
#   GET    /                        → lista todas as regras conhecidas
#                                     (overrides ∪ defaults). 1 linha por
#                                     regra registrada, sem dependência de
#                                     seed.
#   PUT    /<regra_nome>/           → upsert de override (ativa + severidade).
#   DELETE /<regra_nome>/           → remove override → volta aos defaults.
#   POST   /reset-todos/            → apaga todos os overrides da empresa.
#
# Permissão: leitura para qualquer membro, escrita só para admin via
# `AdminEmpresaOuSomenteLeitura`.

def _serializar_linha(cls, cfg):
    """Mescla classe da regra (defaults) com `ConfiguracaoRegra` (override).

    `cfg=None` → linha "virtual" usando defaults do código.
    `cfg` presente → override.
    `descricao` é a 1ª linha do docstring da classe (fallback string vazia).
    """
    descricao = ""
    if cls.__doc__:
        descricao = cls.__doc__.strip().split("\n", 1)[0].strip()
    return {
        "regra_nome": cls.nome,
        "ativa": cfg.ativa if cfg is not None else True,
        "severidade": (
            cfg.severidade if cfg is not None else cls.severidade_padrao
        ),
        "is_default": cfg is None,
        "severidade_default": cls.severidade_padrao,
        "ativa_default": True,
        "descricao": descricao,
        "severidade_dinamica": getattr(cls, "severidade_dinamica", False),
        "configurada_em": cfg.updated_at.isoformat() if cfg is not None else None,
    }


def _classes_de_regra():
    """Garante que o registry está carregado e devolve `regras_registradas()`.

    Reusa o `_carregar_regras` do motor (mesmo padrão dos commands em
    `apps/alertas/management/commands/`).
    """
    from apps.alertas.motor import _carregar_regras
    from apps.alertas.regras import regras_registradas

    _carregar_regras()
    return regras_registradas()


class ConfiguracaoRegraView(APIView):
    """`GET /api/alertas/configuracao-regras/` — lista regras + overrides.

    Sempre devolve uma linha por regra registrada (não depende de seed).
    Cada item traz `is_default` (bool) para a UI distinguir override de
    default e `severidade_dinamica` (bool) para desabilitar o select de
    severidade na UI quando a regra escala internamente.
    """

    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def get(self, request):
        empresa = empresa_do_request(request)
        if empresa is None:
            return Response(
                {"detail": "Empresa não resolvida do request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        overrides = {
            cr.regra_nome: cr
            for cr in ConfiguracaoRegra.objects.filter(empresa=empresa)
        }
        results = [
            _serializar_linha(cls, overrides.get(cls.nome))
            for cls in _classes_de_regra()
        ]
        return Response({"results": results})


class ConfiguracaoRegraDetalheView(APIView):
    """`PUT/DELETE /api/alertas/configuracao-regras/<regra_nome>/`.

    PUT é um upsert (`update_or_create`). Aceita payload mesmo para regras
    com `severidade_dinamica=True` — o motor ignora a severidade nesses
    casos, mas a API persiste sem reclamar (a UI controla a interação).

    DELETE é idempotente: se não há override, devolve 204 igualmente. UI
    pode usar como "reset para padrão" desta regra.
    """

    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def _validar_regra(self, regra_nome):
        nomes_validos = {cls.nome for cls in _classes_de_regra()}
        return regra_nome in nomes_validos

    def put(self, request, regra_nome):
        if not self._validar_regra(regra_nome):
            return Response(
                {"detail": f"Regra '{regra_nome}' não está registrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        empresa = empresa_do_request(request)
        if empresa is None:
            return Response(
                {"detail": "Empresa não resolvida do request."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ConfiguracaoRegraInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        cfg, _ = ConfiguracaoRegra.objects.update_or_create(
            empresa=empresa,
            regra_nome=regra_nome,
            defaults={
                "ativa": data["ativa"],
                "severidade": data["severidade"],
            },
        )
        # Resposta no mesmo schema da listagem — UI consome direto.
        cls = next(c for c in _classes_de_regra() if c.nome == regra_nome)
        return Response(_serializar_linha(cls, cfg))

    def delete(self, request, regra_nome):
        # DELETE não exige existência — comportamento idempotente típico.
        # Mas valida que a regra é conhecida; deletar override de regra
        # inexistente seria sintoma de UI/cliente quebrado.
        if not self._validar_regra(regra_nome):
            return Response(
                {"detail": f"Regra '{regra_nome}' não está registrada."},
                status=status.HTTP_404_NOT_FOUND,
            )
        empresa = empresa_do_request(request)
        if empresa is None:
            return Response(
                {"detail": "Empresa não resolvida do request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ConfiguracaoRegra.objects.filter(
            empresa=empresa, regra_nome=regra_nome,
        ).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ConfiguracaoRegraResetView(APIView):
    """`POST /api/alertas/configuracao-regras/reset-todos/`.

    Atalho idempotente para apagar todos os overrides da empresa de uma
    vez (volta tudo aos defaults do código). Aceita corpo vazio. Sempre
    retorna 204 mesmo sem nada para apagar.
    """

    permission_classes = [AdminEmpresaOuSomenteLeitura]

    def post(self, request):
        empresa = empresa_do_request(request)
        if empresa is None:
            return Response(
                {"detail": "Empresa não resolvida do request."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        ConfiguracaoRegra.objects.filter(empresa=empresa).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
