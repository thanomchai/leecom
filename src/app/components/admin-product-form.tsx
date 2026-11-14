"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  saveProductAction,
  type AdminProductActionState,
} from "@/app/actions/admin-products";
import type { AdminProduct } from "@/lib/products";

export function AdminProductForm({
  product,
  mode,
}: {
  product?: AdminProduct;
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<
    AdminProductActionState,
    FormData
  >(saveProductAction, {});

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state]);

  return (
    <form action={formAction} className="admin-product-form">
      {product ? (
        <input name="productId" type="hidden" value={product.dbId} />
      ) : null}
      <label>
        ชื่อสินค้า
        <input
          autoComplete="off"
          defaultValue={product?.name ?? ""}
          maxLength={160}
          minLength={2}
          name="name"
          required
        />
      </label>
      <label>
        รายละเอียด
        <textarea
          defaultValue={product?.description ?? ""}
          maxLength={10000}
          minLength={5}
          name="description"
          required
          rows={3}
        />
      </label>
      <div className="admin-product-fields">
        <label>
          หมวดหมู่
          <input
            defaultValue={product?.category ?? ""}
            maxLength={80}
            minLength={2}
            name="category"
            required
          />
        </label>
        <label>
          ราคา (บาท)
          <input
            defaultValue={product?.price ?? ""}
            max={99999999.99}
            min={0.01}
            name="price"
            required
            step="0.01"
            type="number"
          />
        </label>
        <label>
          จำนวนคงเหลือ
          <input
            defaultValue={product?.stock ?? 0}
            max={4294967295}
            min={0}
            name="stock"
            required
            step={1}
            type="number"
          />
        </label>
      </div>
      <label>
        รูปสินค้า (JPG, PNG, SVG หรือ WebP, ไม่เกิน 5 MB)
        <input
          accept="image/jpeg,image/png,image/svg+xml,image/webp,.svg"
          name="image"
          required={mode === "create"}
          type="file"
        />
      </label>
      <label className="admin-checkbox">
        <input
          defaultChecked={product?.isActive ?? true}
          name="isActive"
          type="checkbox"
        />
        เปิดขาย
      </label>
      {product?.archivedAt ? (
        <p className="archive-note">
          สินค้านี้ถูกเก็บถาวร หากเปิดขายและบันทึก ระบบจะนำกลับมาแสดงในหน้าร้าน
        </p>
      ) : null}
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
      <button className="button admin-save-button" disabled={pending} type="submit">
        {pending
          ? "กำลังบันทึก..."
          : mode === "create"
            ? "เพิ่มสินค้า"
            : "บันทึกการแก้ไข"}
      </button>
    </form>
  );
}
