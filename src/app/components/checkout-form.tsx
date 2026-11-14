"use client";

import { useActionState } from "react";
import {
  createOrderAction,
  type OrderActionState,
} from "@/app/actions/orders";

export function CheckoutForm({
  idempotencyKey,
}: {
  idempotencyKey: string;
}) {
  const [state, formAction, pending] = useActionState<
    OrderActionState,
    FormData
  >(createOrderAction, {});

  return (
    <form action={formAction} className="checkout-form">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <label>
        ชื่อผู้รับ
        <input
          autoComplete="name"
          maxLength={100}
          minLength={2}
          name="shippingName"
          required
        />
      </label>
      <label>
        เบอร์โทรศัพท์
        <input
          autoComplete="tel"
          inputMode="tel"
          maxLength={20}
          name="shippingPhone"
          placeholder="เช่น 08X-XXX-XXXX"
          required
          type="tel"
        />
      </label>
      <label>
        ที่อยู่จัดส่ง
        <textarea
          autoComplete="street-address"
          maxLength={2000}
          minLength={10}
          name="shippingAddress"
          placeholder="บ้านเลขที่ ถนน ตำบล/แขวง อำเภอ/เขต จังหวัด และรหัสไปรษณีย์"
          required
          rows={4}
        />
      </label>
      {state.error ? (
        <p className="form-message form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <button className="button checkout-submit" disabled={pending} type="submit">
        {pending ? "กำลังยืนยันคำสั่งซื้อ..." : "ยืนยันคำสั่งซื้อ"}
      </button>
    </form>
  );
}
