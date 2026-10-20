.PHONY: setup dev services stop lint test build contract owner
setup:
	./scripts/setup.sh
dev: services
	./scripts/pnpm.sh dev
services:
	./scripts/docker.sh compose up -d --wait mysql redis mailpit
	./scripts/docker.sh compose --parallel 1 up -d --force-recreate api worker scheduler
stop:
	./scripts/docker.sh compose stop
lint:
	./scripts/pnpm.sh lint
	./scripts/docker.sh compose exec -T api vendor/bin/pint --test
	./scripts/docker.sh compose exec -T api vendor/bin/phpstan analyse --memory-limit=1G
contract:
	./scripts/pnpm.sh contract:validate
	./scripts/pnpm.sh contract:check
	./scripts/pnpm.sh contract:examples
test:
	./scripts/test-api.sh
	./scripts/pnpm.sh typecheck
	$(MAKE) contract
build:
	./scripts/pnpm.sh build
owner:
	./scripts/docker.sh compose exec api php artisan auraflare:owner
