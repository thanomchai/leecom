"use client";

import { useActionState } from "react";
import {
  deleteProductAction,
  type AdminProductActionState,
} from "@/app/actions/admin-products";

export function AdminProductDeleteForm({
  productId,
  productName,
}: {
  productId: number;
  productName: string;
}) {
  const action = deleteProductAction.bind(null, productId);
  const [state, formAction, pending] = useActionState<
    AdminProductActionState,
    FormData
  >(action, {});

  return (
    <form
      action={formAction}
      className="admin-delete-form"
      onSubmit={(event) => {
        if (
          !window.confirm(
            `ยืนยันลบสินค้า “${productName}” หรือไม่? หากมีประวัติคำสั่งซื้อ ระบบจะเก็บถาวรแทน`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
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
      <button className="button button-danger" disabled={pending} type="submit">
        {pending ? "กำลังลบ..." : "ลบสินค้า"}
      </button>
    </form>
  );
}
