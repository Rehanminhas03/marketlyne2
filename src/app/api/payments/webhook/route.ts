import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/paypal";

// Disable body parsing to get raw body for signature verification
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // Get the raw body for signature verification
    const rawBody = await request.text();
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;

    // Collect PayPal signature headers
    const headers: Record<string, string> = {};
    const headerNames = [
      "paypal-transmission-id",
      "paypal-transmission-time",
      "paypal-transmission-sig",
      "paypal-cert-url",
      "paypal-auth-algo",
    ];
    for (const name of headerNames) {
      const value = request.headers.get(name);
      if (value) headers[name] = value;
    }

    // Verify webhook signature
    if (webhookId) {
      const isValid = await verifyWebhookSignature(headers, rawBody, webhookId);
      if (!isValid) {
        console.error("[Webhook] Invalid PayPal signature — rejecting request");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    } else if (process.env.PAYPAL_ENVIRONMENT === "production") {
      console.error("[Webhook] PAYPAL_WEBHOOK_ID is REQUIRED in production — rejecting unsigned request");
      return NextResponse.json(
        { error: "Webhook ID not configured" },
        { status: 500 }
      );
    } else {
      console.warn("[Webhook] Skipping signature verification (sandbox mode)");
    }

    // Parse the webhook payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[Webhook] Invalid JSON payload received");
      return NextResponse.json({ received: true });
    }

    const eventType = payload.event_type as string | undefined;
    if (!eventType) {
      console.error("[Webhook] Missing event_type in payload");
      return NextResponse.json({ received: true });
    }

    const resource = payload.resource as Record<string, unknown>;

    console.log(`Received PayPal webhook: ${eventType}`);

    // Handle different event types
    switch (eventType) {
      case "CHECKOUT.ORDER.APPROVED":
        handleOrderApproved(resource);
        break;

      case "PAYMENT.CAPTURE.COMPLETED":
        handleCaptureCompleted(resource);
        break;

      case "PAYMENT.CAPTURE.DENIED":
        handleCaptureDenied(resource);
        break;

      case "CHECKOUT.ORDER.COMPLETED":
        handleOrderCompleted(resource);
        break;

      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    // Always return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    // Still return 200 to prevent PayPal from retrying
    return NextResponse.json({ received: true, error: "Processing error" });
  }
}

/**
 * Handle CHECKOUT.ORDER.APPROVED — user approved the payment on PayPal
 */
function handleOrderApproved(resource: Record<string, unknown>) {
  const orderId = resource.id as string;
  console.log(`[Webhook] Order approved: ${orderId}`);
  // The capture happens in the verify API route when the user is redirected back
}

/**
 * Handle PAYMENT.CAPTURE.COMPLETED — payment was successfully captured
 */
function handleCaptureCompleted(resource: Record<string, unknown>) {
  const captureId = resource.id as string;
  const amount = resource.amount as Record<string, unknown> | undefined;
  const status = resource.status as string;

  console.log(`[Webhook] Payment captured: ${captureId}, Status: ${status}, Amount: ${amount?.value} ${amount?.currency_code}`);
  // Could store in database for auditing or trigger notifications
}

/**
 * Handle PAYMENT.CAPTURE.DENIED — payment capture was denied
 */
function handleCaptureDenied(resource: Record<string, unknown>) {
  const captureId = resource.id as string;
  console.log(`[Webhook] Payment capture denied: ${captureId}`);
  // Could trigger notification to support team
}

/**
 * Handle CHECKOUT.ORDER.COMPLETED — order fully completed
 */
function handleOrderCompleted(resource: Record<string, unknown>) {
  const orderId = resource.id as string;
  console.log(`[Webhook] Order completed: ${orderId}`);
}
