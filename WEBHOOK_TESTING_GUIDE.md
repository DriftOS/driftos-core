# Clerk Webhook Testing Guide

## Quick Start

The Clerk webhook integration is complete! Here's how to test it end-to-end.

## What the Webhook Does

When users subscribe to a plan in Clerk, the webhook automatically:
1. Receives the subscription event from Clerk
2. Verifies the signature for security (using Svix)
3. Maps the Clerk plan name to your internal tier:
   - "Free" → `free` (100 req/min)
   - "Pro Plan" → `pro` (1,000 req/min)
   - "Enterprise Plan" → `enterprise` (10,000 req/min)
4. Updates **all API keys** for that user with the new tier
5. The rate limiter immediately enforces the new limits

## Setup Steps

### 1. Expose Local Gateway with ngrok

```bash
# Install ngrok if you haven't
brew install ngrok

# Expose your local gateway (port 3000)
ngrok http 3000
```

Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### 2. Configure Webhook in Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your DriftOS application
3. Navigate to **Webhooks** (left sidebar)
4. Click **Add Endpoint**
5. Paste webhook URL: `https://abc123.ngrok.io/api/v1/webhooks/clerk`
6. Select events:
   - `user.updated`
   - `subscription.created`
   - `subscription.updated`
   - `subscription.cancelled`
   - `subscription.deleted`
7. Click **Create**
8. **Copy the Signing Secret** (starts with `whsec_...`)

### 3. Add Secret to Gateway

```bash
cd /Users/scotty/development/driftos-gateway
```

Edit `.env` and update:
```env
CLERK_WEBHOOK_SECRET=whsec_...your_actual_secret...
```

### 4. Restart Gateway

```bash
npm run dev
```

You should see in the logs:
```
✓ Registered webhook route at /api/v1/webhooks/clerk
✓ Webhook endpoint is public (no auth required)
```

## Testing the Full Flow

### Test 1: Subscribe to Pro Plan

1. **Create an API key** (if you don't have one):
   - Go to http://localhost:3000/dashboard
   - Click "Create API Key"
   - Copy the key (starts with `dft_live_...`)

2. **Check current tier in database**:
   ```bash
   cd /Users/scotty/development/driftos-gateway
   npx prisma studio
   ```
   - Open `ApiKey` table
   - Find your key
   - Note the `tier` field (should be `free`)

3. **Subscribe to Pro Plan**:
   - Go to http://localhost:3000/pricing
   - Click "Get Started" on Pro Plan
   - Complete checkout with test card: `4242 4242 4242 4242`
   - Use any future expiry date, any CVC, any ZIP

4. **Verify webhook received**:
   - Check gateway logs (terminal where `npm run dev` is running)
   - You should see:
   ```
   INFO: Received Clerk webhook { eventType: 'subscription.created', userId: 'user_...' }
   INFO: Updated user tier from subscription event { userId: 'user_...', planName: 'Pro Plan', tier: 'pro', count: 1 }
   ```

5. **Verify database updated**:
   - Refresh Prisma Studio
   - Your API key's `tier` should now be `pro`

6. **Test rate limit enforcement**:
   ```bash
   # Should allow 1000 requests/minute (not 100)
   for i in {1..150}; do
     curl -H "Authorization: Bearer dft_live_..." \
          http://localhost:3000/api/v1/tiers
   done
   ```
   - On free tier (100 req/min): You'd get 429 errors after 100 requests
   - On pro tier (1000 req/min): All 150 requests succeed

### Test 2: Cancel Subscription

1. **Cancel via Clerk billing portal**:
   - Click on your profile → Billing
   - Click "Manage" on Pro Plan
   - Click "Cancel Subscription"
   - Confirm cancellation

2. **Verify webhook received**:
   ```
   INFO: Received Clerk webhook { eventType: 'subscription.cancelled', userId: 'user_...' }
   INFO: Downgraded user to free tier after subscription cancellation { userId: 'user_...', count: 1 }
   ```

3. **Verify tier reverted**:
   - Check Prisma Studio
   - API key tier should be `free` again
   - Rate limit is now 100 req/min

### Test 3: Switch Plans

1. **Upgrade from Pro to Enterprise**:
   - Go to Billing portal
   - Click "Switch plans"
   - Select Enterprise Plan
   - Confirm

2. **Verify webhook**:
   ```
   INFO: Received Clerk webhook { eventType: 'subscription.updated', userId: 'user_...' }
   INFO: Updated user tier { planName: 'Enterprise Plan', tier: 'enterprise', count: 1 }
   ```

3. **Verify rate limit**:
   - Should now allow 10,000 req/min

## Debugging Webhook Issues

### Issue 1: Webhook Not Receiving Events

**Check**:
1. Is ngrok running? (`ngrok http 3000`)
2. Is the gateway running? (`npm run dev`)
3. Is the webhook URL correct in Clerk Dashboard?
4. Check ngrok web UI: http://127.0.0.1:4040 to see incoming requests

**Fix**: Make sure ngrok URL matches webhook endpoint in Clerk

### Issue 2: "Invalid webhook signature" Error

**Check**:
1. Gateway logs show: `ERROR: Webhook signature verification failed`
2. Is `CLERK_WEBHOOK_SECRET` set in `.env`?
3. Does it match the secret in Clerk Dashboard?

**Fix**:
```bash
# Verify secret is set
cd /Users/scotty/development/driftos-gateway
grep CLERK_WEBHOOK_SECRET .env

# Should show: CLERK_WEBHOOK_SECRET=whsec_...
# If not, copy secret from Clerk Dashboard → Webhooks → Your endpoint → Signing Secret
```

### Issue 3: Tier Not Updating in Database

**Check**:
1. Gateway logs show webhook received but no update
2. Check plan name mapping in webhook handler

**Possible causes**:
- Clerk plan name doesn't match mapping
- User ID mismatch

**Debug**:
```bash
# Check gateway logs for the exact plan name received
# Look for: "Updated user tier" or "Received Clerk webhook"

# Verify userId matches between Clerk and your database
```

### Issue 4: Rate Limit Not Changing

**Possible causes**:
- Tier updated in DB but rate limiter still using old value
- API key not found or revoked

**Fix**:
1. Check API key is active (not revoked)
2. Verify tier column updated in database
3. Make a new request (rate limiter checks tier on each request)

## Manual Webhook Testing (Advanced)

You can trigger test webhooks from Clerk Dashboard:

1. Go to Clerk Dashboard → Webhooks
2. Click on your endpoint
3. Click "Testing" tab
4. Select event type (e.g., `subscription.created`)
5. Click "Send Example"

Check gateway logs to see the event received.

## Production Deployment

When deploying to production:

1. **Update webhook URL** in Clerk Dashboard:
   - Development: `https://your-ngrok-url.ngrok.io/api/v1/webhooks/clerk`
   - Production: `https://api.driftos.dev/api/v1/webhooks/clerk`

2. **Use production Clerk webhook secret**:
   - Create separate webhook endpoint in Clerk for production
   - Copy new signing secret
   - Update production `.env` with `CLERK_WEBHOOK_SECRET=whsec_...`

3. **Monitor webhook delivery**:
   - Clerk Dashboard → Webhooks → Your endpoint → "Attempts"
   - Shows success/failure for each delivery
   - Clerk automatically retries failed webhooks

## Security Notes

✅ **Signature Verification**: The webhook handler verifies all requests using Svix (Clerk's webhook library)

✅ **Public Route**: The webhook endpoint is public (no API key required) but signature verification ensures only Clerk can call it

✅ **Error Handling**: Invalid signatures return 400, missing secrets return 500

✅ **Logging**: All subscription changes are logged with userId and tier for audit trail

## Next Steps

After testing locally with ngrok:
1. Deploy gateway to production
2. Update webhook URL in Clerk Dashboard to production URL
3. Test with real subscription (then refund if needed)
4. Monitor Clerk Dashboard → Webhooks → Attempts for delivery status
5. Set up alerting for webhook failures

## Common Events and What They Do

| Event | Trigger | Action |
|-------|---------|--------|
| `subscription.created` | User completes checkout for first time | Update API keys to paid tier |
| `subscription.updated` | User upgrades/downgrades plan | Update API keys to new tier |
| `subscription.cancelled` | User cancels subscription | Downgrade to free tier |
| `subscription.deleted` | Subscription fully ends after cancellation | Downgrade to free tier |
| `user.updated` | User metadata changes (manual tier override) | Update API keys if `publicMetadata.subscriptionTier` changed |

## Success Indicators

✅ Gateway logs show "Received Clerk webhook" for each subscription event
✅ Database tier updates immediately after subscription change
✅ Rate limits enforce correctly based on new tier
✅ Clerk Dashboard → Webhooks → Attempts shows "Success" (200 status)
✅ No "Invalid signature" errors in gateway logs

That's it! Your Clerk Billing integration is complete. 🎉
