import { Client, Environment, OrdersController, CheckoutPaymentIntent, PaypalExperienceUserAction, PaypalExperienceLandingPage } from "@paypal/paypal-server-sdk";
import { getPlanPrice, getPlanDisplayName, CRM_ADDON_PRICE } from "@/config/prices";
import crypto from "crypto";

// Singleton PayPal client — reused across warm serverless invocations
let cachedClient: Client | null = null;

const getPayPalClient = (): Client => {
  if (cachedClient) return cachedClient;

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be configured");
  }

  cachedClient = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: clientId,
      oAuthClientSecret: clientSecret,
    },
    environment: process.env.PAYPAL_ENVIRONMENT === "production"
      ? Environment.Production
      : Environment.Sandbox,
  });

  return cachedClient;
};

// Get the base URL for redirects (strip trailing slash for safety)
const getBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "https://re.marketlyne.com";
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    console.warn("[PayPal] WARNING: NEXT_PUBLIC_SITE_URL is not set, using fallback: https://re.marketlyne.com");
  }
  return url.replace(/\/+$/, "");
};

// Convert cents to dollar string for PayPal (e.g., 39900 → "399.00")
const centsToDollars = (cents: number): string => {
  return (cents / 100).toFixed(2);
};

interface CheckoutLinkResult {
  checkoutUrl: string;
  orderId: string;
}

/**
 * Create a PayPal Checkout Order for a plan purchase
 * @param plan - The plan identifier (e.g., "dealflow", "marketedge")
 * @param includeCRM - Whether to include the CRM addon
 * @returns Object containing checkout URL and order ID
 */
export const createCheckoutLink = async (
  plan: string,
  includeCRM: boolean = false
): Promise<CheckoutLinkResult> => {
  const client = getPayPalClient();
  const ordersController = new OrdersController(client);

  const baseUrl = getBaseUrl();
  const returnUrl = `${baseUrl}/payment-success`;
  const cancelUrl = `${baseUrl}/payment-cancelled`;
  console.log(`[PayPal] Creating order with returnUrl: ${returnUrl}`);

  const planPrice = getPlanPrice(plan, false);
  const planName = getPlanDisplayName(plan);
  const totalPrice = getPlanPrice(plan, includeCRM);

  // Build line items
  const items = [
    {
      name: `${planName} Plan`,
      quantity: "1",
      unitAmount: {
        currencyCode: "USD",
        value: centsToDollars(planPrice),
      },
    },
  ];

  // Add CRM addon if selected
  if (includeCRM) {
    items.push({
      name: "CRM Add-on (GoHighLevel)",
      quantity: "1",
      unitAmount: {
        currencyCode: "USD",
        value: centsToDollars(CRM_ADDON_PRICE),
      },
    });
  }

  // Store plan metadata in custom_id (max 127 chars)
  const customData = JSON.stringify({ plan: plan.toLowerCase(), includeCRM });

  // Create the order
  const response = await ordersController.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          customId: customData,
          amount: {
            currencyCode: "USD",
            value: centsToDollars(totalPrice),
            breakdown: {
              itemTotal: {
                currencyCode: "USD",
                value: centsToDollars(totalPrice),
              },
            },
          },
          items,
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            returnUrl,
            cancelUrl,
            brandName: "Marketlyne",
            userAction: PaypalExperienceUserAction.PayNow,
            landingPage: PaypalExperienceLandingPage.Login,
          },
        },
      },
    },
    paypalRequestId: crypto.randomUUID(),
    prefer: "return=representation",
  });

  const order = response.result;
  const approveLink = order.links?.find(
    (link: { rel?: string }) => link.rel === "payer-action"
  );

  if (!approveLink?.href || !order.id) {
    throw new Error("Failed to create PayPal checkout order");
  }

  return {
    checkoutUrl: approveLink.href,
    orderId: order.id,
  };
};

interface PaymentVerificationResult {
  verified: boolean;
  plan: string;
  includeCRM: boolean;
  customerEmail?: string;
  totalAmount: number;
  orderId: string;
}

/**
 * Capture and verify a PayPal order after user approval
 * @param orderId - The PayPal order ID to capture and verify
 * @returns Verification result with order details
 */
export const verifyPayment = async (orderId: string): Promise<PaymentVerificationResult> => {
  const client = getPayPalClient();
  const ordersController = new OrdersController(client);

  try {
    // First, try to capture the order (required after user approves)
    let order;
    try {
      const captureResponse = await ordersController.captureOrder({
        id: orderId,
        prefer: "return=representation",
      });
      order = captureResponse.result;
    } catch (captureError: unknown) {
      // If capture fails, the order might already be captured — fetch it
      const errMessage = captureError instanceof Error ? captureError.message : String(captureError);
      console.warn(`[PayPal] Capture attempt returned error (may already be captured): ${errMessage}`);

      const getResponse = await ordersController.getOrder({ id: orderId });
      order = getResponse.result;
    }

    if (!order) {
      return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
    }

    // Check if the order is completed
    const isCompleted = order.status === "COMPLETED";

    // Verify purchase unit exists
    const purchaseUnit = order.purchaseUnits?.[0];
    if (!purchaseUnit) {
      console.error(`[PayPal] No purchase unit found in order ${orderId}`);
      return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
    }

    // Extract metadata from custom_id
    let plan = "";
    let includeCRM = false;

    if (purchaseUnit.customId) {
      try {
        const meta = JSON.parse(purchaseUnit.customId);
        plan = meta.plan || "";
        includeCRM = meta.includeCRM === true;
      } catch {
        console.warn("[PayPal] Could not parse custom_id metadata");
      }
    }

    // Reject if plan metadata is missing (prevents bypassing amount verification)
    if (!plan) {
      console.error(`[PayPal] Order ${orderId} is missing plan metadata — rejecting`);
      return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
    }

    // Get total amount in cents (avoid floating-point by parsing as string)
    const amountStr = purchaseUnit.amount?.value || "0";
    const [dollars = "0", cents = "0"] = amountStr.split(".");
    const totalAmount = parseInt(dollars, 10) * 100 + parseInt(cents.padEnd(2, "0").slice(0, 2), 10);

    // Verify the paid amount matches expected plan price (prevent underpayment)
    if (isCompleted) {
      const expectedAmount = getPlanPrice(plan, includeCRM);
      if (totalAmount < expectedAmount) {
        console.error(`[PayPal] AMOUNT MISMATCH: order ${orderId} paid ${totalAmount} but expected ${expectedAmount} for plan "${plan}" (CRM: ${includeCRM})`);
        return { verified: false, plan, includeCRM, totalAmount, orderId };
      }
    }

    // Get customer email from payer info
    const customerEmail = order.payer?.emailAddress ?? undefined;

    return {
      verified: isCompleted,
      plan,
      includeCRM,
      customerEmail,
      totalAmount,
      orderId,
    };
  } catch (error) {
    console.error("[PayPal] Error verifying payment:", error);
    return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
  }
};

/**
 * Verify PayPal webhook signature
 * PayPal uses a CRC32 + SHA256 signature scheme with transmission headers.
 * For full verification, use PayPal's Verify Webhook Signature API.
 * This is a lightweight check using the webhook ID.
 *
 * @param headers - The request headers from PayPal
 * @param payload - Raw request body
 * @param webhookId - Your webhook ID from PayPal Dashboard
 * @returns Whether the signature appears valid
 */
export const verifyWebhookSignature = async (
  headers: Record<string, string>,
  payload: string,
  webhookId: string
): Promise<boolean> => {
  if (!webhookId) return false;

  const transmissionId = headers["paypal-transmission-id"];
  const transmissionTime = headers["paypal-transmission-time"];
  const transmissionSig = headers["paypal-transmission-sig"];
  const certUrl = headers["paypal-cert-url"];

  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl) {
    console.error("[PayPal] Missing webhook signature headers");
    return false;
  }

  // Use PayPal's Verify Webhook Signature API for production-grade verification
  try {
    const client = getPayPalClient();
    const accessToken = await client.clientCredentialsAuthManager.fetchToken();

    const baseUrl = process.env.PAYPAL_ENVIRONMENT === "production"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

    // Parse payload before sending (validate JSON)
    let webhookEvent;
    try {
      webhookEvent = JSON.parse(payload);
    } catch {
      console.error("[PayPal] Webhook payload is not valid JSON");
      return false;
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken.accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: headers["paypal-auth-algo"],
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const result = await verifyResponse.json();
    return result.verification_status === "SUCCESS";
  } catch (error) {
    console.error("[PayPal] Webhook signature verification failed:", error);
    return false;
  }
};

/**
 * Read-only order status check — does NOT attempt to capture.
 * Safe to expose via unauthenticated GET endpoints.
 */
export const getOrderStatus = async (orderId: string): Promise<{ verified: boolean; plan: string; includeCRM: boolean }> => {
  const client = getPayPalClient();
  const ordersController = new OrdersController(client);

  try {
    const response = await ordersController.getOrder({ id: orderId });
    const order = response.result;

    if (!order) {
      return { verified: false, plan: "", includeCRM: false };
    }

    const purchaseUnit = order.purchaseUnits?.[0];
    let plan = "";
    let includeCRM = false;

    if (purchaseUnit?.customId) {
      try {
        const meta = JSON.parse(purchaseUnit.customId);
        plan = meta.plan || "";
        includeCRM = meta.includeCRM === true;
      } catch {
        // ignore parse error
      }
    }

    return {
      verified: order.status === "COMPLETED",
      plan,
      includeCRM,
    };
  } catch (error) {
    console.error("[PayPal] Error fetching order status:", error);
    return { verified: false, plan: "", includeCRM: false };
  }
};

/**
 * Create a PayPal order for Advanced Card Fields (no redirect URLs needed).
 * The client-side card fields provide the payment source.
 */
export const createOrderForCardPayment = async (
  plan: string,
  includeCRM: boolean = false
): Promise<{ orderId: string }> => {
  const client = getPayPalClient();
  const ordersController = new OrdersController(client);

  const planPrice = getPlanPrice(plan, false);
  const planName = getPlanDisplayName(plan);
  const totalPrice = getPlanPrice(plan, includeCRM);

  const items = [
    {
      name: `${planName} Plan`,
      quantity: "1",
      unitAmount: {
        currencyCode: "USD",
        value: centsToDollars(planPrice),
      },
    },
  ];

  if (includeCRM) {
    items.push({
      name: "CRM Add-on (GoHighLevel)",
      quantity: "1",
      unitAmount: {
        currencyCode: "USD",
        value: centsToDollars(CRM_ADDON_PRICE),
      },
    });
  }

  const customData = JSON.stringify({ plan: plan.toLowerCase(), includeCRM });

  const response = await ordersController.createOrder({
    body: {
      intent: CheckoutPaymentIntent.Capture,
      purchaseUnits: [
        {
          customId: customData,
          amount: {
            currencyCode: "USD",
            value: centsToDollars(totalPrice),
            breakdown: {
              itemTotal: {
                currencyCode: "USD",
                value: centsToDollars(totalPrice),
              },
            },
          },
          items,
        },
      ],
    },
    paypalRequestId: crypto.randomUUID(),
    prefer: "return=representation",
  });

  const order = response.result;
  if (!order.id) {
    throw new Error("Failed to create PayPal order for card payment");
  }

  return { orderId: order.id };
};

/**
 * Capture a PayPal order and verify the payment details.
 * Used after card fields approval (Advanced Card Fields flow).
 */
export const captureAndVerifyOrder = async (orderId: string): Promise<PaymentVerificationResult> => {
  const client = getPayPalClient();
  const ordersController = new OrdersController(client);

  try {
    const captureResponse = await ordersController.captureOrder({
      id: orderId,
      prefer: "return=representation",
    });
    const order = captureResponse.result;

    if (!order) {
      return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
    }

    const isCompleted = order.status === "COMPLETED";

    const purchaseUnit = order.purchaseUnits?.[0];
    if (!purchaseUnit) {
      console.error(`[PayPal] No purchase unit found in order ${orderId}`);
      return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
    }

    let plan = "";
    let includeCRM = false;

    if (purchaseUnit.customId) {
      try {
        const meta = JSON.parse(purchaseUnit.customId);
        plan = meta.plan || "";
        includeCRM = meta.includeCRM === true;
      } catch {
        console.warn("[PayPal] Could not parse custom_id metadata");
      }
    }

    if (!plan) {
      console.error(`[PayPal] Order ${orderId} is missing plan metadata — rejecting`);
      return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
    }

    const amountStr = purchaseUnit.amount?.value || "0";
    const [dollars = "0", cents = "0"] = amountStr.split(".");
    const totalAmount = parseInt(dollars, 10) * 100 + parseInt(cents.padEnd(2, "0").slice(0, 2), 10);

    if (isCompleted) {
      const expectedAmount = getPlanPrice(plan, includeCRM);
      if (totalAmount < expectedAmount) {
        console.error(`[PayPal] AMOUNT MISMATCH: order ${orderId} paid ${totalAmount} but expected ${expectedAmount}`);
        return { verified: false, plan, includeCRM, totalAmount, orderId };
      }
    }

    const customerEmail = order.payer?.emailAddress ?? undefined;

    return { verified: isCompleted, plan, includeCRM, customerEmail, totalAmount, orderId };
  } catch (error) {
    console.error("[PayPal] Error capturing order:", error);
    return { verified: false, plan: "", includeCRM: false, totalAmount: 0, orderId };
  }
};

export { getPayPalClient };
