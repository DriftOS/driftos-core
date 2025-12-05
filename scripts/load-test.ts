#!/usr/bin/env tsx

/**
 * Load Test Script - Simulates Production Traffic
 *
 * Continuously sends requests to the Drift API to generate metrics
 * and make the dashboard "light up" with data!
 */

const API_URL = process.env.API_URL || 'http://localhost:3000';
const REQUESTS_PER_SECOND = parseInt(process.env.RPS || '1', 10);
const DURATION_MINUTES = parseInt(process.env.DURATION || '60', 10);
const RANDOMIZE = process.env.RANDOMIZE !== 'false';
const JITTER_PERCENT = parseFloat(process.env.JITTER || '30');

interface Stats {
  total: number;
  success: number;
  errors: number;
  rateLimited: number;
  stays: number;
  routes: number;
  branches: number;
  avgLatency: number;
  latencies: number[];
}

const stats: Stats = {
  total: 0,
  success: 0,
  errors: 0,
  rateLimited: 0,
  stays: 0,
  routes: 0,
  branches: 0,
  avgLatency: 0,
  latencies: [],
};

// Simulated conversation topics for realistic drift testing
const CONVERSATIONS = [
  {
    id: 'conv-planning-trip',
    messages: [
      'I want to plan a trip to Japan',
      'What are the best places to visit in Tokyo?',
      'How much does a JR rail pass cost?',
      'Should I stay in Shinjuku or Shibuya?',
      'What about the cherry blossom season?',
      'How do I get from Narita to the city?',
      'Any good ramen spots you recommend?',
      'I need to fix my bathroom sink',  // BRANCH
      'The faucet is leaking badly',
      'Should I call a plumber?',
      'Back to Japan - do I need a visa?',  // ROUTE
      'What temples should I see in Kyoto?',
    ],
  },
  {
    id: 'conv-buying-car',
    messages: [
      'I want to buy an electric car',
      'How does the Tesla Model 3 compare to Model Y?',
      'What about the charging network?',
      'How much does insurance cost for EVs?',
      'What tax credits are available?',
      'Can I charge at home with 110v?',
      'What is the best recipe for pasta carbonara?',  // BRANCH
      'Should I use guanciale or pancetta?',
      'How many eggs per serving?',
      'Back to cars - what about the Rivian?',  // ROUTE
      'How long is the EV tax credit valid?',
    ],
  },
  {
    id: 'conv-learning-guitar',
    messages: [
      'I want to learn to play guitar',
      'Should I start with acoustic or electric?',
      'What are the basic chords I need?',
      'How often should I practice?',
      'Any good YouTube tutorials?',
      'My fingers hurt - is that normal?',
      'What laptop should I buy for work?',  // BRANCH
      'I need at least 16GB RAM',
      'Mac or Windows for programming?',
      'Anyway, back to guitar - what songs are easy?',  // ROUTE
      'Should I learn tabs or sheet music?',
    ],
  },
];

// Track conversation state
const conversationState: Map<string, { branchId?: string; messageIndex: number }> = new Map();

/**
 * Send a drift route request
 */
async function sendDriftRequest(): Promise<void> {
  // Pick a random conversation
  const conv = CONVERSATIONS[Math.floor(Math.random() * CONVERSATIONS.length)];

  // Get or initialize state for this conversation
  let state = conversationState.get(conv.id);
  if (!state) {
    state = { messageIndex: 0 };
    conversationState.set(conv.id, state);
  }

  // Get message (cycle through messages)
  const content = conv.messages[state.messageIndex % conv.messages.length];
  state.messageIndex++;

  const start = Date.now();

  try {
    const response = await fetch(`${API_URL}/api/v1/drift/route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId: conv.id,
        content,
        role: 'user',
        currentBranchId: state.branchId,
      }),
    });

    const latency = Date.now() - start;
    stats.latencies.push(latency);
    stats.total++;

    if (response.ok) {
      const data = await response.json();
      stats.success++;

      // Track routing actions
      const action = data.data?.action;
      if (action === 'STAY') stats.stays++;
      else if (action === 'ROUTE') stats.routes++;
      else if (action === 'BRANCH') stats.branches++;

      // Update branch state for next request
      if (data.data?.branchId) {
        state.branchId = data.data.branchId;
      }
    } else if (response.status === 429) {
      stats.rateLimited++;
      stats.errors++;
    } else {
      stats.errors++;
      console.error(`❌ Error ${response.status}: ${await response.text()}`);
    }
  } catch (error) {
    stats.total++;
    stats.errors++;
    console.error(`❌ Request failed:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Calculate and display stats
 */
function displayStats(): void {
  if (stats.latencies.length === 0) return;

  const sorted = [...stats.latencies].sort((a, b) => a - b);
  const avg = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];

  const successRate = ((stats.success / stats.total) * 100).toFixed(1);
  const errorRate = ((stats.errors / stats.total) * 100).toFixed(1);

  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║   🌊 DRIFT LOAD TEST - LIGHTING UP DASHBOARDS!             ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`📊 REQUESTS`);
  console.log(`   Total:       ${stats.total.toString().padStart(8)}`);
  console.log(`   Success:     ${stats.success.toString().padStart(8)} (${successRate}%)`);
  console.log(`   Errors:      ${stats.errors.toString().padStart(8)} (${errorRate}%)`);
  if (stats.rateLimited > 0) {
    console.log(`   Rate Limited:${stats.rateLimited.toString().padStart(8)} ⚠️`);
  }
  console.log(`   Rate:        ${REQUESTS_PER_SECOND.toString().padStart(8)} req/s (avg)`);
  console.log('');
  console.log(`🌳 ROUTING ACTIONS`);
  console.log(`   STAY:        ${stats.stays.toString().padStart(8)}`);
  console.log(`   ROUTE:       ${stats.routes.toString().padStart(8)}`);
  console.log(`   BRANCH:      ${stats.branches.toString().padStart(8)}`);
  console.log('');
  console.log(`⚡ LATENCY`);
  console.log(`   Avg:         ${avg.toFixed(1).padStart(8)} ms`);
  console.log(`   P50:         ${p50?.toString().padStart(8) ?? 'N/A'} ms`);
  console.log(`   P95:         ${p95?.toString().padStart(8) ?? 'N/A'} ms`);
  console.log(`   P99:         ${p99?.toString().padStart(8) ?? 'N/A'} ms`);
  console.log('');
  console.log(`🎯 TARGET`);
  console.log(`   URL:         ${API_URL}/api/v1/drift/route`);
  console.log(`   Grafana:     http://localhost:3001`);
  console.log('');
  console.log(`💡 Press Ctrl+C to stop`);
  console.log('');
}

/**
 * Calculate next request delay with jitter
 */
function getNextDelay(baseInterval: number): number {
  if (!RANDOMIZE) {
    return baseInterval;
  }

  const jitterAmount = baseInterval * (JITTER_PERCENT / 100);
  const minDelay = baseInterval - jitterAmount;
  const maxDelay = baseInterval + jitterAmount;

  return Math.random() * (maxDelay - minDelay) + minDelay;
}

/**
 * Main load test loop
 */
async function runLoadTest(): Promise<void> {
  console.log('🌊 Starting Drift load test...\n');

  console.log(`Target: ${API_URL}/api/v1/drift/route`);
  console.log(`Rate: ${REQUESTS_PER_SECOND} req/s (avg)`);
  console.log(`Randomized: ${RANDOMIZE ? `Yes (±${JITTER_PERCENT}% jitter)` : 'No'}`);
  console.log(`Duration: ${DURATION_MINUTES} minutes`);
  console.log(`Conversations: ${CONVERSATIONS.length}\n`);

  const baseInterval = 1000 / REQUESTS_PER_SECOND;
  const endTime = Date.now() + (DURATION_MINUTES * 60 * 1000);

  // Display stats every second
  const statsInterval = setInterval(displayStats, 1000);

  // Recursive function for randomized intervals
  const scheduleNextRequest = () => {
    if (Date.now() >= endTime) {
      clearInterval(statsInterval);
      displayStats();
      console.log('\n✅ Load test complete!\n');
      process.exit(0);
      return;
    }

    // Send request
    sendDriftRequest().catch(console.error);

    // Schedule next request with jitter
    const nextDelay = getNextDelay(baseInterval);
    setTimeout(scheduleNextRequest, nextDelay);
  };

  // Start the first request
  scheduleNextRequest();

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    clearInterval(statsInterval);
    displayStats();
    console.log('\n⏸️  Load test stopped by user\n');
    process.exit(0);
  });
}

// Start the load test
runLoadTest().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
