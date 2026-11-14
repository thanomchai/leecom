import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";

export default function AdminProductsAliasPage() {
  return (
    <Suspense fallback={<div className="loading-grid">กำลังเปิดหน้าจัดการสินค้า...</div>}>
      <AdminProductsRedirect />
    </Suspense>
  );
}

async function AdminProductsRedirect() {
  await requireAdmin();
  return redirect("/admin/productls");
}
