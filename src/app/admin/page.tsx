import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default function AdminPage() {
  return (
    <main className="admin-page">
      <Suspense fallback={<div className="loading-grid">กำลังตรวจสอบสิทธิ์...</div>}>
        <AdminDashboard />
      </Suspense>
    </main>
  );
}

async function AdminDashboard() {
  const user = await requireAdmin();

  return (
    <section className="admin-card">
      <p className="eyebrow">LEECOM ADMIN</p>
      <h1>ยินดีต้อนรับ, {user.name}</h1>
      <p>จัดการสินค้าและตรวจสอบการชำระเงินของร้านได้จากหน้าผู้ดูแล</p>
      <div className="admin-dashboard-links">
        <Link className="button" href="/admin/productls">
          ไปหน้าจัดการสินค้า
        </Link>
        <Link className="button button-outline" href="/admin/payments">
          ตรวจสอบการชำระเงิน
        </Link>
        <Link className="button button-outline" href="/admin/transactions">
          ดูสรุปธุรกรรม
        </Link>
      </div>
    </section>
  );
}
