# 🚀 Fastify Gold Standard Starter

Production-ready Fastify starter template with TypeScript, Prisma, Docker, Prometheus, and the Golden Orchestrator pattern.

[![Built with Fastify Gold Standard](https://img.shields.io/badge/Built%20with-Fastify%20Gold%20Standard-blue?style=flat&logo=fastify)](https://github.com/DriftOS/fastify-starter)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen?logo=node.js)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🎉 **[Live Demo](https://fastify-starter-demo.driftos.dev)** - See it in action with Swagger docs

## 🚀 Deployment Options

### Quick Deploy (Demo/Testing)
**One-click deployment** - Great for demos and testing. Includes API + PostgreSQL only.

| Platform | Deploy Button | Time | Cost |
|----------|--------------|------|------|
| **Render** ⭐ | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy) | 3 min | ~$7/mo |
| **Railway** | [![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/fastify-starter) | 5 min | ~$5/mo |

### Full Production Stack (Recommended)
**Docker Compose on VPS** - Complete stack with Grafana dashboards and monitoring.

```bash
# One command - full production setup
npm run generate:dashboards
docker compose -f docker/docker-compose.yml up -d
```

✅ API + PostgreSQL + Prometheus + Grafana  
✅ Auto-generated dashboards work perfectly  
✅ ~$5-10/mo on DigitalOcean, Hetzner, or Linode

> 📖 **Full instructions:** See [DEPLOY.md](./DEPLOY.md) for all deployment options

## 🏆 Why This Starter?

Production-ready Fastify template with best practices, type safety, and Prometheus metrics built-in.

| Feature | This Starter | NestJS | Express | Other Fastify |
|---------|--------------|---------|---------|---------------|
| **Pipeline Architecture** | ✅ Built-in | ⚠️ Different | ❌ None | ❌ None |
| **Performance** | ⚡ Native Fastify | 🐢 Express under hood | 🐌 Express | ⚡ Fastify |
| **Type Safety** | ✅ Strict TypeScript | ✅ Good | ⚠️ Varies | ⚠️ Varies |
| **Metrics** | ✅ Prometheus built-in | ⚠️ Manual | ❌ Basic | ❌ Basic |
| **Docker** | ✅ Full stack | ⚠️ App only | ⚠️ Varies | ⚠️ Varies |

**Perfect for:**
- Production APIs that need to scale
- Teams that value developer experience
- Projects that require strong type safety

## ✨ Features

### Core Stack
- **Fastify** - High-performance web framework (4x faster than Express)
- **TypeScript** - Full type safety with strict mode
- **Prisma** - Type-safe database ORM with migrations
- **PostgreSQL** - Production database
- **Docker** - Full containerization
- **Prometheus** - Built-in metrics at `/metrics`
- **Swagger** - Auto-generated API documentation

### Architecture Patterns
- **Golden Orchestrator Pattern** - Pipeline-based business logic
- **Singleton Services** - Efficient resource management
- **Pure Operations** - Testable, composable functions
- **Performance Tracking** - Automatic metrics for every pipeline stage

### Developer Experience
- **ESLint & Prettier** - Consistent code formatting
- **Husky** - Pre-commit hooks
- **Hot Reload** - Fast development cycle with tsx
- **TypeBox** - Runtime validation with TypeScript types
- **Swagger/OpenAPI** - Auto-generated API documentation

### Production Ready
- **JWT Authentication** - Secure auth flow
- **Rate Limiting** - DDoS protection
- **CORS** - Configurable cross-origin support
- **Helmet** - Security headers
- **Health Checks** - Kubernetes-ready endpoints
- **Graceful Shutdown** - Clean process termination
- **Structured Logging** - Pino with correlation IDs
- **Environment Validation** - Fail fast on missing config

## 🏗️ Project Structure

```
fastify-gold-standard-starter/
├── src/
│   ├── core/
│   │   ├── orchestration/          # Golden orchestrator pattern
│   │   │   ├── base-orchestrator.ts
│   │   │   ├── performance-interceptor.ts
│   │   │   └── types.ts
│   │   └── hooks/                  # Fastify lifecycle hooks
│   ├── plugins/                    # Fastify plugins
│   │   ├── auth.ts                 # JWT authentication
│   │   ├── cors.ts                 # CORS configuration
│   │   ├── env.ts                  # Environment validation
│   │   ├── metrics.ts              # Prometheus metrics
│   │   ├── prisma.ts               # Database client
│   │   └── swagger.ts              # API documentation
│   ├── routes/                     # API endpoints
│   │   ├── health/                 # Health checks
│   │   ├── auth/                   # Authentication
│   │   ├── users/                  # User management
│   │   └── example/                # Example CRUD
│   ├── services/                   # Business logic
│   │   └── todo/                   # Example service
│   │       ├── orchestrator.ts     # Pipeline orchestrator
│   │       ├── operations/         # Pure functions
│   │       ├── types/              # TypeScript types
│   │       ├── __tests__/          # Co-located tests
│   │       └── index.ts            # Service facade
│   ├── utils/                      # Utilities
│   ├── app.ts                      # Fastify app setup
│   └── server.ts                   # Entry point
├── prisma/
│   ├── schema.prisma               # Database schema
│   └── migrations/                 # Database migrations
├── docker/
│   ├── docker-compose.yml          # Local development
│   ├── prometheus/                 # Prometheus config
│   └── grafana/                    # Grafana dashboards
├── scripts/
│   └── generate-dashboards.ts      # Auto-generate Grafana dashboards
├── Makefile                        # Make commands for common tasks
├── setup.sh                        # One-command setup script
└── .github/
    └── workflows/
        └── ci.yml                  # CI/CD pipeline
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+ LTS
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### 🎨 NEW: Service Generator

**Generate a complete service in 2 minutes!**

#### Interactive Mode
```bash
npm run generate

? What do you want to generate? Service
? Service name: Order
? Service type: CRUD (entity management: users, orders, products)
? Operations: validate,create,notify
? Include Prisma model? Yes
? Include API route? Yes
? Include tests? Yes

✨ Created 14 files with ~600 lines of production code!
```

#### CLI Mode (Non-Interactive)
```bash
# CRUD service (entity management)
node scripts/gen-service.mjs Order crud validate create notify

# Calculation service (compute operations)
node scripts/gen-service.mjs Scoring calculation validate calculate format
```

**Service Types:**
- **CRUD** - Entity management (users, orders, products) with Prisma integration
- **Calculation** - Compute operations (scoring, analysis, transformation) without database

See **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)** for full details.

After generating services, automatically create Grafana dashboards:

```bash
npm run generate:dashboards
```

This scans all orchestrators and generates performance monitoring dashboards automatically!

**Pre-built dashboards included:**
- **System Overview** - HTTP metrics, response times, error rates
- **Per-Service Dashboards** - Auto-generated from orchestrators

---

### Installation

1. **Clone the template**
```bash
git clone https://github.com/yourusername/fastify-gold-standard-starter.git
cd fastify-gold-standard-starter
```

2. **Run setup script**
```bash
./setup.sh
```

The script automatically:
- ✅ Installs dependencies
- ✅ Creates `.env` file
- ✅ Starts Docker services
- ✅ Runs database migrations
- ✅ Generates Grafana dashboards

3. **Start development server**
```bash
npm run dev
# Or use make commands:
make dev
```

**Done!** Your API is now running at:
- **API**: http://localhost:3000/api/v1
- **Swagger**: http://localhost:3000/documentation
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001 (admin/admin)

---

### 🎯 Daily Workflow (Like DriftOS!)

```bash
# Start everything (one command!)
make up          # Starts Docker + runs migrations + generates dashboards

# Start dev server (in another terminal)
make dev

# Test the API (in another terminal)
make test-api    # Automated tests with auth

# Open Grafana
make grafana

# Stop everything
make down
```

### 🔥 See Dashboards In Action

**Light up your monitoring in 3 steps:**

```bash
# Terminal 1: Start API
npm run dev

# Terminal 2: Generate realistic traffic
npm run load-test

# Browser: Watch the magic
open http://localhost:3001
```

The load tester will:
- ✅ Authenticate automatically
- ✅ Send randomized requests (realistic traffic patterns)
- ✅ Respect rate limits (no 429 errors)
- ✅ Display live stats (requests, latency, success rate)

Watch your dashboards update in real-time! All operations visible, all metrics accurate, zero configuration.

---

### 🎯 API Endpoints

**Public Routes (No Auth):**
- `GET /api/v1/health` - Health check
- `GET /api/v1/ready` - Readiness probe
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/register` - User registration

**Protected Routes (Auth Required):**
- `GET /api/v1/users/me` - Get current user
- `POST /api/v1/todos` - **Create todo (Golden Orchestrator pattern) ⭐**
- `GET /api/v1/todos` - List todos
- `POST /api/v1/examples` - Create example (direct Prisma access)
- `GET /api/v1/examples` - List examples (direct Prisma access)

## 📚 Documentation

- **[docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)** - Setup, first service, commands
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - Golden Orchestrator pattern explained

---

## 🚀 Using This Template

### 1. Click "Use this template" on GitHub

### 2. Add Repository Description
```
Production-ready Fastify starter with TypeScript, Prisma, Docker, Prometheus & the Golden Orchestrator pattern. Includes CLI generator for instant service scaffolding.
```

### 3. Add Topics
```
fastify, typescript, starter-template, orchestrator-pattern, 
prisma, docker, prometheus, grafana, cli-generator, production-ready
```

### 4. Clone and Start
```bash
git clone your-repo-url
cd your-repo
./setup.sh
make up
make dev
```

## 🏗️ Golden Orchestrator Pattern

The Golden Orchestrator pattern provides a structured way to handle complex business logic through pipelines.

**See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for complete examples and deep dive.**

### Quick Example

```typescript
// Define pipeline context
interface TodoPipelineContext extends OperationContext {
  input: CreateTodoInput;
  todo?: Todo;
}

// Create orchestrator
class CreateTodoOrchestrator extends BaseOrchestrator<
  TodoPipelineContext,
  Todo,
  CreateTodoInput
> {
  protected getPipeline(): PipelineStage<TodoPipelineContext>[] {
    return [
      { name: 'validate-input', operation: validateInput, critical: true },
      { name: 'create-todo', operation: createTodo, critical: true },
      { name: 'notify-creation', operation: notifyCreation, critical: false },
    ];
  }
}

// Pure operation function
async function createTodo(context: TodoPipelineContext): Promise<TodoPipelineContext> {
  const todo = await prisma.todo.create({
    data: context.input
  });
  context.todo = todo;
  return context;
}
```

### Benefits
- **Testability**: Each operation is a pure function
- **Observability**: Automatic performance tracking
- **Composability**: Reuse operations across orchestrators
- **Reliability**: Critical vs non-critical operations
- **Maintainability**: Clear separation of concerns

## 📊 Monitoring & Observability

### 🎨 Automatic Dashboard Generation

**Generate beautiful Grafana dashboards in seconds!**

```bash
npm run generate:dashboards
```

Creates production-ready dashboards with:
- ✅ Avg Response Time, Success Rate, P95 Latency, Ops/min
- ✅ Stacked area charts showing operation breakdown
- ✅ Time-range aware sparklines
- ✅ All metrics extracted automatically from your orchestrator code

**See [docs/AUTOMATIC_DASHBOARDS.md](./docs/AUTOMATIC_DASHBOARDS.md) for details.**

### 🔥 Load Testing

Simulate production traffic and watch your dashboards light up!

```bash
npm run load-test
```

Features:
- ✅ Rate-limit aware (respects 100 req/min limit)
- ✅ Randomized traffic (±30% jitter for realistic patterns)
- ✅ Authentication built-in
- ✅ Configurable RPS and duration
- ✅ Live stats display

```bash
# Custom load
RPS=2 DURATION=5 npm run load-test

# Disable randomization
RANDOMIZE=false npm run load-test
```

### Prometheus Metrics
- **HTTP metrics:** Request duration, count, status codes
- **Orchestrator metrics:** Pipeline duration, stage latency, success rate
- **System metrics:** Active connections, memory, CPU
- **Custom metrics:** Business-specific tracking

### Grafana Dashboards
- **System Overview:** HTTP performance, P95 latency, error rates, requests/min
- **Service Dashboards:** Auto-generated per orchestrator with operation breakdown
- **Time-range aware:** All metrics adapt to selected time range
- **Production-ready:** 5-30s auto-refresh, proper sparklines

### Health Checks
- `/health` - Basic health check
- `/ready` - Readiness probe (checks DB connection)

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui
```

## 📦 Production Deployment

### Using Docker

```bash
# Build production image
docker build -t fastify-app .

# Run container
docker run -p 3000:3000 --env-file .env fastify-app
```

### Using PM2

```bash
# Build the application
npm run build

# Start with PM2
pm2 start dist/server.js --name fastify-app
```

### Environment Variables

Key environment variables for production:

```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-secret-key
RATE_LIMIT_MAX=100
CORS_ORIGIN=https://yourdomain.com
```

## 🛠️ Scripts

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run start         # Start production server
npm run typecheck     # TypeScript type checking
npm run lint          # Run ESLint
npm run format        # Format code with Prettier
npm run db:migrate    # Run database migrations
npm run db:studio     # Open Prisma Studio
npm run docker:up     # Start Docker services
npm run docker:down   # Stop Docker services
```

## 🔒 Security

- JWT-based authentication
- Rate limiting on all endpoints
- Input validation with TypeBox
- SQL injection protection via Prisma
- XSS protection with Helmet
- CORS properly configured
- Environment variables validation

## 🏅 Built With This Starter

Show that your project uses the Fastify Gold Standard! Add this badge to your README:

```markdown
[![Built with Fastify Gold Standard](https://img.shields.io/badge/Built%20with-Fastify%20Gold%20Standard-blue?style=flat&logo=fastify)](https://github.com/DriftOS/fastify-starter)
```

[![Built with Fastify Gold Standard](https://img.shields.io/badge/Built%20with-Fastify%20Gold%20Standard-blue?style=flat&logo=fastify)](https://github.com/DriftOS/fastify-starter)

**Benefits:**
- 🔗 Builds backlinks to help others discover this starter
- 📈 Social proof shows you're using production-grade architecture
- 🤝 Supports the open-source community

## 🌟 Used By

Projects and companies using this starter:

- **[DriftOS](https://driftos.dev)** - AI-powered branching memory system
- **Your Project Here** - [Submit a PR](https://github.com/DriftOS/fastify-starter/pulls) to be featured!

*Using this starter in production? We'd love to feature you! Submit a PR with your project.*

## ❓ When to Use Orchestrators vs Direct Access

**Use the Orchestrator Pattern (TodoService) when:**
- ✅ Business logic has multiple steps
- ✅ You need performance tracking per operation
- ✅ Operations might fail independently (critical vs non-critical)
- ✅ Logic will grow in complexity
- ✅ You want automatic Grafana dashboards

**Use Direct Access (ExampleService - being removed) when:**
- ✅ Simple CRUD operations
- ✅ Single database query
- ✅ No complex business logic
- ✅ Performance tracking not needed

> **Note:** The `/api/v1/examples` routes demonstrate simple CRUD without orchestrators. These will be removed in v2.0. For production apps, we recommend the orchestrator pattern for all business logic to ensure consistent observability.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Fastify](https://www.fastify.io/) - Fast and low overhead web framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [TypeBox](https://github.com/sinclairzx81/typebox) - JSON Schema Type Builder

## 📧 Support

For support, email hello@driftos.dev or open an issue in the repository.

---

Built with ❤️ using the Fastify Gold Standard architecture
