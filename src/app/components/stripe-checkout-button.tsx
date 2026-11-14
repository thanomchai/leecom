"use client";

import { useActionState } from "react";
import {
  createStripeCheckoutAction,
  type OrderActionState,
} from "@/app/actions/orders";

export function StripeCheckoutButton({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(createStripeCheckoutAction, {});

  return (
    <div className="stripe-checkout">
      <form action={formAction}>
        <input name="orderNumber" type="hidden" value={orderNumber} />
        <button
          className="button stripe-checkout-button"
          disabled={pending}
          type="submit"
        >
          {pending
            ? "กำลังเชื่อมต่อ Stripe..."
            : "ชำระด้วย PromptPay ผ่าน Stripe"}
        </button>
      </form>
      {state.error ? (
        <p className="form-message form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="form-message form-success" role="status">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
