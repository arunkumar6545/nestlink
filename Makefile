# Nestlink — Developer Commands
# Usage: make <target>

SUPABASE := ./node_modules/.bin/supabase
PNPM     := pnpm

.PHONY: setup start stop db-push db-reset db-status seed dev dev-web dev-mobile help

## ─── First-time setup ────────────────────────────────────────────────────────

setup: ## Full first-time setup (install deps + init supabase)
	@echo "📦 Installing dependencies..."
	$(PNPM) install
	@echo "🗄️  Initialising Supabase (requires Docker Desktop)..."
	$(SUPABASE) init || true
	@echo ""
	@echo "✅ Setup complete! Run 'make start' to launch local Supabase."
	@echo "   Then run 'make db-push' to apply migrations."

## ─── Supabase local ─────────────────────────────────────────────────────────

start: ## Start local Supabase (requires Docker)
	@echo "🚀 Starting Supabase..."
	$(SUPABASE) start
	@echo ""
	@echo "📋 Copy these values into apps/web/.env.local and apps/mobile/.env.local:"
	$(SUPABASE) status

stop: ## Stop local Supabase
	$(SUPABASE) stop

db-push: ## Apply all migrations to local DB
	$(SUPABASE) db push --local
	@echo "✅ Migrations applied."

db-reset: ## Reset local DB and re-apply all migrations + seed
	$(SUPABASE) db reset --local
	@echo "✅ Database reset and seeded."

db-status: ## Show local Supabase connection info
	$(SUPABASE) status

seed: ## Run seed data only (003_seed_data.sql)
	$(SUPABASE) db execute --local --file supabase/migrations/003_seed_data.sql

super-admin: ## Promote a phone number to super admin (usage: make super-admin PHONE=+91XXXXXXXXXX)
	@test -n "$(PHONE)" || (echo "Usage: make super-admin PHONE=+91XXXXXXXXXX" && exit 1)
	$(SUPABASE) db execute --local --command "SELECT promote_to_super_admin('$(PHONE)');"
	@echo "✅ $(PHONE) is now a Super Admin."

functions-serve: ## Serve Edge Functions locally
	$(SUPABASE) functions serve --env-file .env

## ─── Run apps ────────────────────────────────────────────────────────────────

dev: ## Run web + mobile simultaneously
	$(PNPM) dev

dev-web: ## Run web app only (http://localhost:3000)
	$(PNPM) --filter web dev

dev-mobile: ## Run Expo mobile app
	$(PNPM) --filter mobile start

## ─── Build ───────────────────────────────────────────────────────────────────

build: ## Build all apps
	$(PNPM) build

build-web: ## Build web app
	$(PNPM) --filter web build

## ─── Git ─────────────────────────────────────────────────────────────────────

push: ## Stage all, commit with message, and push
	@read -p "Commit message: " msg; \
	git add -A && git commit -m "$$msg" && git push origin HEAD

## ─── Help ─────────────────────────────────────────────────────────────────────

help: ## Show all available commands
	@echo ""
	@echo "Nestlink Developer Commands"
	@echo "──────────────────────────"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""
