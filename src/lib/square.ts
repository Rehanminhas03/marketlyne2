import { SquareClient, SquareEnvironment, Currency } from "square";
import { getPlanPrice, getPlanDisplayName, CRM_ADDON_PRICE } from "@/config/prices";
import crypto from "crypto";

// Singleton Square client — reused across warm serverless invocations
let cachedClient: SquareClient | null = null;

const getSquareClient = (): SquareClient => {
  if (cachedClient) return cachedClient;

  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("SQUARE_ACCESS_TOKEN is not configured");
  }

  cachedClient = new SquareClient({
    token,
    environment: process.env.SQUARE_ENVIRONMENT === "production"
      ? SquareEnvironment.Production
      : SquareEnvironment.Sandbox,
  });
  return cachedClient;
};

// Get the base URL for redirects (strip trailing slash for safety)
const getBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_SITE_URL || "https://re.marketlyne.com";
  if (!process.env.NEXT_PUBLIC_SITE_URL) {
    console.warn("[Square] WARNING: NEXT_PUBLIC_SITE_URL is not set, using fallback: https://re.marketlyne.com");
  }
  return url.replace(/\/+$/, "");
};

interface CheckoutLinkResult {
  checkoutUrl: string;
  orderId: string;
}

/**
 * Create a Square Checkout Link for a plan purchase
 * @param plan - The plan identifier (e.g., "dealflow", "marketedge")
 * @param includeCRM - Whether to include the CRM addon
 * @returns Object containing checkout URL and order ID
 */
export const createCheckoutLink = async (
  plan: string,
  includeCRM: boolean = false
): Promise<CheckoutLinkResult> => {
  const client = getSquareClient();
  const locationId = process.env.SQUARE_LOCATION_ID;

  if (!locationId) {
    throw new Error("SQUARE_LOCATION_ID is not configured");
  }

  const baseUrl = getBaseUrl();
  const redirectUrl = `${baseUrl}/payment-success`;
  console.log(`[Square] Creating checkout link with redirectUrl: ${redirectUrl}`);
  const planPrice = getPlanPrice(plan, false);
  const planName = getPlanDisplayName(plan);

  // Build line items
  const lineItems = [
    {
      name: `${planName} Plan`,
      quantity: "1",
      basePriceMoney: {
        amount: BigInt(planPrice),
        currency: Currency.Usd,
      },
    },
  ];

  // Add CRM addon if selected
  if (includeCRM) {
    lineItems.push({
      name: "CRM Add-on (GoHighLevel)",
      quantity: "1",
      basePriceMoney: {
        amount: BigInt(CRM_ADDON_PRICE),
        currency: Currency.Usd,
      },
    });
  }

  // Generate unique idempotency key
  const idempotencyKey = crypto.randomUUID();

  // Create the checkout link
  const response = await client.checkout.paymentLinks.create({
    idempotencyKey,
    order: {
      locationId,
      lineItems,
      metadata: {
        plan: plan.toLowerCase(),
        includeCRM: includeCRM.toString(),
      },
    },
    checkoutOptions: {
      redirectUrl,
      askForShippingAddress: false,
    },
    prePopulatedData: {
      buyerEmail: undefined,
    },
  });

  if (!response.paymentLink?.url || !response.paymentLink?.orderId) {
    throw new Error("Failed to create checkout link");
  }

  return {
    checkoutUrl: response.paymentLink.url,
    orderId: response.paymentLink.orderId,
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
 * Verify a payment/order was completed successfully
 * @param orderId - The Square order ID to verify
 * @returns Verification result with order details
 */
export const verifyPayment = async (orderId: string): Promise<PaymentVerificationResult> => {
  const client = getSquareClient();

  try {
    // Get the order details
    const orderResponse = await client.orders.get({ orderId });
    const order = orderResponse.order;

    if (!order) {
      return {
        verified: false,
        plan: "",
        includeCRM: false,
        totalAmount: 0,
        orderId,
      };
    }

    // Check if the order is paid
    const isPaid = order.state === "COMPLETED";

    // Extract metadata
    const plan = order.metadata?.plan || "";
    const includeCRM = order.metadata?.includeCRM === "true";

    // Get total amount
    const totalAmount = Number(order.totalMoney?.amount || 0);

    // Verify the paid amount matches expected plan price (prevent underpayment)
    if (isPaid && plan) {
      const expectedAmount = getPlanPrice(plan, includeCRM);
      if (totalAmount < expectedAmount) {
        console.error(`[Square] AMOUNT MISMATCH: order ${orderId} paid ${totalAmount} but expected ${expectedAmount} for plan "${plan}" (CRM: ${includeCRM})`);
        return {
          verified: false,
          plan,
          includeCRM,
          totalAmount,
          orderId,
        };
      }
    }

    // Get customer email from tenders if available
    let customerEmail: string | undefined;
    if (order.tenders && order.tenders.length > 0) {
      const tender = order.tenders[0];
      if (tender.customerId) {
        try {
          const customerResponse = await client.customers.get({ customerId: tender.customerId });
          customerEmail = customerResponse.customer?.emailAddress ?? undefined;
        } catch {
          // Customer email not available
        }
      }
    }

    return {
      verified: isPaid,
      plan,
      includeCRM,
      customerEmail,
      totalAmount,
      orderId,
    };
  } catch (error) {
    console.error("Error verifying payment:", error);
    return {
      verified: false,
      plan: "",
      includeCRM: false,
      totalAmount: 0,
      orderId,
    };
  }
};

/**
 * Verify Square webhook signature
 * Square computes: HMAC-SHA256(key, notificationUrl + body) per their docs
 * @param notificationUrl - The full webhook endpoint URL registered with Square
 * @param payload - Raw request body
 * @param signature - Signature from Square header
 * @param webhookSignatureKey - Your webhook signature key
 * @returns Whether the signature is valid
 */
export const verifyWebhookSignature = (
  notificationUrl: string,
  payload: string,
  signature: string,
  webhookSignatureKey: string
): boolean => {
  if (!signature) return false;

  const hmac = crypto.createHmac("sha256", webhookSignatureKey);
  hmac.update(notificationUrl + payload);
  const expectedSignature = hmac.digest("base64");

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  // timingSafeEqual throws if lengths differ — check first
  if (sigBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
};

/**
 * Get payment details by payment ID
 * @param paymentId - The Square payment ID
 * @returns Payment details or null if not found
 */
export const getPaymentDetails = async (paymentId: string) => {
  const client = getSquareClient();

  try {
    const response = await client.payments.get({ paymentId });
    return response;
  } catch (error) {
    console.error("Error fetching payment details:", error);
    return null;
  }
};

export { getSquareClient };
