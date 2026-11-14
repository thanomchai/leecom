"use client";

import { useActionState } from "react";
import {
  removeCartItemAction,
  updateCartQuantityAction,
  type CartActionState,
} from "@/app/actions/cart";

export function CartItemControls({
  productId,
  quantity,
  stock,
  available,
}: {
  productId: string;
  quantity: number;
  stock: number;
  available: boolean;
}) {
  const [updateState, updateAction, updating] = useActionState<
    CartActionState,
    FormData
  >(updateCartQuantityAction, {});
  const [removeState, removeAction, removing] = useActionState<
    CartActionState,
    FormData
  >(removeCartItemAction, {});

  return (
    <div className="cart-item-controls">
      {available ? (
        <form action={updateAction} className="quantity-form">
          <input name="productId" type="hidden" value={productId} />
          <label>
            จำนวน
            <input
              defaultValue={quantity}
              max={Math.min(stock, 99)}
              min={1}
              name="quantity"
              required
              type="number"
            />
          </label>
          <button className="button button-outline" disabled={updating} type="submit">
            {updating ? "กำลังบันทึก..." : "ปรับจำนวน"}
          </button>
        </form>
      ) : (
        <p className="form-message form-error">
          สินค้าปิดการขายแล้ว กรุณาลบออกจากตะกร้า
        </p>
      )}
      <form action={removeAction}>
        <input name="productId" type="hidden" value={productId} />
        <button className="text-button text-danger" disabled={removing} type="submit">
          {removing ? "กำลังลบ..." : "ลบรายการ"}
        </button>
      </form>
      {updateState.error || removeState.error ? (
        <p className="form-message form-error" role="alert">
          {updateState.error ?? removeState.error}
        </p>
      ) : null}
      {updateState.success || removeState.success ? (
        <p className="form-message form-success" role="status">
          {updateState.success ?? removeState.success}
        </p>
      ) : null}
    </div>
  );
}
