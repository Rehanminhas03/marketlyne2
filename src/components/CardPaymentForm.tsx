"use client";

import { useState, useCallback, useEffect } from "react";
import {
  PayPalScriptProvider,
  PayPalCardFieldsProvider,
  PayPalCardFieldsForm,
  PayPalButtons,
  usePayPalCardFields,
  usePayPalScriptReducer,
  FUNDING,
  SCRIPT_LOADING_STATE,
} from "@paypal/react-paypal-js";
import { IconLoader2, IconLock, IconCreditCard } from "@tabler/icons-react";

interface PaymentFormProps {
  plan: string;
  includeCRM: boolean;
  onSuccess: (data: {
    accessToken: string;
    plan: string;
    includeCRM: boolean;
    orderId: string;
  }) => void;
  onError: (message: string) => void;
}

/**
 * Card fields inner content — detects eligibility and renders card form + Pay Now button.
 */
function CardFieldsContent({ onIneligible }: { onIneligible: () => void }) {
  const { cardFieldsForm } = usePayPalCardFields();
  const [isPaying, setIsPaying] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (cardFieldsForm) {
      if (cardFieldsForm.isEligible()) {
        setIsReady(true);
      } else {
        console.warn("[CardPayment] Card fields not eligible — hiding card form");
        onIneligible();
      }
    }
  }, [cardFieldsForm, onIneligible]);

  const handleClick = async () => {
    if (!cardFieldsForm) return;

    const formState = await cardFieldsForm.getState();
    if (!formState.isFormValid) {
      alert("Please fill in all card details correctly.");
      return;
    }

    setIsPaying(true);
    try {
      await cardFieldsForm.submit();
    } catch {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      {!isReady && (
        <div className="flex items-center justify-center gap-2 py-4 text-white/50">
          <IconLoader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading card form...</span>
        </div>
      )}
      <div className={isReady ? "block" : "hidden"}>
        <PayPalCardFieldsForm className="paypal-card-form" />
      </div>
      {isReady && (
        <button
          onClick={handleClick}
          disabled={isPaying}
          className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-[#d5b367] text-[#161616] rounded-full font-semibold hover:bg-[#c9a555] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isPaying ? (
            <>
              <IconLoader2 className="w-4 h-4 animate-spin" />
              Processing payment...
            </>
          ) : (
            <>
              <IconCreditCard className="w-4 h-4" />
              Pay with Card
            </>
          )}
        </button>
      )}
    </div>
  );
}

/**
 * Inner wrapper that waits for SDK to load before rendering both payment options.
 */
function PaymentOptions({
  createOrder,
  captureOrder,
  onError,
}: {
  createOrder: () => Promise<string>;
  captureOrder: (orderID: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [{ isResolved }] = usePayPalScriptReducer();
  const [cardEligible, setCardEligible] = useState(true);

  const handleCardIneligible = useCallback(() => {
    setCardEligible(false);
  }, []);

  if (!isResolved) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-white/50">
        <IconLoader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading payment options...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Card Payment Section */}
      {cardEligible && (
        <PayPalCardFieldsProvider
          createOrder={createOrder}
          onApprove={async (data) => captureOrder(data.orderID)}
          onError={(err) => {
            console.error("[CardPayment] Error:", err);
            onError("Payment failed. Please check your card details and try again.");
          }}
          style={{
            input: {
              "font-size": "14px",
              "font-family": "Arial, sans-serif",
              color: "#333333",
              padding: "12px",
            },
            ".invalid": {
              color: "#ef4444",
            },
          }}
        >
          <CardFieldsContent onIneligible={handleCardIneligible} />
        </PayPalCardFieldsProvider>
      )}

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-white/10" />
        <span className="text-white/30 text-xs font-medium">OR</span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* PayPal Button */}
      <PayPalButtons
        fundingSource={FUNDING.PAYPAL}
        createOrder={createOrder}
        onApprove={async (data) => captureOrder(data.orderID)}
        onError={(err) => {
          console.error("[PayPalButton] Error:", err);
          onError("PayPal payment failed. Please try again.");
        }}
        style={{
          layout: "horizontal",
          color: "blue",
          shape: "pill",
          label: "paypal",
          height: 48,
        }}
      />

      {/* Security note */}
      <div className="flex items-center justify-center gap-1.5 text-white/30 text-xs">
        <IconLock className="w-3 h-3" />
        <span>Secure payment powered by PayPal</span>
      </div>
    </div>
  );
}

export default function CardPaymentForm({
  plan,
  includeCRM,
  onSuccess,
  onError,
}: PaymentFormProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;

  const createOrder = useCallback(async () => {
    const response = await fetch("/api/payments/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan.toLowerCase(), includeCRM }),
    });
    const data = await response.json();
    if (!data.orderId) {
      throw new Error(data.error || "Failed to create order");
    }
    return data.orderId;
  }, [plan, includeCRM]);

  const captureOrder = useCallback(
    async (orderID: string) => {
      const response = await fetch("/api/payments/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: orderID }),
      });
      const result = await response.json();

      if (result.verified && result.accessToken) {
        onSuccess({
          accessToken: result.accessToken,
          plan: result.plan,
          includeCRM: result.includeCRM,
          orderId: result.orderId,
        });
      } else {
        onError(result.error || "Payment verification failed.");
      }
    },
    [onSuccess, onError]
  );

  if (!clientId) {
    return (
      <div className="text-red-400 text-sm text-center py-4">
        Payment system is not configured. Please contact support.
      </div>
    );
  }

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        components: "card-fields,buttons",
        intent: "capture",
        currency: "USD",
      }}
    >
      <PaymentOptions
        createOrder={createOrder}
        captureOrder={captureOrder}
        onError={onError}
      />
    </PayPalScriptProvider>
  );
}
