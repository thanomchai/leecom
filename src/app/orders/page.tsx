import { Suspense } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getOrderHistory } from "@/lib/commerce";
import { formatThaiDateTime, bahtFormat } from "@/lib/presentation";

const statusLabels = {
  awaiting_payment: "รอแจ้งชำระเงิน",
  pending_review: "รอตรวจสอบสลิป",
  paid: "ชำระเงินแล้ว",
} as const;

export default function OrdersPage() {
  return (
    <main className="commerce-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดคำสั่งซื้อ...</div>}>
        <OrdersContent />
      </Suspense>
    </main>
  );
}

async function OrdersContent() {
  const user = await requireUser();
  const orders = await getOrderHistory(user.id);

  return (
    <>
      <div className="commerce-heading">
        <p className="eyebrow">YOUR ORDERS</p>
        <h1>ประวัติคำสั่งซื้อ</h1>
        <p>รายการคำสั่งซื้อที่ผูกกับบัญชีของคุณ</p>
      </div>
      {orders.length === 0 ? (
        <section className="empty-commerce-state">
          <h2>ยังไม่มีคำสั่งซื้อ</h2>
          <p>เลือกชมสินค้าเพื่อเริ่มต้นคำสั่งซื้อแรกของคุณ</p>
          <Link className="button" href="/#products">
            เลือกชมสินค้า
          </Link>
        </section>
      ) : (
        <section aria-label="รายการคำสั่งซื้อ" className="orders-list">
          {orders.map((order) => (
            <Link
              className="order-list-card"
              href={`/orders/${encodeURIComponent(order.orderNumber)}`}
              key={order.orderNumber}
            >
              <div>
                <span className="order-number">{order.orderNumber}</span>
                <span className="order-date">
                  {formatThaiDateTime(order.createdAt)}
                </span>
              </div>
              <span className={`order-status status-${order.status}`}>
                {statusLabels[order.status]}
              </span>
              <strong>{bahtFormat.format(order.total)}</strong>
              <span aria-hidden="true" className="order-arrow">
                →
              </span>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
