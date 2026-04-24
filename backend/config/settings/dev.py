from .base import *  # noqa: F401,F403
from .base import INSTALLED_APPS, MIDDLEWARE, env

DEBUG = True
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [*INSTALLED_APPS, "debug_toolbar"]
MIDDLEWARE = ["debug_toolbar.middleware.DebugToolbarMiddleware", *MIDDLEWARE]

INTERNAL_IPS = ["127.0.0.1"]

CORS_ALLOW_ALL_ORIGINS = True

EMAIL_BACKEND = env("EMAIL_BACKEND", default="django.core.mail.backends.console.EmailBackend")
