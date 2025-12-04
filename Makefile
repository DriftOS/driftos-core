.PHONY: help setup up down restart logs dev test test-watch lint format typecheck build clean generate db-extensions db-migrate db-studio db-push db-reset docker-clean all

# Default target - show help
help:
	@echo "🚀 Fastify Gold Standard Starter - Make Commands"
	@echo ""
	@echo "⚡ Quick Start:"
	@echo "  make up             - 🎯 Start everything (Docker + DB + migrations)"
	@echo "  make dev            - Start development server"
	@echo "  make test-api       - Test API with authentication (requires server running)"
	@echo "  make grafana        - Open Grafana dashboard"
	@echo "  make down           - Stop all services"
	@echo ""
	@echo "📦 Setup & Installation:"
	@echo "  make setup          - Initial project setup (run once)"
	@echo "  make install        - Install dependencies only"
	@echo ""
	@echo "🐳 Docker Services:"
	@echo "  make docker-up      - Start Docker services only"
	@echo "  make restart        - Restart all Docker services"
	@echo "  make logs           - View Docker logs"
	@echo ""
	@echo "🚀 Development:"
	@echo "  make dev            - Start development server"
	@echo "  make build          - Build for production"
	@echo ""
	@echo "🧪 Testing & Quality:"
	@echo "  make test           - Run all tests"
	@echo "  make test-watch     - Run tests in watch mode"
	@echo "  make lint           - Run ESLint"
	@echo "  make format         - Format code with Prettier"
	@echo "  make typecheck      - Run TypeScript type checking"
	@echo ""
	@echo "🗄️  Database:"
	@echo "  make db-extensions  - Install PostgreSQL extensions (pgvector, etc.)"
	@echo "  make db-migrate     - Run Prisma migrations"
	@echo "  make db-studio      - Open Prisma Studio"
	@echo "  make db-push        - Push schema changes"
	@echo "  make db-reset       - Reset database (WARNING: destructive)"
	@echo ""
	@echo "🎨 Generators:"
	@echo "  make generate       - Generate service (interactive)"
	@echo "  make dashboards     - Generate Grafana dashboards"
	@echo ""
	@echo "🧹 Cleanup:"
	@echo "  make clean          - Remove build artifacts"
	@echo "  make docker-clean   - Remove Docker volumes (WARNING: destructive)"
	@echo ""
	@echo "⚡ Quick Combos:"
	@echo "  make all            - setup + up + db-migrate + dev"
	@echo ""

# Initial setup (run once)
setup:
	@echo "🚀 Running initial setup..."
	@./setup.sh

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@npm install

# Docker commands
docker-up:
	@echo "🐳 Starting Docker services..."
	@npm run docker:up

down:
	@echo "🛑 Stopping Docker services..."
	@npm run docker:down

restart: down docker-up

logs:
	@echo "📜 Showing Docker logs..."
	@npm run docker:logs

# Initialize PostgreSQL extensions (required for pgvector, etc.)
db-extensions:
	@echo "🔌 Ensuring PostgreSQL extensions are installed..."
	@docker exec fastify_postgres psql -U postgres -d fastify_starter -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pgcrypto"; CREATE EXTENSION IF NOT EXISTS "vector";' 2>/dev/null || true

# Main entry point - like DriftOS!
up: docker-up
	@echo "⏳ Waiting for PostgreSQL to be ready..."
	@sleep 8
	@$(MAKE) db-extensions
	@echo "🗄️  Pushing database schema..."
	@npm run db:push
	@echo "📊 Generating Grafana dashboards..."
	@npm run generate:dashboards || echo "⚠️  No orchestrators found yet"
	@echo ""
	@echo "✨ Everything is ready!"
	@echo ""
	@echo "📍 Services running:"
	@echo "   • API:         http://localhost:3000"
	@echo "   • Swagger:     http://localhost:3000/documentation"
	@echo "   • Prometheus:  http://localhost:9090"
	@echo "   • Grafana:     http://localhost:3001 (admin/admin)"
	@echo ""
	@echo "🚀 Start the dev server in another terminal:"
	@echo "   make dev"
	@echo ""
	@echo "Or open Grafana:"
	@echo "   make grafana"
	@echo ""

# Open Grafana in browser
grafana:
	@echo "🎨 Opening Grafana..."
	@open http://localhost:3001 || xdg-open http://localhost:3001 || echo "Open http://localhost:3001 in your browser"

# Test the API with authentication
test-api:
	@echo "🧪 Testing API endpoints..."
	@./scripts/test-api.sh

# Development
dev:
	@echo "🚀 Starting development server..."
	@npm run dev

build:
	@echo "🔨 Building for production..."
	@npm run build

# Testing & Quality
test:
	@echo "🧪 Running tests..."
	@npm test

test-watch:
	@echo "👀 Running tests in watch mode..."
	@npm run test:watch

lint:
	@echo "🔍 Running ESLint..."
	@npm run lint

format:
	@echo "✨ Formatting code..."
	@npm run format

typecheck:
	@echo "📝 Type checking..."
	@npm run typecheck

# Database
db-migrate:
	@echo "🗄️  Running database migrations..."
	@npm run db:migrate

db-studio:
	@echo "🎨 Opening Prisma Studio..."
	@npm run db:studio

db-push:
	@echo "⬆️  Pushing schema changes..."
	@npm run db:push

db-reset:
	@echo "⚠️  WARNING: This will delete all data!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		npx prisma migrate reset --force; \
	fi

# Generators
generate:
	@echo "🎨 Running service generator..."
	@npm run generate

dashboards:
	@echo "📊 Generating Grafana dashboards..."
	@npm run generate:dashboards

# Cleanup
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf dist node_modules/.cache

docker-clean:
	@echo "⚠️  WARNING: This will delete all Docker volumes!"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		docker-compose -f docker/docker-compose.yml down -v; \
	fi

# Quick all-in-one
all: setup up db-migrate
	@echo ""
	@echo "✅ All set! Run 'make dev' to start the server"
