import { NextRequest, NextResponse } from "next/server";
import { createOrderForCardPayment } from "@/lib/paypal";
import { isValidPlan } from "@/config/prices";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { plan, includeCRM = false } = body;

    if (!plan || typeof plan !== "string") {
      return NextResponse.json(
        { error: "Plan is required" },
        { status: 400 }
      );
    }

    if (!isValidPlan(plan)) {
      return NextResponse.json(
        { error: "Invalid plan selected" },
        { status: 400 }
      );
    }

    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      console.error("PayPal credentials not configured");
      return NextResponse.json(
        { error: "Payment system is not configured. Please contact support." },
        { status: 500 }
      );
    }

    const { orderId } = await createOrderForCardPayment(
      plan.toLowerCase(),
      Boolean(includeCRM)
    );

    console.log(`[CreateOrder] Plan: ${plan}, CRM: ${includeCRM}, OrderId: ${orderId}`);

    return NextResponse.json({ orderId });
  } catch (error) {
    console.error("Error creating order:", error);
    return NextResponse.json(
      { error: "Failed to create order. Please try again." },
      { status: 500 }
    );
  }
}
