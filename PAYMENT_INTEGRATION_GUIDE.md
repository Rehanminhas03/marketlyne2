# Marketlyn — Square Payment Integration Guide

Complete documentation for the Square payment gateway integration used in the Marketlyn real estate platform.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Environment Variables](#environment-variables)
3. [Square Developer Setup](#square-developer-setup)
4. [Payment Flow (Step by Step)](#payment-flow-step-by-step)
5. [API Routes Reference](#api-routes-reference)
6. [Core Library Files](#core-library-files)
7. [Client-Side Pages](#client-side-pages)
8. [Price Configuration](#price-configuration)
9. [JWT Token System](#jwt-token-system)
10. [Webhook Integration](#webhook-integration)
11. [Security Measures](#security-measures)
12. [Troubleshooting](#troubleshooting)
13. [Testing with Sandbox](#testing-with-sandbox)
14. [Going Live Checklist](#going-live-checklist)

---

## Architecture Overview

```
User selects plan on /pricing
        │
        ▼
POST /api/payments/create-checkout
        │  (validates plan, creates Square Checkout Link)
        ▼
User is redirected to Square hosted checkout page
        │  (Square handles card input, 3DS, etc.)
        ▼
Square redirects to /payment-success?orderId=xxx&transactionId=yyy
        │
        ▼
POST /api/payments/verify  (with retry: 3 attempts, 2s apart)
        │  (calls Square Orders API to confirm COMPLETED status)
        │  (generates JWT access token on success)
        ▼
User is redirected to /onboarding?token=xxx&plan=yyy&crm=zzz
        │
        ▼
POST /api/payments/verify-token  (onboarding page verifies JWT)
        │
        ▼
POST /api/onboarding  (submits form data, saves to MongoDB + Google Sheets)
```

### Parallel: Webhook (server-to-server)
```
Square server ──► POST /api/payments/webhook
                  (confirms payment.completed, logs events)
```

---

## Environment Variables

All variables are stored in `.env.local` (never committed to git).

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Yes | Your production URL (e.g., `https://re.marketlyn.com`). Used for Square redirect URLs. **Must NOT have a trailing slash.** |
| `SQUARE_ENVIRONMENT` | Yes | `sandbox` for testing, `production` for live payments |
| `SQUARE_ACCESS_TOKEN` | Yes | From Square Dashboard > Applications > Credentials |
| `SQUARE_APPLICATION_ID` | Yes | From Square Dashboard > Applications |
| `SQUARE_LOCATION_ID` | Yes | From Square Dashboard > Locations |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | Recommended | From Square Dashboard > Webhooks. Used to verify webhook authenticity. |
| `JWT_SECRET` | Yes | Random 64-char hex string for signing payment tokens. Generate with: `openssl rand -hex 32` |

### Example `.env.local`

```env
NEXT_PUBLIC_SITE_URL=https://re.marketlyn.com

SQUARE_ENVIRONMENT=production
SQUARE_ACCESS_TOKEN=EAAAl85M...your_token_here
SQUARE_APPLICATION_ID=sq0idp-your_app_id
SQUARE_LOCATION_ID=L7KKR330DC4QC
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_key_here

JWT_SECRET=ec94bf3be84ed53c69ff4bf52f02f739691f1f35c99fd06dd5ec0edd0a1113d8
```

> **IMPORTANT:** When deploying to Vercel, add ALL these variables in Project Settings > Environment Variables. The `NEXT_PUBLIC_` prefix makes the variable available client-side; all others are server-only.

---

## Square Developer Setup

### Step 1: Create a Square Developer Account
1. Go to [https://developer.squareup.com/](https://developer.squareup.com/)
2. Sign in or create a Square account
3. Click "Create Application"
4. Name it (e.g., "Marketlyn")

### Step 2: Get Credentials
1. Go to **Applications > Your App > Credentials**
2. Copy:
   - **Access Token** (Sandbox for testing, Production for live)
   - **Application ID**

### Step 3: Get Location ID
1. Go to **Locations** in your Square Dashboard
2. Copy the **Location ID** for your business location

### Step 4: Configure Webhooks (Recommended)
1. Go to **Applications > Your App > Webhooks**
2. Click "Add Webhook"
3. Set URL: `https://re.marketlyn.com/api/payments/webhook`
4. Subscribe to events:
   - `payment.completed`
   - `payment.updated`
   - `order.fulfillment.updated`
   - `checkout.link.completed`
5. Copy the **Signature Key** and add to your `.env.local`

### Step 5: Switch to Production
1. Ensure `SQUARE_ENVIRONMENT=production` in `.env.local`
2. Use the **Production** Access Token (not Sandbox)
3. Verify `NEXT_PUBLIC_SITE_URL` matches your live domain exactly

---

## Payment Flow (Step by Step)

### Step 1: User Initiates Checkout

**File:** `src/app/pricing/page.tsx`

The user selects a plan and optionally adds the CRM addon. When they click "Proceed to Payment":

```typescript
const handleCheckout = async (plan: string, includeCRM: boolean) => {
  // 1. Sets loading state
  // 2. Calls POST /api/payments/create-checkout
  // 3. Sets sessionStorage flag "payment_in_progress" = "true"
  // 4. Redirects to Square checkout URL via window.location.href
};
```

The `payment_in_progress` flag is used to handle the case where a user presses the browser back button from Square's checkout page — it resets the UI instead of showing a broken state.

### Step 2: Create Checkout Link (Server)

**File:** `src/app/api/payments/create-checkout/route.ts`

```
POST /api/payments/create-checkout
Body: { plan: "dealflow", includeCRM: false }
Response: { success: true, checkoutUrl: "https://square.link/...", orderId: "..." }
```

This endpoint:
1. Validates the plan name against `PLAN_PRICES`
2. Checks Square credentials are configured
3. Calls `createCheckoutLink()` from `src/lib/square.ts`
4. Returns the Square-hosted checkout URL

### Step 3: Square Hosted Checkout

The user is redirected to Square's hosted checkout page where they enter card details. Square handles:
- Card input with PCI compliance
- 3D Secure authentication (if required)
- Payment processing

### Step 4: Redirect Back to Payment Success

After payment, Square redirects to:
```
https://re.marketlyn.com/payment-success?orderId=xxx&transactionId=yyy
```

**File:** `src/app/payment-success/page.tsx`

This page:
1. Extracts `orderId` from URL params (with fallback param names for resilience)
2. Calls `verifyWithRetry()` — POSTs to `/api/payments/verify` up to 3 times with 2-second delays
3. On success: stores token in `sessionStorage` as backup, then redirects to `/onboarding`
4. On failure: shows error message with support contact info

### Step 5: Verify Payment (Server)

**File:** `src/app/api/payments/verify/route.ts`

```
POST /api/payments/verify
Body: { orderId: "xxx" }
Response: { verified: true, accessToken: "jwt...", plan: "dealflow", includeCRM: false }
```

This endpoint:
1. Calls Square Orders API to get order details
2. Checks `order.state === "COMPLETED"`
3. Extracts plan and CRM metadata from the order
4. Generates a JWT access token via `generateAccessToken()`
5. Returns verification result with token

### Step 6: Onboarding with Token

**File:** `src/app/onboarding/page.tsx`

The onboarding page:
1. Reads `token`, `plan`, and `crm` from URL params (with `sessionStorage` fallback)
2. Calls `POST /api/payments/verify-token` to validate the JWT
3. If valid: shows the onboarding form pre-filled with plan info
4. If invalid/expired: shows an error with a link back to pricing

### Step 7: Submit Onboarding

**File:** `src/app/api/onboarding/route.ts`

The onboarding form submission:
1. Re-verifies the payment token
2. Saves agent data to MongoDB
3. Backs up data to Google Sheets
4. Sends confirmation email via Nodemailer
5. Returns success response

---

## API Routes Reference

### POST `/api/payments/create-checkout`

Creates a Square Checkout Link.

| Field | Type | Required | Description |
|---|---|---|---|
| `plan` | string | Yes | Plan identifier: `dealflow`, `marketedge`, `closepoint`, `core`, `scale` |
| `includeCRM` | boolean | No | Whether to add CRM addon ($99). Default: `false` |

**Success Response (200):**
```json
{
  "success": true,
  "checkoutUrl": "https://square.link/u/...",
  "orderId": "abc123"
}
```

**Error Responses:**
- `400` — Invalid or missing plan
- `500` — Square not configured / checkout creation failed

---

### POST `/api/payments/verify`

Verifies a completed payment by order ID.

| Field | Type | Required | Description |
|---|---|---|---|
| `orderId` | string | Yes | Square order ID from checkout redirect |

**Success Response (200):**
```json
{
  "verified": true,
  "accessToken": "eyJhbGciOi...",
  "plan": "dealflow",
  "includeCRM": false,
  "orderId": "abc123"
}
```

**Error Responses:**
- `400` — Missing order ID / payment not completed
- `500` — Square not configured / verification failed

---

### GET `/api/payments/verify?orderId=xxx`

Simple GET verification (returns less data, no token).

**Response (200):**
```json
{
  "verified": true,
  "plan": "dealflow",
  "includeCRM": false
}
```

---

### POST `/api/payments/verify-token`

Validates a JWT payment token (used by onboarding page).

| Field | Type | Required | Description |
|---|---|---|---|
| `token` | string | Yes | JWT access token from payment verification |

**Success Response (200):**
```json
{
  "valid": true,
  "payload": {
    "orderId": "abc123",
    "plan": "dealflow",
    "includeCRM": false,
    "customerEmail": "user@example.com",
    "totalAmount": 39900,
    "verifiedAt": "2026-03-13T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` — Missing or invalid token
- Token expired: `{ "valid": false, "error": "Token has expired..." }`

---

### POST `/api/payments/webhook`

Receives Square webhook events (server-to-server).

**Headers:**
- `x-square-hmacsha256-signature` — HMAC signature for verification

**Handled Events:**
- `payment.completed` — Logs payment details
- `payment.updated` — Logs status changes (FAILED, CANCELED)
- `order.fulfillment.updated` — Logs fulfillment updates
- `checkout.link.completed` — Logs checkout completion

**Always returns 200** to prevent Square from retrying.

---

## Core Library Files

### `src/lib/square.ts`

The Square SDK wrapper. Contains:

| Function | Description |
|---|---|
| `getSquareClient()` | Initializes Square SDK with token and environment |
| `getBaseUrl()` | Returns site URL with trailing slash stripped |
| `createCheckoutLink(plan, includeCRM)` | Creates a Square Checkout Payment Link |
| `verifyPayment(orderId)` | Verifies order status via Square Orders API |
| `verifyWebhookSignature(payload, signature, key)` | HMAC-SHA256 webhook signature verification |
| `getPaymentDetails(paymentId)` | Fetches payment details by ID |

### `src/lib/payment-tokens.ts`

JWT token management for secure onboarding access.

| Function | Description |
|---|---|
| `generateAccessToken(paymentData)` | Creates a JWT with payment details (expires in 24h) |
| `verifyAccessToken(token)` | Verifies and decodes a JWT |
| `decodeToken(token)` | Decodes without verification (debugging only) |

**Token Payload Structure:**
```typescript
interface PaymentTokenPayload {
  orderId: string;
  plan: string;
  includeCRM: boolean;
  customerEmail?: string;
  totalAmount: number;
  verifiedAt: string;  // ISO timestamp
}
```

---

## Client-Side Pages

| Page | File | Purpose |
|---|---|---|
| `/pricing` | `src/app/pricing/page.tsx` | Plan selection, review modal, initiates checkout |
| `/payment-success` | `src/app/payment-success/page.tsx` | Verifies payment, redirects to onboarding |
| `/payment-cancelled` | `src/app/payment-cancelled/page.tsx` | Shown when user cancels on Square |
| `/onboarding` | `src/app/onboarding/page.tsx` | Post-payment form for agent details |
| `/login` | `src/app/login/page.tsx` | Token entry for returning users |

---

## Price Configuration

**File:** `src/config/prices.ts`

All prices are in **cents** (USD).

| Plan | Price | Display Name |
|---|---|---|
| `dealflow` | $399.00 (39900) | Dealflow |
| `marketedge` | $699.00 (69900) | MarketEdge |
| `closepoint` | $999.00 (99900) | ClosePoint |
| `core` | $2,695.00 (269500) | Core (up to 5 agents) |
| `scale` | $3,899.00 (389900) | Scale (up to 10 agents) |
| CRM Add-on | $99.00 (9900) | GoHighLevel CRM |

### Helper Functions

```typescript
getPlanPrice("dealflow", false)    // → 39900
getPlanPrice("dealflow", true)     // → 49800 (plan + CRM)
formatPrice(39900)                 // → "$399.00"
getPlanDisplayName("marketedge")   // → "MarketEdge"
isValidPlan("dealflow")            // → true
```

---

## JWT Token System

### How It Works

1. **After payment verification**, the server generates a JWT containing payment details
2. **The token is passed** to the onboarding page via URL params (+ sessionStorage backup)
3. **The onboarding page** verifies the token before showing the form
4. **The onboarding API** re-verifies the token before accepting form submissions

### Token Properties
- **Algorithm:** HS256
- **Expiration:** 24 hours
- **Secret:** `JWT_SECRET` env var (falls back to `SQUARE_ACCESS_TOKEN`)
- **Payload:** order ID, plan, CRM flag, customer email, total amount, verification timestamp

### Why 24 Hours?
Users may close the browser after payment and return later to complete onboarding. The 24h window gives them enough time without leaving tokens valid indefinitely.

---

## Webhook Integration

### Purpose
Webhooks provide server-to-server confirmation of payment events, independent of the client-side redirect flow. This is important because:
- Users might close their browser before the redirect completes
- Network issues could prevent the client-side verification
- Provides an audit trail of all payment events

### Setup in Square Dashboard
1. Go to **Applications > Webhooks**
2. Add endpoint: `https://re.marketlyn.com/api/payments/webhook`
3. Subscribe to: `payment.completed`, `payment.updated`, `order.fulfillment.updated`, `checkout.link.completed`
4. Copy the **Signature Key** to `SQUARE_WEBHOOK_SIGNATURE_KEY`

### Signature Verification
```typescript
// Uses HMAC-SHA256 with timing-safe comparison
const hmac = crypto.createHmac("sha256", webhookSignatureKey);
hmac.update(payload);
const expectedSignature = hmac.digest("base64");
crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
```

If `SQUARE_WEBHOOK_SIGNATURE_KEY` is not set, signature verification is skipped (with a console warning).

---

## Security Measures

| Measure | Implementation |
|---|---|
| **PCI Compliance** | Card details never touch our servers — Square hosted checkout handles all card input |
| **JWT Tokens** | Payment verification tokens are signed with HS256, expire in 24h |
| **Webhook Signatures** | HMAC-SHA256 with timing-safe comparison prevents spoofed webhooks |
| **Server-side Validation** | Plan names validated against whitelist, order verified via Square API |
| **Idempotency** | Each checkout uses `crypto.randomUUID()` as idempotency key |
| **Environment Isolation** | Sandbox/Production toggle via `SQUARE_ENVIRONMENT` |
| **No Secrets Client-side** | Only `NEXT_PUBLIC_SITE_URL` is exposed to the browser |
| **Input Validation** | All API routes validate required fields before processing |

---

## Troubleshooting

### "Payment could not be processed"
- Check `SQUARE_ACCESS_TOKEN` is valid and not expired
- Check `SQUARE_LOCATION_ID` matches your active Square location
- Check `SQUARE_ENVIRONMENT` matches your token type (sandbox token won't work in production)
- Check Vercel function logs for the specific Square error message

### "Localhost could not connect" / 404 After Payment
- **Cause:** `NEXT_PUBLIC_SITE_URL` doesn't match your actual domain
- **Fix:** Set `NEXT_PUBLIC_SITE_URL=https://re.marketlyn.com` in both `.env.local` AND Vercel environment variables
- **Note:** Existing checkout links created before the fix will still redirect to the old URL — users need to start a new checkout

### "Token has expired"
- The JWT token is valid for 24 hours after payment
- If the user returns after 24h, they need to contact support or re-purchase
- The 24h window was chosen to balance convenience with security

### "Payment not completed or order not found"
- Square may have a delay before marking an order as COMPLETED
- The client retries 3 times with 2-second delays to handle this
- If it still fails, the payment may have genuinely failed — check Square Dashboard

### Payment Succeeded but Onboarding Shows Error
- Check that `JWT_SECRET` hasn't changed between payment verification and onboarding
- Check that the token is being passed correctly in URL params
- The `sessionStorage` backup is used if URL params are lost (e.g., browser back button)

### Webhook Not Firing
- Verify the webhook URL is registered in Square Dashboard
- URL must be: `https://re.marketlyn.com/api/payments/webhook`
- Check that the endpoint is accessible (not blocked by firewall/WAF)
- Square retries failed webhooks, but returns 200 even on processing errors to prevent excessive retries

---

## Testing with Sandbox

### Switch to Sandbox Mode
1. In `.env.local`, set:
   ```env
   SQUARE_ENVIRONMENT=sandbox
   SQUARE_ACCESS_TOKEN=EAAAl2IS...your_sandbox_token
   SQUARE_LOCATION_ID=LEKKG0F35X6VB
   ```
2. Restart the dev server

### Sandbox Test Card Numbers
| Card | Number |
|---|---|
| Visa (success) | `4532 0123 4567 8901` |
| Mastercard (success) | `5500 0000 0000 0004` |
| Amex (success) | `3400 000000 00009` |
| Decline | `4000 0000 0000 0002` |

### Sandbox vs Production Differences
- Sandbox transactions don't move real money
- Sandbox has its own access tokens, location IDs, and webhook URLs
- Always test the full flow (checkout → verify → onboarding) before going live

---

## Going Live Checklist

- [ ] `SQUARE_ENVIRONMENT=production` in `.env.local` and Vercel
- [ ] `SQUARE_ACCESS_TOKEN` is the **production** token (not sandbox)
- [ ] `SQUARE_LOCATION_ID` is the **production** location
- [ ] `NEXT_PUBLIC_SITE_URL=https://re.marketlyn.com` (exact domain, no trailing slash)
- [ ] `JWT_SECRET` is set to a strong random value (`openssl rand -hex 32`)
- [ ] Webhook configured in Square Dashboard pointing to `https://re.marketlyn.com/api/payments/webhook`
- [ ] `SQUARE_WEBHOOK_SIGNATURE_KEY` is set from the webhook configuration
- [ ] All environment variables are added to **Vercel Project Settings > Environment Variables**
- [ ] Test a real payment end-to-end (checkout → payment success → onboarding)
- [ ] Verify the webhook is receiving events in Vercel function logs
