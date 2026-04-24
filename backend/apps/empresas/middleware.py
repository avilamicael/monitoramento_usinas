from __future__ import annotations

from collections.abc import Callable

from django.http import HttpRequest, HttpResponse


class EmpresaMiddleware:
    """Injeta `request.empresa` a partir do usuário autenticado.

    Views DRF devem sempre derivar o escopo de `request.empresa` em vez de
    confiar em parâmetros vindos do cliente.
    """

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        user = getattr(request, "user", None)
        request.empresa = (
            getattr(user, "empresa", None) if user and user.is_authenticated else None
        )
        return self.get_response(request)
