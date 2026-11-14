import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { PaymentReviewNavigation } from "@/app/components/payment-review-navigation";
import { requireAdmin } from "@/lib/auth";
import { getPaymentReviewHistory } from "@/lib/commerce";
import { bahtFormat, formatThaiDateTime } from "@/lib/presentation";

export const metadata: Metadata = {
  title: "ประวัติการตรวจสอบการชำระเงิน",
};

export default function PaymentReviewHistoryPage() {
  return (
    <main className="admin-payments-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดประวัติ...</div>}>
        <PaymentReviewHistoryContent />
      </Suspense>
    </main>
  );
}

async function PaymentReviewHistoryContent() {
  await requireAdmin();
  const reviews = await getPaymentReviewHistory();

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">LEECOM ADMIN</p>
          <h1>ประวัติการตรวจสอบ</h1>
          <p>บันทึกผลการอนุมัติและปฏิเสธสลิปย้อนหลัง</p>
        </div>
        <span className="section-note">{reviews.length} รายการ</span>
      </div>
      <PaymentReviewNavigation active="history" />
      {reviews.length === 0 ? (
        <section className="empty-commerce-state">
          <h2>ยังไม่มีประวัติการตรวจสอบ</h2>
          <p>ผลการตรวจสอบจะถูกบันทึกไว้ที่หน้านี้ทุกครั้ง</p>
          <Link className="button button-outline" href="/admin/payments">
            ไปยังรายการรอตรวจ
          </Link>
        </section>
      ) : (
        <section
          aria-label="ประวัติการตรวจสอบการชำระเงิน"
          className="payment-review-history"
        >
          {reviews.map((review) => {
            const approved = review.decision === "approved";
            return (
              <article
                className={`payment-history-card ${
                  approved
                    ? "payment-history-approved"
                    : "payment-history-rejected"
                }`}
                key={review.id}
              >
                <div className="payment-history-heading">
                  <div>
                    <p className="eyebrow">คำสั่งซื้อ</p>
                    <h2>{review.orderNumber}</h2>
                  </div>
                  <span
                    className={`payment-history-status ${
                      approved ? "history-approved" : "history-rejected"
                    }`}
                  >
                    {approved ? "อนุมัติการชำระ" : "ปฏิเสธสลิป"}
                  </span>
                </div>
                <dl className="payment-history-details">
                  <div>
                    <dt>ลูกค้า</dt>
                    <dd>{review.customerName}</dd>
                    <small>{review.customerEmail}</small>
                  </div>
                  <div>
                    <dt>ผู้ตรวจ</dt>
                    <dd>{review.reviewerName}</dd>
                    <small>{review.reviewerEmail}</small>
                  </div>
                  <div>
                    <dt>เวลาตรวจสอบ</dt>
                    <dd>{formatThaiDateTime(review.reviewedAt)}</dd>
                  </div>
                  <div>
                    <dt>ยอดคำสั่งซื้อ</dt>
                    <dd>{bahtFormat.format(review.total)}</dd>
                  </div>
                </dl>
                <div className="payment-history-note">
                  <strong>หมายเหตุ</strong>
                  <p>{review.note || "ไม่มีหมายเหตุ"}</p>
                </div>
              </article>
            );
          })}
        </section>
      )}
      <p className="payment-history-retention">
        หน้านี้เก็บเฉพาะข้อมูลผลตรวจสอบ ไฟล์สลิปที่ถูกปฏิเสธจะถูกลบตามนโยบายความเป็นส่วนตัว
      </p>
    </>
  );
}
