# driftos-core

LLM-powered semantic conversation routing engine. High-accuracy drift detection using Groq's fast inference for real-time routing decisions.

## The Problem

AI applications dump entire conversation history into every LLM call:
- Unfocused context → worse responses
- Token waste → higher costs
- No structure → can't query "what did we decide about X?"

## The Solution

driftos-core uses LLM reasoning to detect topic shifts and route messages:
- **STAY** - Same topic, continue in current branch
- **BRANCH** - Topic drift detected, create new branch
- **ROUTE** - Return to a previous topic

**Result:** Focused context windows. 20 relevant messages instead of 1000.

## Why LLM-Based?

| Approach | Latency | Cost | Accuracy |
|----------|---------|------|----------|
| **LLM-based routing** | **500-1000ms** | **~$0.001/call** | **High** |
| Embedding-based | <200ms | $0 | Good |

driftos-core uses Groq's fast inference (Llama 3.1) for nuanced understanding of topic shifts, context, and conversational intent. Best for applications where accuracy matters more than latency.

## Quick Start

```bash
# Clone and install
git clone https://github.com/DriftOS/driftos-core
cd driftos-core
npm install

# Setup database
cp .env.example .env
# Add your GROQ_API_KEY to .env
npm run db:push

# Run
npm run dev
```

## API

### Route a Message
```bash
POST /api/v1/drift/route
{
  "conversationId": "conv-123",
  "content": "I want to plan a trip to Japan",
  "role": "user"
}
```

Response:
```json
{
  "action": "BRANCH",
  "branchId": "branch-456",
  "branchTopic": "Japan trip planning",
  "confidence": 0.95,
  "isNewBranch": true,
  "reason": "New topic introduced: planning a trip to Japan"
}
```

### Subsequent Messages
```bash
POST /api/v1/drift/route
{
  "conversationId": "conv-123",
  "content": "What's the best time for cherry blossoms?",
  "role": "user"
}
```

Response:
```json
{
  "action": "STAY",
  "branchId": "branch-456",
  "confidence": 0.92,
  "isNewBranch": false,
  "reason": "Continuing discussion about Japan trip - asking about cherry blossom timing"
}
```

### Topic Shift Detection
```bash
POST /api/v1/drift/route
{
  "conversationId": "conv-123",
  "content": "I need to sort out my tax return",
  "role": "user"
}
```

Response:
```json
{
  "action": "BRANCH",
  "branchId": "branch-789",
  "branchTopic": "Tax return",
  "confidence": 0.98,
  "isNewBranch": true,
  "reason": "Complete topic shift from travel planning to tax matters"
}
```

### Route Back to Previous Topic
```bash
POST /api/v1/drift/route
{
  "conversationId": "conv-123",
  "content": "Back to Japan - should I get a JR rail pass?",
  "role": "user"
}
```

Response:
```json
{
  "action": "ROUTE",
  "branchId": "branch-456",
  "confidence": 0.94,
  "isNewBranch": false,
  "reason": "Returning to previous Japan trip discussion"
}
```

### Get Context for LLM
```bash
GET /api/v1/context/{branchId}
```

Response:
```json
{
  "branchId": "branch-456",
  "branchTopic": "Japan trip planning",
  "messages": [
    { "role": "user", "content": "I want to plan a trip to Japan" },
    { "role": "user", "content": "What's the best time for cherry blossoms?" },
    { "role": "user", "content": "Back to Japan - should I get a JR rail pass?" }
  ],
  "allFacts": [
    {
      "branchTopic": "Japan trip planning",
      "isCurrent": true,
      "facts": [
        { "key": "destination", "value": "Japan", "confidence": 1.0 },
        { "key": "interest", "value": "cherry blossoms", "confidence": 0.9 },
        { "key": "transport_question", "value": "JR rail pass", "confidence": 0.9 }
      ]
    }
  ]
}
```

### List Branches
```bash
GET /api/v1/drift/branches/{conversationId}
```

### Extract Facts
```bash
POST /api/v1/facts/{branchId}/extract
```

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/drift/route` | Route a message to a branch |
| GET | `/api/v1/drift/branches/:conversationId` | List all branches |
| GET | `/api/v1/context/:branchId` | Get optimized LLM context |
| POST | `/api/v1/facts/:branchId/extract` | Extract facts from branch |
| GET | `/api/v1/facts/:branchId` | Get existing facts |

## Configuration

```env
# Required
DATABASE_URL=postgresql://...
GROQ_API_KEY=your-groq-api-key

# LLM Configuration
LLM_MODEL=llama-3.1-8b-instant
LLM_TIMEOUT=5000

# Optional (local development - gateway uses 3000, core uses 3001)
PORT=3001
```

## How It Works

1. **Analyze** - LLM examines message content, conversation history, and existing branches
2. **Decide** - Returns STAY, BRANCH, or ROUTE with reasoning
3. **Execute** - Creates branch if needed, assigns message, updates state
4. **Extract** - When leaving a branch, facts are automatically extracted

### LLM Routing Prompt

The routing decision is made by prompting the LLM with:
- Current message content
- Current branch topic and recent messages
- List of other available branches
- Instructions to return structured JSON decision

This gives nuanced understanding that embedding similarity can't match - detecting subtle topic shifts, understanding context, and recognizing when someone is returning to a previous discussion.

## SDK & MCP

Use with the official SDK:

```bash
npm install @driftos/client
```

```typescript
import { createDriftClient } from '@driftos/client';

const client = createDriftClient('http://localhost:3000');

const result = await client.route('conv-123', 'Plan my Japan trip');
const context = await client.getContext(result.branchId);
const prompt = await client.buildPrompt(result.branchId, 'You are a travel assistant');
```

Or use via MCP with Claude Desktop: [driftos-mcp-server](https://github.com/DriftOS/driftos-mcp-server)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     driftos-core                         │
├─────────────────────────────────────────────────────────┤
│  Routes Layer                                            │
│  └── /drift, /context, /facts, /branches                │
├─────────────────────────────────────────────────────────┤
│  Services Layer                                          │
│  ├── DriftService (LLM routing orchestration)           │
│  ├── ContextService (LLM context assembly)              │
│  └── FactsService (LLM-based extraction)                │
├─────────────────────────────────────────────────────────┤
│  Operations Layer                                        │
│  ├── classifyRoute (LLM-based decision)                 │
│  ├── executeRoute (branch/message creation)             │
│  └── extractFacts (structured extraction)               │
├─────────────────────────────────────────────────────────┤
│  Infrastructure                                          │
│  ├── PostgreSQL + Prisma                                │
│  ├── Groq API (Llama 3.1)                               │
│  └── Fastify + TypeScript                               │
└─────────────────────────────────────────────────────────┘
```

## Performance

- **Routing latency:** 500-1000ms (Groq inference)
- **Accuracy:** High (LLM reasoning)
- **Cost:** ~$0.001 per routing decision

## When to Use

**Use driftos-core when:**
- Accuracy is more important than latency
- You need nuanced understanding of topic shifts
- Your conversations have subtle context that embeddings might miss

**Use [driftos-embed](https://github.com/DriftOS/driftos-embed) when:**
- Latency is critical (<200ms)
- You want zero LLM API costs for routing
- Your topic shifts are clear/obvious

## Related Projects

- [driftos-embed](https://github.com/DriftOS/driftos-embed) - Embedding-based routing (faster, zero cost)
- [drift-sdk](https://github.com/DriftOS/drift-sdk) - TypeScript/JavaScript SDK
- [driftos-mcp-server](https://github.com/DriftOS/driftos-mcp-server) - MCP server for Claude Desktop

## License

MIT

---

**Patent Pending** | [driftos.dev](https://driftos.dev)
