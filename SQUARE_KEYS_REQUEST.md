# Square Production Keys — What We Need From You

Hi,

We need the following credentials from your **Square account** to enable live payments on the Marketlyn website. Payments are currently being declined because the keys may not be correctly configured for production.

Please follow the steps below carefully. This should take about 5-10 minutes.

---

## Before You Start — Important Checks

### 1. Make sure your Square account is FULLY ACTIVATED

- Log in at [https://squareup.com/dashboard](https://squareup.com/dashboard)
- Go to **Account & Settings > Business Information**
- Verify your business identity is **fully verified** (green checkmark)
- If there are any pending verification steps, complete them first — payments WILL be declined until verification is done

### 2. Make sure Online Payments are ENABLED

- Go to **Account & Settings > Business > Online**
- Ensure **Online Payments** is turned ON
- If you don't see this option, your account type may not support online payments — contact Square Support

### 3. Make sure the Location is ACTIVE

- Go to **Account & Settings > Locations**
- The location you use must show as **Active**
- If it says "Inactive" or "Deactivated", reactivate it or use a different location

---

## Keys We Need (6 items total)

### Key 1: Production Access Token

1. Go to [https://developer.squareup.com/apps](https://developer.squareup.com/apps)
2. Click on your application (or create one if none exists — name it "Marketlyn")
3. Click **Credentials** in the left sidebar
4. **IMPORTANT:** Make sure you are on the **Production** tab (NOT Sandbox)
5. Click **Show** next to "Production Access Token"
6. If you see a button that says **"Create Production Access Token"** — click it first
7. Copy the full token — it starts with `EAAA...`

> **Label it as:** `SQUARE_ACCESS_TOKEN`

### Key 2: Application ID

1. On the same **Credentials** page (Production tab)
2. Copy the **Application ID** — it starts with `sq0idp-...`

> **Label it as:** `SQUARE_APPLICATION_ID`

### Key 3: Location ID

1. Go to [https://developer.squareup.com/apps](https://developer.squareup.com/apps)
2. Click on your application
3. Click **Locations** in the left sidebar
4. You'll see a list of business locations
5. Copy the **Location ID** for your main/active location — it looks like `L7KKR...`

**Alternatively:**
1. Go to [https://squareup.com/dashboard/locations](https://squareup.com/dashboard/locations)
2. Click on your location
3. The Location ID is in the URL: `squareup.com/dashboard/locations/XXXXXXXX`

> **Label it as:** `SQUARE_LOCATION_ID`

### Key 4: Webhook Signature Key

1. Go to [https://developer.squareup.com/apps](https://developer.squareup.com/apps)
2. Click on your application
3. Click **Webhooks** in the left sidebar
4. Click **Add Endpoint** (or edit existing)
5. Set the URL to: `https://re.marketlyn.com/api/payments/webhook`
6. Subscribe to these events:
   - `payment.completed`
   - `payment.updated`
   - `order.fulfillment.updated`
7. Click **Save**
8. After saving, you'll see a **Signature Key** — copy it

> **Label it as:** `SQUARE_WEBHOOK_SIGNATURE_KEY`

### Key 5: Environment Confirmation

Please confirm: **Are you using a Production (live) Square account, or a Sandbox (testing) account?**

We need this to set:
> `SQUARE_ENVIRONMENT` = `production` or `sandbox`

### Key 6: Website URL Confirmation

Please confirm the exact URL where your website is hosted:
> Currently set to: `https://re.marketlyn.com`

This is critical — if this doesn't match exactly, payments will redirect to the wrong page after checkout.

---

## How To Send Us The Keys

Please send the following filled out (via secure channel — NOT plain email if possible):

```
SQUARE_ENVIRONMENT=production
SQUARE_ACCESS_TOKEN=EAAA...your_production_token_here
SQUARE_APPLICATION_ID=sq0idp-...your_app_id_here
SQUARE_LOCATION_ID=L...your_location_id_here
SQUARE_WEBHOOK_SIGNATURE_KEY=...your_webhook_key_here
NEXT_PUBLIC_SITE_URL=https://re.marketlyn.com
```

---

## Why Are Payments Being Declined?

The most common reasons for payment declines on a new Square integration:

| Reason | How to Check |
|---|---|
| **Square account not fully verified** | Dashboard > Account & Settings > Business Information — look for verification status |
| **Using Sandbox token in Production mode** | The token on the Credentials page must be from the **Production** tab, not Sandbox |
| **Online payments not enabled** | Dashboard > Account & Settings > Online — toggle must be ON |
| **Location is inactive** | Dashboard > Locations — must show "Active" |
| **Access token expired or revoked** | Regenerate a new token on the Credentials page |
| **Card issuer declining** | This is the customer's bank — ask them to try a different card |

### How To Check If Your Token Is Production or Sandbox

Both production and sandbox tokens start with `EAAA`. The only way to confirm is:
1. Go to the Developer Dashboard
2. Click your app > Credentials
3. Check which tab is selected — **Production** or **Sandbox**
4. The token shown on the **Production** tab is your production token

### Quick Test

After sending us the keys, we can run a test payment for $1 to confirm everything works before going live.

---

## Square Support Contact

If you have trouble finding any of these keys or your account has issues:
- Square Developer Support: [https://developer.squareup.com/forums](https://developer.squareup.com/forums)
- Square Seller Support: [https://squareup.com/help](https://squareup.com/help)
- Square Phone Support: 1-855-700-6000

---

## Summary Checklist

- [ ] Square account is fully verified (business identity confirmed)
- [ ] Online payments are enabled
- [ ] Location is active
- [ ] Production Access Token copied from Production tab (NOT Sandbox)
- [ ] Application ID copied
- [ ] Location ID copied
- [ ] Webhook endpoint created pointing to `https://re.marketlyn.com/api/payments/webhook`
- [ ] Webhook Signature Key copied
- [ ] All 6 values sent to developer via secure channel
