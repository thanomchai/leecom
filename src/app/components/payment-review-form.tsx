"use client";

import { useActionState } from "react";
import {
  reviewPaymentAction,
  type PaymentReviewActionState,
} from "@/app/actions/admin-payments";

export function PaymentReviewForm({
  orderNumber,
  hasPaymentProof,
}: {
  orderNumber: string;
  hasPaymentProof: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    PaymentReviewActionState,
    FormData
  >(reviewPaymentAction, {});

  return (
    <form action={formAction} className="payment-review-form">
      <input name="orderNumber" type="hidden" value={orderNumber} />
      <label>
        หมายเหตุถึงลูกค้า (ไม่บังคับ)
        <textarea
          maxLength={1000}
          name="note"
          placeholder="เช่น ยอดโอนไม่ตรงกับยอดคำสั่งซื้อ"
          rows={3}
        />
      </label>
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
      <div className="payment-review-buttons">
        <button
          className="button"
          disabled={pending || !hasPaymentProof}
          name="decision"
          type="submit"
          value="approve"
        >
          {pending ? "กำลังบันทึก..." : "อนุมัติการชำระ"}
        </button>
        <button
          className="button button-danger"
          disabled={pending}
          name="decision"
          onClick={(event) => {
            if (!window.confirm("ปฏิเสธสลิปและให้ลูกค้าแนบใหม่หรือไม่?")) {
              event.preventDefault();
            }
          }}
          type="submit"
          value="reject"
        >
          ปฏิเสธและให้แนบใหม่
        </button>
      </div>
    </form>
  );
}
