import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PaymentReviewForm } from "@/app/components/payment-review-form";
import { PaymentReviewNavigation } from "@/app/components/payment-review-navigation";
import { requireAdmin } from "@/lib/auth";
import { getPendingPaymentReviews } from "@/lib/commerce";
import { bahtFormat, formatThaiDateTime } from "@/lib/presentation";

export const metadata: Metadata = {
  title: "ตรวจสอบการชำระเงิน",
};

export default function AdminPaymentsPage() {
  return (
    <main className="admin-payments-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดรายการ...</div>}>
        <AdminPaymentsContent />
      </Suspense>
    </main>
  );
}

async function AdminPaymentsContent() {
  await requireAdmin();
  const reviews = await getPendingPaymentReviews();

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">LEECOM ADMIN</p>
          <h1>ตรวจสอบการชำระเงิน</h1>
          <p>ตรวจสอบยอดและสลิปก่อนอนุมัติ ไม่มีการยืนยันอัตโนมัติ</p>
        </div>
        <span className="section-note">{reviews.length} รายการรอตรวจ</span>
      </div>
      <PaymentReviewNavigation active="pending" />
      {reviews.length === 0 ? (
        <section className="empty-commerce-state">
          <h2>ไม่มีรายการรอตรวจสอบ</h2>
          <p>เมื่อมีลูกค้าแนบสลิป รายการจะแสดงที่หน้านี้</p>
          <Link className="button button-outline" href="/admin">
            กลับหน้าผู้ดูแล
          </Link>
        </section>
      ) : (
        <section aria-label="รายการรอตรวจสอบ" className="payment-review-list">
          {reviews.map((review) => (
            <article className="payment-review-card" key={review.orderNumber}>
              <div className="payment-review-heading">
                <div>
                  <p className="eyebrow">คำสั่งซื้อ</p>
                  <h2>{review.orderNumber}</h2>
                </div>
                <span className="order-status status-pending_review">
                  รอตรวจสอบสลิป
                </span>
              </div>
              <dl className="payment-review-details">
                <div>
                  <dt>ลูกค้า</dt>
                  <dd>{review.customerName}</dd>
                </div>
                <div>
                  <dt>อีเมล</dt>
                  <dd>{review.customerEmail}</dd>
                </div>
                <div>
                  <dt>วันที่สั่งซื้อ</dt>
                  <dd>{formatThaiDateTime(review.createdAt)}</dd>
                </div>
                <div>
                  <dt>วันเวลาโอนที่แจ้ง</dt>
                  <dd>
                    {review.transferredAt
                      ? formatThaiDateTime(review.transferredAt)
                      : "ไม่มีข้อมูล"}
                  </dd>
                </div>
                <div>
                  <dt>ยอดในคำสั่งซื้อ</dt>
                  <dd>{bahtFormat.format(review.total)}</dd>
                </div>
                <div>
                  <dt>ยอดที่ลูกค้าแจ้งโอน</dt>
                  <dd>
                    {review.transferAmount === null
                      ? "ไม่มีข้อมูล"
                      : bahtFormat.format(review.transferAmount)}
                  </dd>
                </div>
              </dl>
              {review.hasPaymentProof ? (
                <Link
                  className="button button-outline payment-proof-link"
                  href={`/api/orders/${encodeURIComponent(review.orderNumber)}/proof`}
                  rel="noreferrer"
                  target="_blank"
                >
                  เปิดสลิปตรวจสอบ
                </Link>
              ) : (
                <p className="form-error" role="alert">
                  ไม่พบไฟล์สลิปที่แนบไว้
                </p>
              )}
              <PaymentReviewForm
                hasPaymentProof={review.hasPaymentProof}
                orderNumber={review.orderNumber}
              />
            </article>
          ))}
        </section>
      )}
    </>
  );
}
