.PHONY: infra-up infra-down infra-logs

infra-up:
	docker compose --env-file .env -f compose.dev.yml up -d

infra-down:
	docker compose --env-file .env -f compose.dev.yml down

infra-logs:
	docker compose --env-file .env -f compose.dev.yml logs -f
