.PHONY: up down logs shell migrate makemigrations test lint install-backend install-frontend fmt

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f --tail=200

shell:
	docker compose exec backend python manage.py shell

migrate:
	docker compose exec backend python manage.py migrate

makemigrations:
	docker compose exec backend python manage.py makemigrations

createsuperuser:
	docker compose exec backend python manage.py createsuperuser

test:
	docker compose exec backend pytest

lint:
	docker compose exec backend ruff check .
	docker compose exec frontend npm run lint

fmt:
	docker compose exec backend ruff format .
	docker compose exec frontend npm run format

install-backend:
	cd backend && pip install -r requirements-dev.txt

install-frontend:
	cd frontend && npm install
