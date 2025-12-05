# driftos-core

Conversation routing and context management for AI applications. Route messages to semantic branches, extract structured facts with provenance, and assemble optimized LLM context.

## The Problem

AI applications dump entire conversation history into every LLM call:
- Unfocused context → worse responses
- No structure → can't query "what did we decide about X?"

## The Solution

driftos-core organizes conversations into semantic branches:
- Detects topic shifts automatically
- Routes messages to the right branch
- Extracts facts with provenance
- Assembles focused context for LLM calls

**Result:** 20 relevant messages instead of 1000.

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
  "content": "I want to plan a trip to Paris",
  "role": "user"
}
```

Response:
```json
{
  "action": "BRANCH",
  "branchId": "branch-456",
  "branchTopic": "Paris trip planning",
  "confidence": 0.95,
  "isNewBranch": true
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
  "branchTopic": "Paris trip planning",
  "messages": [
    { "role": "user", "content": "I want to plan a trip to Paris" },
    { "role": "user", "content": "What hotels are near the Eiffel Tower?" }
  ],
  "allFacts": [
    {
      "branchTopic": "Paris trip planning",
      "isCurrent": true,
      "facts": [
        { "key": "destination", "value": "Paris", "confidence": 1.0 },
        { "key": "location_preference", "value": "near Eiffel Tower", "confidence": 1.0 }
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

## How It Works

1. **Route** - Message comes in, LLM decides: STAY (same topic), ROUTE (back to existing topic), or BRANCH (new topic)
2. **Extract** - When topics switch, facts are automatically extracted from the branch you left
3. **Context** - Get focused context: current branch messages + facts from all branches

## Usage Example
```typescript
// Route a message
const result = await fetch('/api/v1/drift/route', {
  method: 'POST',
  body: JSON.stringify({
    conversationId: 'conv-123',
    content: 'What hotels are near the Eiffel Tower?',
    role: 'user'
  })
});

const { branchId } = await result.json();

// Get context for your LLM call
const context = await fetch(`/api/v1/context/${branchId}`);
const { messages, allFacts } = await context.json();

// Build your prompt
const systemPrompt = `Current topic: ${context.branchTopic}

Known facts:
${allFacts
  .filter(b => b.isCurrent)
  .flatMap(b => b.facts.map(f => `- ${f.key}: ${f.value}`))
  .join('\n')}
`;

// Call your LLM with focused context
const response = await openai.chat.completions.create({
  messages: [
    { role: 'system', content: systemPrompt },
    ...messages
  ]
});
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
LLM_API_KEY=your-groq-api-key

# Optional
LLM_MODEL=meta-llama/llama-4-maverick-17b-128e-instruct
PORT=3000
```

## License

MIT

[![Built with DriftOS Fastify Starter](https://img.shields.io/badge/Built%20with-Fastify%20Gold%20Standard-blue?style=flat&logo=fastify)](https://github.com/DriftOS/fastify-starter)

---

**Patent Pending** | [Commercial licensing](mailto:scott@driftos.dev) available for enterprise features.
