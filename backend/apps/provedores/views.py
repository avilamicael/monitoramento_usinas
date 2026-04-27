from __future__ import annotations

from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api import EmpresaModelViewSet

from .models import ContaProvedor
from .serializers import ContaProvedorSerializer


class ContaProvedorViewSet(EmpresaModelViewSet):
    queryset = ContaProvedor.objects.all()
    serializer_class = ContaProvedorSerializer
    filterset_fields = ("tipo", "is_active", "precisa_atencao")
    search_fields = ("rotulo",)
    ordering_fields = ("rotulo", "tipo", "ultima_sincronizacao_em")
    ordering = ("tipo", "rotulo")

    @action(detail=True, methods=["post"])
    def coletar_agora(self, request, pk=None):
        """Dispara uma coleta manual da conta. Útil para testar credenciais
        novas ou forçar sync após editar configuração."""
        from apps.coleta.tasks import sincronizar_conta_provedor

        conta = self.get_object()
        async_result = sincronizar_conta_provedor.delay(str(conta.pk))
        return Response({"task_id": async_result.id, "conta_id": str(conta.pk)})
