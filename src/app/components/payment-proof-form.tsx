"use client";

import { useActionState } from "react";
import {
  uploadPaymentProofAction,
  type OrderActionState,
} from "@/app/actions/orders";

export function PaymentProofForm({
  orderNumber,
}: {
  orderNumber: string;
}) {
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(uploadPaymentProofAction, {});

  return (
    <form action={formAction} className="payment-proof-form">
      <input name="orderNumber" type="hidden" value={orderNumber} />
      <label>
        วันและเวลาโอน
        <input
          name="transferredAt"
          required
          type="datetime-local"
        />
      </label>
      <label>
        ยอดที่โอน (บาท)
        <input
          max={99999999.99}
          min={0.01}
          name="transferAmount"
          required
          step="0.01"
          type="number"
        />
      </label>
      <label>
        รูปสลิป (JPG หรือ PNG, ไม่เกิน 5 MB)
        <input
          accept="image/jpeg,image/png"
          name="proof"
          required
          type="file"
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
      <button className="button checkout-submit" disabled={pending} type="submit">
        {pending ? "กำลังส่งสลิป..." : "ส่งสลิปเพื่อรอตรวจสอบ"}
      </button>
      <p className="payment-review-note">
        ระบบจะบันทึกสลิปเพื่อให้ผู้ดูแลตรวจสอบเท่านั้น
        ไม่มีการยืนยันชำระเงินอัตโนมัติ
      </p>
    </form>
  );
}
