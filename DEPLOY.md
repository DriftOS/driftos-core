# 🚀 Deployment Guide

## Live Demo

The live demo is hosted at: **[fastify-starter-demo.driftos.dev](https://fastify-starter-demo.driftos.dev)**

**What's included:**
- ✅ Full API with Swagger docs
- ✅ Prometheus metrics endpoint
- ✅ PostgreSQL database

---

## 🏆 Recommended: Full Production Stack (VPS)

**For real production deployments** - Complete stack with monitoring and dashboards.

### What You Get:
- ✅ **API** - Your Fastify application
- ✅ **PostgreSQL** - Production database
- ✅ **Prometheus** - Metrics collection
- ✅ **Grafana** - Auto-generated dashboards
- ✅ **All services networked** via Docker Compose
- ✅ **Dashboard generation works perfectly**

### Prerequisites:
- A VPS (DigitalOcean, Linode, Hetzner, AWS EC2, etc.)
- Docker & Docker Compose installed
- Domain (optional, for HTTPS)

### Deployment Steps:

```bash
# 1. SSH into your VPS
ssh root@your-server-ip

# 2. Install Docker (if not installed)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 3. Clone your repo
git clone https://github.com/your-username/your-repo.git
cd your-repo

# 4. Set up environment
cp .env.example .env
nano .env  # Update JWT_SECRET, DATABASE_URL, etc.

# 5. Generate Grafana dashboards
npm install
npm run generate:dashboards

# 6. Start everything!
docker compose -f docker/docker-compose.yml up -d

# 7. Check status
docker compose -f docker/docker-compose.yml ps
```

### Access Your Stack:

- **API:** `http://your-server-ip:8080`
- **Swagger:** `http://your-server-ip:8080/documentation`
- **Grafana:** `http://your-server-ip:3001` (admin/admin)
- **Prometheus:** `http://your-server-ip:9090`
- **Metrics:** `http://your-server-ip:8080/metrics`

### Cost:
- **DigitalOcean Droplet:** $6/mo (2GB RAM)
- **Hetzner Cloud:** €4.51/mo (2GB RAM)
- **Linode:** $5/mo (1GB RAM - sufficient for starter projects)

### Optional: Add HTTPS with Caddy

```bash
# Install Caddy
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install caddy

# Configure reverse proxy
cat > /etc/caddy/Caddyfile << EOF
your-domain.com {
    reverse_proxy localhost:8080
}
EOF

# Start Caddy
systemctl enable caddy
systemctl start caddy
```

Now your API is at `https://your-domain.com` with automatic SSL! 🎉

---

## Quick Deploy Options (Demo/Testing)

**For demos and quick testing** - App + PostgreSQL only (no Grafana/Prometheus).

## Platform Comparison

| Platform | One-Click? | Cost | Best For |
|----------|-----------|------|----------|
| **Render** | ✅ Yes (`render.yaml`) | ~$7/mo | **Recommended** |
| Railway | ⚠️ Manual setup | ~$5/mo | Simple apps |
| Fly.io | ⚡ CLI | ~$10/mo | Docker experts |

---

## Quick Deploy Options

### 🏆 Best: Render (One-Click)

**⚡ TRUE one-click deployment**

1. Push `render.yaml` to your repo
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" → "Blueprint"
4. Connect your repo
5. **DONE!** Render deploys: App + PostgreSQL

**Cost:** ~$7/month  
**Time:** 3 minutes

---

### Option 1: Railway (Manual Setup)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/fastify-starter)

**Setup Steps:**

1. Click the button above
2. Connect your GitHub account
3. Click "Add Service" → "PostgreSQL"
4. Railway auto-sets `DATABASE_URL` ✅
5. Set `JWT_SECRET` to a random string
6. Deploy!

**Access:**
- API: `https://your-app.railway.app/`
- Swagger: `https://your-app.railway.app/documentation`
- Metrics: `https://your-app.railway.app/metrics`

**Cost:** ~$5/month

---

### Option 2: Render (Free Tier Available)

1. Fork this repository
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New +" → "Web Service"
4. Connect your forked repo
5. Configure:
   ```
   Build Command: npm run build
   Start Command: npm start
   ```
6. Add PostgreSQL database (free tier)
7. Set environment variables
8. Deploy!

**Cost:** Free tier available, ~$7/month for production

---

### Option 3: Fly.io (Production-Grade)

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Initialize app
fly launch

# Add PostgreSQL
fly postgres create

# Deploy
fly deploy
```

**Cost:** ~$10/month with generous free tier

---

### Option 4: Docker + Any VPS

```bash
# Clone repo
git clone https://github.com/DriftOS/fastify-starter.git
cd fastify-starter

# Set environment variables
cp .env.example .env
# Edit .env with your values

# Build and start
docker-compose up -d

# Your app is running!
# API: http://your-vps-ip:3000
# Grafana: http://your-vps-ip:3001
# Prometheus: http://your-vps-ip:9090
```

**Cost:** Varies by VPS provider (~$5-20/month)

---

## Environment Variables for Production

Required:
```bash
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=your-super-secret-key-min-32-chars
```

Recommended:
```bash
# Rate Limiting
RATE_LIMIT_MAX=1000
RATE_LIMIT_TIME_WINDOW=60000

# CORS
CORS_ORIGIN=https://yourdomain.com
CORS_CREDENTIALS=true

# Monitoring
METRICS_ENABLED=true
SWAGGER_ENABLED=true
```

---

## Post-Deployment Checklist

- [ ] SSL/TLS certificate configured
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Health checks responding
- [ ] Metrics endpoint accessible
- [ ] Grafana dashboards loading
- [ ] Rate limiting working
- [ ] CORS configured correctly
- [ ] Logs accessible
- [ ] Backup strategy in place

---

## Monitoring Your Production Deploy

### Grafana Dashboards

Access: `https://your-domain.com:3001`

Default credentials (CHANGE THESE!):
- Username: `admin`
- Password: `admin`

**Available Dashboards:**
1. System Overview - HTTP metrics, P95 latency, error rates
2. Service Dashboards - Auto-generated per orchestrator

### Prometheus Metrics

Access: `https://your-domain.com:9090`

**Key Metrics:**
- `http_request_duration_seconds` - Request latency
- `http_requests_total` - Total requests
- `orchestrator_pipeline_duration_ms` - Pipeline performance
- `orchestrator_stage_latency_ms` - Per-operation latency

### Health Checks

```bash
# Basic health
curl https://your-domain.com/health

# Readiness (includes DB check)
curl https://your-domain.com/ready

# Metrics
curl https://your-domain.com/metrics
```

---

## Scaling Your Deployment

### Horizontal Scaling

**Railway/Render:**
- Increase instance count in dashboard
- Load balancer automatically configured

**Docker/K8s:**
```bash
docker-compose up --scale app=3
```

### Database Scaling

1. Enable connection pooling (already configured via Prisma)
2. Add read replicas for read-heavy workloads
3. Consider PgBouncer for connection management

### Caching Layer

Add Redis for:
- Session storage
- API response caching
- Rate limiting (distributed)

---

## Troubleshooting

### Railway: "env must have required property 'DATABASE_URL'"

**Solution:** You need to add PostgreSQL as a separate service!

1. Go to your Railway project
2. Click "Add Service" (top right)
3. Select "PostgreSQL"
4. Railway auto-sets `DATABASE_URL` ✅
5. Redeploy

**Why?** Railway doesn't run `docker-compose.yml`. PostgreSQL must be a separate Railway service.

### App Won't Start (Local)

```bash
# Check logs
docker-compose logs app

# Common issues:
# - DATABASE_URL not set
# - Missing migrations
# - Port already in use
```

### Database Connection Errors

```bash
# Test connection
npm run db:studio

# Run migrations
npm run db:migrate
```

### Grafana Dashboards Empty

```bash
# Generate dashboards
npm run generate:dashboards

# Restart Grafana
docker-compose restart grafana
```

---

## Production Optimizations

### Performance

- [ ] Enable HTTP/2
- [ ] Configure CDN for static assets
- [ ] Set up database indexes
- [ ] Enable gzip compression
- [ ] Configure caching headers

### Security

- [ ] Rotate JWT secrets regularly
- [ ] Set up firewall rules
- [ ] Enable DDoS protection
- [ ] Configure security headers
- [ ] Set up fail2ban

### Monitoring

- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure error tracking (Sentry)
- [ ] Set up log aggregation (DataDog, LogRocket)
- [ ] Create Grafana alerts
- [ ] Set up PagerDuty/on-call rotation

---

## Need Help?

- 📧 Email: hello@driftos.dev
- 💬 GitHub Issues: [Open an issue](https://github.com/DriftOS/fastify-starter/issues)
- 📖 Docs: [Documentation](./docs/)

---

**Pro Tip:** Use the load tester (`npm run load-test`) to verify your deployment can handle production traffic before going live!
