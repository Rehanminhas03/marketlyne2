import { NextRequest, NextResponse } from "next/server";
import { captureAndVerifyOrder } from "@/lib/paypal";
import { generateAccessToken } from "@/lib/payment-tokens";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId } = body;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        { error: "Order ID is required" },
        { status: 400 }
      );
    }

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.error("PayPal credentials not configured");
      return NextResponse.json(
        { error: "Payment system is not configured." },
        { status: 500 }
      );
    }

    const result = await captureAndVerifyOrder(orderId);

    if (!result.verified) {
      return NextResponse.json(
        { verified: false, error: "Payment not completed." },
        { status: 400 }
      );
    }

    const accessToken = generateAccessToken({
      orderId: result.orderId,
      plan: result.plan,
      includeCRM: result.includeCRM,
      customerEmail: result.customerEmail,
      totalAmount: result.totalAmount,
    });

    return NextResponse.json({
      verified: true,
      accessToken,
      plan: result.plan,
      includeCRM: result.includeCRM,
      orderId: result.orderId,
    });
  } catch (error) {
    console.error("Error capturing order:", error);
    return NextResponse.json(
      { error: "Failed to capture payment. Please contact support." },
      { status: 500 }
    );
  }
}
