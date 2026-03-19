# Enable Card Payments on Your Website — PayPal Setup Guide

Hi! To allow customers to pay with credit/debit cards directly on your website (without being redirected to PayPal), we need you to enable **Advanced Card Processing** on your PayPal Business account.

This is a one-time setup that takes about 5–10 minutes.

---

## Step 1: Ensure You Have a PayPal Business Account

- You need a **PayPal Business account** (not Personal).
- If you don't have one, upgrade at: https://www.paypal.com/business
- If you already have a Business account, skip to Step 2.

---

## Step 2: Enable Advanced Card Processing

1. **Log in** to your PayPal account at https://www.paypal.com
2. Go to **Account Settings** → **Payment Preferences** → **Payment methods accepted**
3. Make sure **Credit and Debit Cards** is enabled
4. If you see an option for **Advanced Credit and Debit Card Payments**, enable it

### Alternative method (via Developer Dashboard):

1. Go to https://developer.paypal.com/dashboard/
2. Log in with your PayPal Business account
3. Click **Apps & Credentials** in the left sidebar
4. Select **Live** (not Sandbox) at the top
5. Click on your app name (the one connected to your website)
6. Scroll down to **Features** section
7. Look for **Advanced Card Processing** — click **Enable** or **Apply**
8. PayPal may ask you to:
   - Confirm your business information
   - Accept additional terms for card processing
   - Provide business documentation (rare, usually instant approval)

> **Note:** Most PayPal Business accounts get approved instantly. In some cases, PayPal may take 1–2 business days to review.

---

## Step 3: Enable Guest Checkout (Recommended)

This allows customers to pay with a card **without needing a PayPal account**.

1. Log in to https://www.paypal.com
2. Go to **Account Settings** → **Website Payments**
3. Find **Website Preferences** → click **Update**
4. Under **PayPal Account Optional**, select **On**
5. Click **Save**

---

## Step 4: Verify It's Working

Once you've completed the steps above, let me know and I'll test the integration. You should see a card payment form appear directly on the pricing page when a customer clicks to purchase a plan.

### What Customers Will See:
- A card form (card number, expiration, CVV) appears in the order review popup
- Customer enters their card details and clicks **"Pay Now"**
- Payment is processed instantly — no redirect to PayPal
- Customer is taken directly to the onboarding form

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Card form shows "Loading..." and never appears | Advanced Card Processing is not enabled — follow Step 2 above |
| Customer sees "Card payments not available" | Your PayPal app doesn't have card processing enabled — check Step 2 |
| PayPal says "Application pending review" | Wait 1–2 business days for PayPal to approve, then try again |
| Customer can't pay without a PayPal account | Enable Guest Checkout — follow Step 3 above |

---

## What You DON'T Need to Do

- ❌ You don't need to change any API keys or credentials
- ❌ You don't need to create a new PayPal app
- ❌ You don't need to touch any code or website settings
- ❌ You don't need to set up a payment gateway separately — PayPal handles everything

---

## Questions?

If you run into any issues or need help, reach out to me and I'll walk you through it. You can also contact PayPal Business Support at:
- **Phone:** 1-888-221-1161
- **Online:** https://www.paypal.com/smarthelp/contact-us

---

*This guide is for enabling direct card payments on re.marketlyne.com using PayPal Advanced Card Processing.*
