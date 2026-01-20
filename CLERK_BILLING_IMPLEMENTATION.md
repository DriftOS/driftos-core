# Clerk Billing Implementation Guide (Recommended)

## Overview

Clerk has built-in Stripe integration that handles ALL the complexity of billing, subscriptions, and pricing UI. This is MUCH simpler than implementing Stripe directly.

**Cost**: 0.7% per transaction + Stripe fees (standard Stripe pricing)

## Why Use Clerk Billing Instead of Direct Stripe?

✅ **Zero code integration** - Built-in UI components
✅ **Session-aware** - Automatically tied to authenticated users
✅ **Managed subscriptions** - Clerk handles subscription logic
✅ **Built-in components** - `<PricingTable />`, billing portal in user profile
✅ **Secure** - No webhook setup needed, Clerk handles everything
✅ **Upgrades/downgrades** - Automatic handling with proration

## Step-by-Step Setup

### 1. Connect Stripe to Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Billing** section
4. Click **Connect Stripe**
5. For development: Use Clerk's test gateway (shared Stripe test account)
6. For production: Connect your own Stripe account

**Important**: Use separate Stripe accounts for dev and production!

### 2. Create Plans in Clerk Dashboard

Go to Billing → Plans and create your tiers:

#### Free Plan
- Name: "Free"
- Price: $0/month
- Features:
  - 100 req/min
  - 100K requests/month
  - Basic support
  - API documentation
  - Community access

#### Pro Plan
- Name: "Pro"
- Price: $99/month (or annual $990 - 17% savings)
- Features:
  - 1,000 req/min
  - 1M requests/month
  - Priority support
  - Advanced analytics
  - Custom rate limits
  - Email support

#### Enterprise Plan
- Name: "Enterprise"
- Price: $499/month
- Features:
  - 10,000 req/min
  - Unlimited requests
  - Dedicated support
  - SLA guarantee
  - Custom contracts
  - White-glove onboarding
  - Advanced security

### 3. Update Your Frontend (Simple!)

Replace the entire pricing page with Clerk's component:

#### `/Users/scotty/development/driftos-website/app/pricing/page.tsx`

```typescript
import { PricingTable } from '@clerk/nextjs';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - DriftOS',
  description: 'Simple, transparent pricing for DriftOS API.',
};

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      {/* Optional: Add your own header */}
      <div className="mx-auto max-w-3xl text-center mb-16">
        <h1 className="text-4xl font-bold tracking-tight mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground">
          Choose the plan that fits your needs. Start free and scale as you grow.
        </p>
      </div>

      {/* Clerk's built-in pricing table */}
      <PricingTable
        appearance={{
          elements: {
            card: 'border-purple-500/20 shadow-lg',
            badge: 'bg-purple-600',
          },
        }}
        ctaPosition="bottom"
        newSubscriptionRedirectUrl="/dashboard?subscribed=true"
      />

      {/* Optional: Add FAQ section below */}
    </div>
  );
}
```

#### `/Users/scotty/development/driftos-website/app/dashboard/pricing/page.tsx`

```typescript
import { PricingTable } from '@clerk/nextjs';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing - Dashboard',
  description: 'Manage your DriftOS subscription.',
};

export default function DashboardPricingPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-6">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Upgrade Your Plan</h1>
          <p className="text-muted-foreground">
            Choose the plan that best fits your needs
          </p>
        </div>

        {/* Clerk handles everything: current plan, upgrade, billing portal */}
        <PricingTable
          appearance={{
            elements: {
              card: 'border-purple-500/20',
            },
          }}
          newSubscriptionRedirectUrl="/dashboard?subscribed=true"
        />

        <div className="text-sm text-muted-foreground text-center">
          Need help?{' '}
          <a href="mailto:hello@driftos.dev" className="text-purple-600 hover:underline">
            Contact us
          </a>
        </div>
      </div>
    </div>
  );
}
```

### 4. Update Backend to Check Subscription Tier

In your gateway, check the user's subscription via Clerk's API:

#### `/Users/scotty/development/driftos-gateway/src/plugins/auth.ts`

Update the auth plugin to fetch subscription info:

```typescript
import { clerkClient } from '@clerk/clerk-sdk-node';

// After JWT verification
const user = await clerkClient.users.getUser(payload.sub);

// Get subscription info from Clerk
// Clerk stores subscription tier in user's publicMetadata
const subscriptionTier = user.publicMetadata?.subscriptionTier || 'free';

request.apiKeyTier = subscriptionTier;
```

Or, simpler approach - let Clerk handle it via API keys:

When a user subscribes, update their API key tier via webhook or Clerk's user updated event.

### 5. Set Up Clerk Webhooks (Optional but Recommended)

To sync subscription changes to your database:

1. Go to Clerk Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/v1/webhooks/clerk`
3. Subscribe to events:
   - `user.updated` - When subscription tier changes
   - `organization.updated` - For team subscriptions

#### Create webhook handler

```typescript
// /Users/scotty/development/driftos-gateway/src/routes/webhooks/clerk.ts

import { FastifyPluginAsync } from 'fastify';
import { Webhook } from 'svix';

const clerkWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/webhooks/clerk', async (request, reply) => {
    const webhook = new Webhook(fastify.config.CLERK_WEBHOOK_SECRET);

    try {
      const payload = webhook.verify(
        JSON.stringify(request.body),
        request.headers as Record<string, string>
      );

      const event = payload as any;

      if (event.type === 'user.updated') {
        const userId = event.data.id;
        const subscriptionTier = event.data.public_metadata?.subscriptionTier || 'free';

        // Update API keys for this user
        await fastify.prisma.apiKey.updateMany({
          where: { userId },
          data: { tier: subscriptionTier },
        });

        fastify.log.info({ userId, subscriptionTier }, 'Updated user subscription tier');
      }

      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error({ err }, 'Webhook verification failed');
      return reply.status(400).send({ error: 'Invalid webhook signature' });
    }
  });
};

export default clerkWebhookRoutes;
```

### 6. Access Billing Portal

Clerk automatically adds a "Billing" tab to the `<UserProfile />` component. Users can:
- View current plan
- Upgrade/downgrade
- Update payment method
- View invoices
- Cancel subscription

No additional code needed!

## Benefits Summary

### What You DON'T Need to Build:
- ❌ Stripe checkout sessions
- ❌ Webhook handlers for payment events
- ❌ Customer portal
- ❌ Invoice management
- ❌ Payment method updates
- ❌ Proration logic
- ❌ Trial period handling
- ❌ Subscription cancellation flows

### What Clerk Handles:
- ✅ Payment processing
- ✅ Subscription management
- ✅ Plan upgrades/downgrades
- ✅ Billing portal UI
- ✅ Invoice generation
- ✅ Payment failure handling
- ✅ Proration
- ✅ Security & PCI compliance

## Pricing Comparison

**Direct Stripe**: Free (just pay Stripe fees ~2.9% + 30¢)
**Clerk Billing**: 0.7% + Stripe fees

**For a $99 Pro subscription**:
- Stripe only: ~$3.17 per transaction
- Clerk Billing: ~$3.86 per transaction ($0.69 to Clerk, ~$3.17 to Stripe)

**Worth it?** Absolutely, for the time saved and complexity avoided!

## Current Limitations (Beta)

- USD only (no multi-currency)
- Not available in: Brazil, India, Malaysia, Mexico, Singapore, Thailand
- No per-seat pricing yet (coming soon)
- No metered billing yet (coming soon)
- No free trials yet (coming soon)

## Migration Path

If you already built direct Stripe integration:

1. Keep existing subscriptions in Stripe
2. New subscriptions use Clerk Billing
3. Gradually migrate old subscriptions
4. Or use Clerk for UI, keep Stripe webhooks

## Testing

Development instances use Clerk's shared test Stripe account - no setup needed!

Use test card: `4242 4242 4242 4242`

## Production Checklist

- [ ] Connect production Stripe account in Clerk Dashboard
- [ ] Create production plans with real pricing
- [ ] Test full flow with real card (then refund)
- [ ] Set up Clerk webhook endpoint
- [ ] Update API key tier logic to read from Clerk
- [ ] Add "Manage Subscription" link to dashboard
- [ ] Test upgrade/downgrade flows
- [ ] Test payment failure scenarios
- [ ] Monitor first few subscriptions closely

## Resources

- [Clerk Billing Overview](https://clerk.com/docs/guides/billing/overview)
- [PricingTable Component Docs](https://clerk.com/docs/nextjs/reference/components/billing/pricing-table)
- [Clerk Billing for B2C SaaS](https://clerk.com/docs/nextjs/guides/billing/for-b2c)
- [Getting Started with Clerk Billing](https://clerk.com/blog/intro-to-clerk-billing)

## Comparison: Clerk Billing vs Direct Stripe

| Feature | Clerk Billing | Direct Stripe |
|---------|--------------|---------------|
| Setup Time | 10 minutes | 2-3 days |
| Code Required | ~20 lines | ~500+ lines |
| Pricing UI | Built-in component | Build from scratch |
| Billing Portal | Automatic | Build yourself |
| Webhook Security | Handled by Clerk | Manual verification |
| PCI Compliance | Clerk handles | Stripe handles |
| Cost | +0.7% | Free (Stripe fees only) |
| Maintenance | None | Ongoing |

**Recommendation**: Use Clerk Billing unless you need features not yet supported (multi-currency, metered billing, per-seat).
