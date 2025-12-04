# 📊 Automatic Dashboard Generation

## 🎯 100% Automatic - Zero Configuration

The dashboard generation is **completely automatic**. You don't need to configure metrics or dashboard layouts manually.

## How It Works

### 1. Generate a Service

```bash
npm run generate
# Choose "service"
# Enter service name: "User"
# Choose operations: validateInput, fetchUser, enrichData
```

### 2. Run Dashboard Generator

```bash
npm run generate:dashboards
```

That's it! The generator will:

1. ✅ Scan your orchestrator file (`CreateUserOrchestrator`)
2. ✅ Extract the service name from the class name
3. ✅ Extract operation names from `getPipeline()`
4. ✅ Generate a beautiful Grafana dashboard automatically

## What Gets Auto-Generated

### Dashboard Components

**4 Stat Cards:**
- Avg Response Time
- Success Rate
- P95 Latency
- Avg Operations/min

**Stacked Area Chart (Timeseries):**
- Shows latency breakdown per operation over time
- Smooth line interpolation with 70% fill opacity
- Tooltip always shows ALL operations (no disappearing!)
- Legend on right with mean/max values
- Reveals performance trends and patterns

### Prometheus Queries

The generator creates queries automatically:

```promql
# Pipeline duration
orchestrator_pipeline_duration_ms{service="CreateUserOrchestrator"}

# Stage latency (per operation)
orchestrator_stage_latency_ms{service="CreateUserOrchestrator",stage="validate-input"}
orchestrator_stage_latency_ms{service="CreateUserOrchestrator",stage="fetch-user"}
orchestrator_stage_latency_ms{service="CreateUserOrchestrator",stage="enrich-data"}
```

**No manual configuration needed!** The metrics are automatically recorded by `BaseOrchestrator`.

## The Magic

### In Your Orchestrator

```typescript
export class CreateUserOrchestrator extends BaseOrchestrator<...> {
  constructor() {
    super({
      name: 'CreateUserOrchestrator', // ← Used for service label
      enableMetrics: true, // ← Enables automatic metrics
    });
  }

  protected getPipeline() {
    return [
      {
        name: 'validate-input', // ← Used for stage label
        operation: validateInput,
      },
      {
        name: 'fetch-user', // ← Used for stage label
        operation: fetchUser,
      },
      {
        name: 'enrich-data', // ← Used for stage label
        operation: enrichData,
      },
    ];
  }
}
```

### BaseOrchestrator Records Metrics Automatically

When `enableMetrics: true`, BaseOrchestrator records:

```typescript
// Pipeline-level metrics
OrchestratorMetrics.pipelineDuration.observe(
  { service: 'CreateUserOrchestrator', status: 'success' },
  duration
);

// Stage-level metrics
OrchestratorMetrics.stageLatency.observe(
  { service: 'CreateUserOrchestrator', stage: 'validate-input' },
  stageDuration
);
```

### Dashboard Generator Extracts Everything

```typescript
// Scans orchestrator file
const className = 'CreateUserOrchestrator';
const serviceName = className; // Full name for queries

// Extracts from getPipeline()
const stages = [
  { name: 'validate-input', displayName: 'Validate Input' },
  { name: 'fetch-user', displayName: 'Fetch User' },
  { name: 'enrich-data', displayName: 'Enrich Data' },
];

// Generates perfect dashboard with correct queries!
```

## Why This Is Better Than DriftOS

**DriftOS:** Requires manual `metricName` per operation
```typescript
{
  name: 'fetchUser',
  metricName: 'user_fetch_user_ms', // ← Manual configuration
  fn: ops.fetchUser
}
```

**Starter:** Completely automatic with generic metrics
```typescript
{
  name: 'fetch-user', // ← This is ALL you need!
  operation: fetchUser,
}
```

Generic metrics with labels are:
- ✅ More consistent
- ✅ Easier to query
- ✅ Zero configuration
- ✅ Impossible to have mismatches

## Workflow

1. **Generate service:** `npm run generate`
2. **Implement operations:** Add your business logic
3. **Generate dashboards:** `npm run generate:dashboards`
4. **Done!** Dashboard automatically shows all metrics

**No metric configuration. No dashboard tweaking. Just works!** ✨

## Example: Adding New Operation

### Before (Manual Approach)
```typescript
// 1. Add operation to pipeline
{
  name: 'sendNotification',
  metricName: 'user_send_notification_ms', // ← Remember to add this!
  operation: sendNotification
}

// 2. Update dashboard JSON manually
// 3. Make sure metricName matches everywhere
// 4. Hope you didn't make a typo
```

### After (Automatic Approach)
```typescript
// 1. Add operation to pipeline
{
  name: 'send-notification', // ← That's it!
  operation: sendNotification
}

// 2. Run: npm run generate:dashboards
// 3. Done! Dashboard updated automatically ✅
```

## Viewing Your Dashboards

1. Start services: `make up`
2. Start dev server: `make dev`
3. Generate metrics: `make test-api`
4. Open Grafana: http://localhost:3001 (admin/admin)
5. Dashboards → Browse → Your Service Performance

**All metrics appear automatically!** 🎉

---

**Generated dashboards update every 10 seconds in Grafana.**
