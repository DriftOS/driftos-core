# Clerk Billing Setup Steps

## What I Just Did

✅ Updated `/app/pricing/page.tsx` to use Clerk's `<PricingTable />` component
✅ Simplified from 200+ lines to ~100 lines
✅ Removed custom tier fetching and rendering logic

## What You Need to Do in Clerk Dashboard

### Step 1: Go to Clerk Dashboard
1. Visit https://dashboard.clerk.com
2. Select your DriftOS application
3. Navigate to **Billing** in the left sidebar

### Step 2: Connect Stripe

**For Development:**
- Click "Use Clerk's test gateway"
- This gives you instant test billing (no Stripe account needed!)

**For Production (when ready):**
- Click "Connect Stripe Account"
- Follow OAuth flow to link your Stripe account
- Important: Use a SEPARATE Stripe account from development

### Step 3: Create Plans

Go to Billing → Plans and create these 3 tiers:

#### Plan 1: Free
- **Name**: Free
- **Price**: $0/month
- **Description**: Perfect for testing and small projects. Get started with our conversation graph engine at no cost.
- **Features** (add these as bullet points):
  - 100 requests per minute
  - 100K requests per month
  - Basic support
  - API documentation
  - Community access

#### Plan 2: Pro (Mark as "Most Popular")
- **Name**: Pro
- **Price**: $99/month
- **Description**: Best for production applications. Scale your AI with priority support and advanced analytics.
- **Features**:
  - 1,000 requests per minute
  - 1M requests per month
  - Priority support
  - Advanced analytics
  - Custom rate limits
  - Email support

#### Plan 3: Enterprise
- **Name**: Enterprise
- **Price**: $499/month (you can also add annual pricing like $4,990/year for 17% savings)
- **Description**: For mission-critical applications. Get dedicated support, SLA guarantees, and custom contracts tailored to your needs.
- **Features**:
  - 10,000 requests per minute
  - Unlimited requests
  - Dedicated support
  - SLA guarantee
  - Custom contracts
  - White-glove onboarding
  - Advanced security

### Step 4: Test the Integration

1. Start your dev server: `npm run dev`
2. Visit http://localhost:3000/pricing
3. You should see Clerk's pricing table with your plans!
4. Click "Get Started" on a paid plan
5. Use test card: `4242 4242 4242 4242`
6. Complete checkout
7. Verify subscription in Clerk Dashboard → Billing → Subscriptions

### Step 5: Add Billing Portal to User Profile (Automatic!)

Clerk automatically adds a "Billing" tab to the `<UserButton />` component. Users can:
- View current plan
- Upgrade/downgrade
- Update payment method
- View invoices
- Cancel subscription

No code changes needed! It's already there.

### Step 6: Set Up Webhook to Sync Subscription Tiers ✅

The webhook endpoint is already implemented in the gateway! Now you just need to configure it in Clerk Dashboard.

#### 6.1 Get Your Webhook URL

**Development (local testing)**:
- Use ngrok to expose your local gateway: `ngrok http 3000`
- Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
- Webhook URL: `https://abc123.ngrok.io/api/v1/webhooks/clerk`

**Production**:
- Webhook URL: `https://api.driftos.dev/api/v1/webhooks/clerk`

#### 6.2 Create Webhook in Clerk Dashboard

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Webhooks** in the left sidebar
4. Click **Add Endpoint**
5. Enter your webhook URL (from step 6.1)
6. Subscribe to these events:
   - ✅ `user.updated` - When user metadata changes
   - ✅ `subscription.created` - New subscription
   - ✅ `subscription.updated` - Plan change, renewal
   - ✅ `subscription.cancelled` - User cancels
   - ✅ `subscription.deleted` - Subscription removed
7. Click **Create**
8. **Copy the Signing Secret** (starts with `whsec_...`)

#### 6.3 Add Webhook Secret to Gateway

Open `/Users/scotty/development/driftos-gateway/.env` and update:

```env
CLERK_WEBHOOK_SECRET=whsec_...your_actual_secret_from_step_6.2...
```

#### 6.4 Restart Gateway

```bash
cd /Users/scotty/development/driftos-gateway
npm run dev
```

The webhook endpoint is now live at `/api/v1/webhooks/clerk` and will automatically:
- Receive subscription events from Clerk
- Verify webhook signatures for security
- Map plan names to tiers (Free → free, Pro Plan → pro, Enterprise Plan → enterprise)
- Update all API keys for the user with the new tier
- Log all changes for debugging

### Step 7: Rate Limiting ✅

The rate limiter is already configured! It automatically enforces tier-based limits:

- **Free tier**: 100 requests/minute
- **Pro tier**: 1,000 requests/minute
- **Enterprise tier**: 10,000 requests/minute

When the webhook updates an API key's tier, the rate limiter immediately enforces the new limits. No additional configuration needed!

## Testing Checklist

- [ ] Can see pricing table on /pricing
- [ ] Can click "Get Started" and go to checkout
- [ ] Can complete purchase with test card (4242...)
- [ ] Can see subscription in Clerk Dashboard
- [ ] Can access Billing tab in UserButton dropdown
- [ ] API requests respect new rate limit after upgrade
- [ ] Can downgrade plan
- [ ] Can cancel subscription

## Production Checklist

- [ ] Connect production Stripe account in Clerk Dashboard
- [ ] Create production plans (same as dev)
- [ ] Test with real card (then refund)
- [ ] Set up Clerk webhook for tier syncing
- [ ] Monitor first few subscriptions
- [ ] Test upgrade/downgrade flows
- [ ] Test payment failure scenarios
- [ ] Verify rate limits enforce correctly

## Next Steps

1. Set up the plans in Clerk Dashboard (5 minutes)
2. Test the flow end-to-end
3. Set up webhook to sync tiers to API keys (optional but recommended)
4. Update dashboard pricing page (I'll do this next)

Ready to proceed?
