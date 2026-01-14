# Port Allocation

This document tracks all port assignments across the DriftOS ecosystem to prevent conflicts.

## DriftOS Core Services

### Main Application Ports
- **3000** - driftos-gateway (API Gateway - main entry point that proxies to other services)
- **3001** - driftos-core (LLM service)
  - Includes `/metrics` endpoint for Prometheus
- **3002** - driftos-embed-enterprise (Embedding/Vector service)

### Supporting Services

#### DriftOS Core Support (301x range)
- **3010** - Grafana (Monitoring dashboards for driftos-core)
  - **User/Pass**: admin/admin

#### DriftOS Embed Support (302x range)
- **3020** - Grafana (Monitoring dashboards for driftos-embed-enterprise)
  - **User/Pass**: admin/admin

#### Monitoring Infrastructure (9xxx range)
- **9091** - Prometheus (Metrics collection for driftos-core)

### Database
- **5433** - PostgreSQL (Docker container)
  - Internal container port: 5432
  - External/host port: 5433

### Other/Future Services
- **3004-3009** - Reserved for future DriftOS services (website, demo, etc.)
- **8100** - Embedding service (alternative/legacy)

## Port Organization Strategy

Services are organized by prefix:
- **3000**: Gateway (main entry point)
- **3001**: Core LLM service
- **3002**: Embed service
- **301x**: Core supporting services (Grafana, etc.)
- **302x**: Embed supporting services
- **9xxx**: Monitoring infrastructure (Prometheus, etc.)

## Port Conflict History

### Resolved Conflicts
1. **Core Grafana (3002 → 3010)**: Originally on 3002, conflicted with driftos-embed-enterprise. Moved to 3010 (301x range).
2. **Embed Grafana (3002 → 3020)**: Originally on 3002, conflicted with driftos-embed-enterprise service. Moved to 3020 (302x range).
3. **Gateway (3003 → 3000)**: Moved to 3000 to be the main entry point.

## Quick Reference

| Service | Port | Access |
|---------|------|--------|
| **Main Services** | | |
| driftos-gateway | 3000 | http://localhost:3000 |
| driftos-core | 3001 | http://localhost:3001 |
| driftos-embed-enterprise | 3002 | http://localhost:3002 |
| **Core Support (301x)** | | |
| Grafana (core monitoring) | 3010 | http://localhost:3010 |
| **Embed Support (302x)** | | |
| Grafana (embed monitoring) | 3020 | http://localhost:3020 |
| **Monitoring (9xxx)** | | |
| Prometheus | 9091 | http://localhost:9091 |
| **Database** | | |
| PostgreSQL | 5433 | localhost:5433 |
| **Other Services** | | |
| driftos-website | 3004 | http://localhost:3004 |
| driftos-demo | 3005 | http://localhost:3005 |
| Future services | 3006-3009 | |
| Embedding (alt/legacy) | 8100 | http://localhost:8100 |

## Environment Variables

To customize ports, set these in your `.env` file:

```bash
# Application
PORT=3001

# Monitoring
GRAFANA_PORT=3010
PROMETHEUS_PORT=9091

# Database
# See DATABASE_URL for PostgreSQL connection string
```

## Docker Compose Services

Services defined in `docker/docker-compose.yml`:
- **postgres**: 5433:5432
- **prometheus**: 9091:9090
- **grafana**: 3010:3000

## Notes

- All DriftOS services (core, embed, llm, gateway, website, demo) use ports in the **3000-3006** range
- Monitoring tools (Grafana, Prometheus) use separate port ranges
- PostgreSQL uses **5433** (not 5432) to avoid conflicts with local PostgreSQL installations
- The gateway (3003) is the main entry point and proxies to other services
- Health check endpoints should be public (no auth required) to detect service availability
