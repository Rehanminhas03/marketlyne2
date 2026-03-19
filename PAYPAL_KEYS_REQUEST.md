# PayPal Setup Guide — Sandbox to Live

Hi! Thank you for providing the **sandbox (testing)** credentials. The payment integration is built and working in test mode. Now we need your **Live (production)** credentials to start accepting real payments.

---

## Current Status

| Item | Status |
|------|--------|
| Sandbox Client ID | Received |
| Sandbox Client Secret | Received |
| Sandbox Test Account | Received |
| **Live Client ID** | **Needed** |
| **Live Client Secret** | **Needed** |
| **Live Webhook ID** | **Needed** |

> **Important:** Sandbox credentials only work for test transactions with fake money. To accept real customer payments, we must switch to Live credentials.

---

## What is Sandbox vs Live?

| | Sandbox (Testing) | Live (Production) |
|--|-------------------|-------------------|
| **Purpose** | Test payments with fake money | Accept real payments from customers |
| **Money** | No real charges | Real money is charged and deposited |
| **Dashboard Tab** | "Sandbox" tab | "Live" tab |
| **URL** | sandbox.paypal.com | paypal.com |
| **Credentials** | Start with test prefixes | Unique to your business |

---

## What I Need From You (3 items)

| # | Credential | Description |
|---|-----------|-------------|
| 1 | **Live Client ID** | Your production app's Client ID |
| 2 | **Live Client Secret** | Your production app's Client Secret |
| 3 | **Live Webhook ID** | The ID generated after setting up the webhook |

---

## Step-by-Step Instructions

### Prerequisites

Before starting, make sure you have:
- A **PayPal Business account** (not Personal)
  - If you have a Personal account, upgrade at [paypal.com/upgrade](https://www.paypal.com/upgrade)
- Your account must be **verified** (bank account or debit/credit card linked)
- Your account must be able to **accept payments**
  - Check at: Account Settings > Payment Preferences > "Block Payments" should NOT block everything

---

### Step 1: Go to the Developer Dashboard

1. Open [developer.paypal.com/dashboard](https://developer.paypal.com/dashboard)
2. Log in with your **PayPal Business account** credentials (the real account, not the sandbox test email)

---

### Step 2: Switch to the Live Tab

1. Click **"Apps & Credentials"** in the left sidebar
2. At the top, you'll see two tabs: **Sandbox** and **Live**
3. Click the **"Live"** tab

> This is the most important step — you already provided Sandbox credentials. Now we need the Live ones.

---

### Step 3: Create a Live App (if you don't have one)

1. On the **Live** tab, click **"Create App"**
2. Fill in:
   - **App Name**: `Marketlyne Website` (or any name you prefer)
   - **App Type**: Select **Merchant**
3. Click **"Create App"**

> If you already have a Live app, just click on it to open its details.

---

### Step 4: Copy the Live Client ID and Secret

On the app details page, you'll see:

1. **Client ID** — a long string of letters and numbers. Copy the entire string.
2. **Secret** — click the **"Show"** button to reveal it, then copy the entire string.

**Example format** (yours will be different):
```
Client ID:  AaBbCcDdEeFf1234567890...
Secret:     EFghIjKlMnOp1234567890...
```

---

### Step 5: Set Up the Live Webhook

This allows PayPal to notify our website when a payment is completed.

1. On the same app details page, scroll down to the **"Webhooks"** section
2. Click **"Add Webhook"**
3. Enter this exact URL:
   ```
   https://re.marketlyne.com/api/payments/webhook
   ```
4. Under **"Events"**, select these 4 events:
   - `CHECKOUT.ORDER.APPROVED`
   - `CHECKOUT.ORDER.COMPLETED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
5. Click **"Save"**
6. After saving, the webhook will appear in the list with a **Webhook ID** — copy this ID

---

### Step 6: Send Me the Credentials

Please send me these 3 items:

```
Live Client ID:     ____________________________
Live Client Secret: ____________________________
Live Webhook ID:    ____________________________
```

#### How to Send Securely

Please **DO NOT** send credentials over plain email or Slack. Use one of these secure methods:

| Method | How |
|--------|-----|
| **One-time secret link** | Go to [onetimesecret.com](https://onetimesecret.com/), paste credentials, share the generated link |
| **Password manager** | Share via 1Password, LastPass, Bitwarden, etc. |
| **Encrypted message** | Use WhatsApp, Signal, or any encrypted messaging app |

---

## What Happens After You Send Me the Credentials

1. I'll replace the sandbox credentials with your Live credentials
2. I'll set the environment to **production**
3. I'll deploy the changes to the live website
4. Real customers will be able to pay through PayPal
5. Payments will be deposited directly into your PayPal Business account

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "I don't see a Live tab" | Make sure you're logged in with a Business account, not Personal |
| "Create App button is grayed out" | Your account may need verification first — check Account Settings |
| "I can't find the Webhooks section" | Scroll down on the app details page — Webhooks is below the API credentials |
| "Webhook URL validation fails" | Make sure the URL is exactly `https://re.marketlyne.com/api/payments/webhook` with no spaces or trailing slash |
| "I don't see a Webhook ID after saving" | Click on the webhook you just created — the ID will be shown in the details |
| "Account not verified" | Go to PayPal > Settings > Complete identity verification (link bank account or provide documents) |
| "I already have Live credentials from before" | Great! Just send them along with a new webhook setup for our URL |

---

## Pre-Go-Live Checklist

Please confirm all items before we go live:

- [ ] PayPal **Business** account is verified and active
- [ ] Account can accept online payments (not blocked)
- [ ] Bank account or card linked for receiving funds
- [ ] **Live** app created in Developer Dashboard (not Sandbox)
- [ ] **Live Client ID** — copied and sent
- [ ] **Live Client Secret** — copied and sent
- [ ] **Webhook** created on the Live app with URL: `https://re.marketlyne.com/api/payments/webhook`
- [ ] **Webhook ID** — copied and sent
- [ ] All 4 webhook events subscribed:
  - [ ] `CHECKOUT.ORDER.APPROVED`
  - [ ] `CHECKOUT.ORDER.COMPLETED`
  - [ ] `PAYMENT.CAPTURE.COMPLETED`
  - [ ] `PAYMENT.CAPTURE.DENIED`

---

## Quick Reference

| Setting | Value |
|---------|-------|
| Website URL | `https://re.marketlyne.com` |
| Webhook URL | `https://re.marketlyne.com/api/payments/webhook` |
| Payment Method | PayPal Checkout (Orders API v2) |
| Currency | USD |

---

Once I receive the 3 Live credentials, I'll have the production payment system running within the hour. Thank you!
