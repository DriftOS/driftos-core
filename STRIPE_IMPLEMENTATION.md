# Stripe Payment Implementation Guide

## Overview

This guide walks through implementing actual payment processing for DriftOS pricing tiers using Stripe.

## Prerequisites

1. **Stripe Account**: Sign up at https://stripe.com
2. **Stripe CLI** (for webhook testing): https://stripe.com/docs/stripe-cli

## Step-by-Step Implementation

### 1. Create Products in Stripe Dashboard

Go to Stripe Dashboard → Products and create:

- **Pro Plan**
  - Name: "DriftOS Pro"
  - Price: $99/month (recurring)
  - Copy the Price ID (e.g., `price_1ABC...`)

- **Enterprise Plan**
  - Name: "DriftOS Enterprise"
  - Price: $499/month (recurring)
  - Copy the Price ID (e.g., `price_2XYZ...`)

### 2. Backend Setup (driftos-gateway)

#### Install Dependencies

```bash
cd /Users/scotty/development/driftos-gateway
npm install stripe
```

#### Update Environment Variables

Add to `/Users/scotty/development/driftos-gateway/.env`:

```env
# Stripe Keys (get from https://dashboard.stripe.com/apikeys)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...  # Generate after setting up webhook

# Stripe Price IDs (from step 1)
STRIPE_PRO_PRICE_ID=price_1ABC...
STRIPE_ENTERPRISE_PRICE_ID=price_2XYZ...

# Frontend URL for redirects
FRONTEND_URL=http://localhost:3000
```

#### Update TypeBox Schema

Add to `/Users/scotty/development/driftos-gateway/src/plugins/env.ts`:

```typescript
STRIPE_SECRET_KEY: Type.String(),
STRIPE_PUBLISHABLE_KEY: Type.String(),
STRIPE_WEBHOOK_SECRET: Type.String(),
STRIPE_PRO_PRICE_ID: Type.String(),
STRIPE_ENTERPRISE_PRICE_ID: Type.String(),
FRONTEND_URL: Type.String({ default: 'http://localhost:3000' }),
```

#### Register Billing Routes

Add to `/Users/scotty/development/driftos-gateway/src/app.ts` (after other routes):

```typescript
import billingRoutes from './routes/billing/index.js';

// After existing routes...
await app.register(billingRoutes, { prefix: '/api/v1' });
```

#### Add Stripe Customer ID to User Model

Update `/Users/scotty/development/driftos-gateway/prisma/schema.prisma`:

```prisma
model User {
  id               String    @id @default(cuid())
  email            String    @unique
  stripeCustomerId String?   @map("stripe_customer_id")
  createdAt        DateTime  @default(now()) @map("created_at")

  @@map("users")
}
```

Run migration:

```bash
npx prisma migrate dev --name add-stripe-customer-id
```

### 3. Frontend Setup (driftos-website)

#### Install Dependencies

```bash
cd /Users/scotty/development/driftos-website
npm install @stripe/stripe-js
```

#### Update Environment Variables

Add to `/Users/scotty/development/driftos-website/.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

#### Update Dashboard Pricing Page

Replace button logic in `/Users/scotty/development/driftos-website/app/dashboard/pricing/page.tsx`:

Find the button section (around line 208) and replace with:

```typescript
import { UpgradeButton } from '@/components/pricing/upgrade-button';

// In the JSX:
{isCurrentTier ? (
  <Button variant="outline" className="w-full" disabled>
    Current Plan
  </Button>
) : tier.name === 'enterprise' ? (
  <Button variant="outline" className="w-full" asChild>
    <a href="mailto:hello@driftos.dev">
      Contact Sales
      <ArrowRight className="ml-2 h-4 w-4" />
    </a>
  </Button>
) : tier.name === 'free' ? (
  <Button variant="outline" className="w-full" disabled>
    Current Plan
  </Button>
) : (
  <UpgradeButton
    tier={tier.name}
    tierDisplayName={tier.displayName}
    isPro={isPro}
  />
)}
```

### 4. Set Up Stripe Webhooks

#### Local Development (using Stripe CLI)

1. Install Stripe CLI: https://stripe.com/docs/stripe-cli

2. Login to Stripe:
   ```bash
   stripe login
   ```

3. Forward webhooks to local server:
   ```bash
   stripe listen --forward-to localhost:3002/api/v1/billing/webhook
   ```

4. Copy the webhook signing secret (`whsec_...`) and add to `.env` as `STRIPE_WEBHOOK_SECRET`

#### Production

1. Go to Stripe Dashboard → Developers → Webhooks

2. Add endpoint: `https://yourdomain.com/api/v1/billing/webhook`

3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

4. Copy the webhook signing secret and add to production environment variables

### 5. Add Billing Route to Auth Plugin

Update `/Users/scotty/development/driftos-gateway/src/plugins/auth.ts`:

Add `/api/v1/billing/webhook` to `PUBLIC_ROUTES` array (webhooks need raw body access):

```typescript
const PUBLIC_ROUTES = [
  // ... existing routes
  '/api/v1/billing/webhook',  // Add this
];
```

### 6. Testing the Flow

#### Test Checkout Flow

1. Start both servers:
   ```bash
   # Terminal 1: Gateway
   cd /Users/scotty/development/driftos-gateway
   npm run dev

   # Terminal 2: Website
   cd /Users/scotty/development/driftos-website
   npm run dev

   # Terminal 3: Stripe webhook forwarding
   stripe listen --forward-to localhost:3002/api/v1/billing/webhook
   ```

2. Navigate to http://localhost:3000/dashboard/pricing

3. Click "Upgrade to Pro" button

4. Use Stripe test card: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
   - ZIP: Any 5 digits

5. Complete checkout

6. Verify:
   - User redirected to success page
   - Webhook received and processed
   - API key tier updated in database
   - Check gateway logs for confirmation

#### Test Cards

Stripe provides various test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

Full list: https://stripe.com/docs/testing

### 7. Additional Features to Implement

#### Billing Portal

Add a "Manage Subscription" button for users with active subscriptions:

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { createPortalSession } from '@/lib/api/billing';
import { toast } from 'sonner';

export function ManageSubscriptionButton() {
  const { getToken } = useAuth();

  const handleManage = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const portalUrl = await createPortalSession(token);
      window.location.href = portalUrl;
    } catch (error) {
      toast.error('Failed to open billing portal');
    }
  };

  return (
    <Button onClick={handleManage} variant="outline">
      Manage Subscription
    </Button>
  );
}
```

#### Prorated Upgrades/Downgrades

Stripe automatically handles proration when users change plans mid-cycle.

#### Trial Periods

Add trial period when creating checkout session:

```typescript
const session = await stripe.checkout.sessions.create({
  // ... existing config
  subscription_data: {
    trial_period_days: 14,  // 14-day free trial
  },
});
```

#### Usage-Based Billing

For future token-based pricing, use Stripe metered billing:

```typescript
// Report usage to Stripe
await stripe.subscriptionItems.createUsageRecord(
  subscriptionItemId,
  {
    quantity: tokenCount,
    timestamp: Math.floor(Date.now() / 1000),
  }
);
```

### 8. Production Checklist

Before going live:

- [ ] Switch to live API keys (no `_test_` prefix)
- [ ] Set up production webhook endpoint
- [ ] Test full flow with real card (then refund)
- [ ] Set up Stripe Radar rules for fraud prevention
- [ ] Configure email receipts in Stripe Dashboard
- [ ] Set up invoice templates
- [ ] Add tax collection if required (Stripe Tax)
- [ ] Configure subscription renewal emails
- [ ] Set up failed payment dunning (automatic retries)
- [ ] Add monitoring/alerts for failed payments
- [ ] Test webhook reliability (Stripe retries failed webhooks)

### 9. Security Best Practices

1. **Never expose secret keys** - Keep in backend only
2. **Verify webhook signatures** - Already implemented in webhook handler
3. **Use HTTPS in production** - Required for Stripe
4. **Validate tier changes** - Check user permissions before upgrades
5. **Rate limit checkout API** - Prevent abuse
6. **Log all billing events** - For audit trail
7. **Handle webhook idempotency** - Stripe may send duplicate events

### 10. Monitoring & Analytics

Track key metrics:

- Conversion rate (free → paid)
- Churn rate (paid → free)
- Monthly Recurring Revenue (MRR)
- Failed payment rate
- Customer Lifetime Value (LTV)

Use Stripe Dashboard or integrate with analytics tools.

## Troubleshooting

### Webhook Not Receiving Events

1. Check webhook is running: `stripe listen`
2. Verify signing secret matches `.env`
3. Check gateway logs for errors
4. Test webhook manually: `stripe trigger checkout.session.completed`

### Checkout Session Creation Fails

1. Verify price IDs are correct
2. Check API key has correct permissions
3. Ensure user is authenticated
4. Check gateway logs for detailed error

### Tier Not Updating After Payment

1. Verify webhook received event
2. Check `userId` in session metadata
3. Verify database update query
4. Check Prisma logs

## Support

- Stripe Documentation: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
- Stripe Support: https://support.stripe.com
