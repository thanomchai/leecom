"use client";

import { useActionState } from "react";
import {
  addToCartAction,
  type CartActionState,
} from "@/app/actions/cart";

export function AddToCartForm({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  const [state, formAction, pending] = useActionState<CartActionState, FormData>(
    addToCartAction,
    {},
  );

  if (stock <= 0) {
    return <p className="out-of-stock-note">สินค้าหมดชั่วคราว</p>;
  }

  return (
    <form action={formAction} className="add-to-cart-form">
      <input name="productId" type="hidden" value={productId} />
      <label>
        จำนวน
        <input
          defaultValue={1}
          max={Math.min(stock, 99)}
          min={1}
          name="quantity"
          required
          type="number"
        />
      </label>
      <button className="button" disabled={pending} type="submit">
        {pending ? "กำลังเพิ่ม..." : "เพิ่มลงตะกร้า"}
      </button>
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
    </form>
  );
}
