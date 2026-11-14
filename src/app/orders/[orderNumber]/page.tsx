import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentProofForm } from "@/app/components/payment-proof-form";
import { StripeCheckoutButton } from "@/app/components/stripe-checkout-button";
import { requireUser } from "@/lib/auth";
import { getOrderForUser } from "@/lib/commerce";
import { formatThaiDateTime, bahtFormat } from "@/lib/presentation";

type OrderPageProps = PageProps<"/orders/[orderNumber]">;

export async function generateMetadata({
  params,
}: OrderPageProps): Promise<Metadata> {
  const { orderNumber } = await params;
  return { title: `คำสั่งซื้อ ${orderNumber}` };
}

export default function OrderDetailPage({ params }: OrderPageProps) {
  return (
    <main className="commerce-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดรายละเอียด...</div>}>
        <OrderDetailContent params={params} />
      </Suspense>
    </main>
  );
}

async function OrderDetailContent({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const user = await requireUser();
  const { orderNumber } = await params;
  const order = await getOrderForUser(user.id, orderNumber);
  if (!order) {
    notFound();
  }

  return (
    <>
      <Link className="back-link" href="/orders">
        <span aria-hidden="true">←</span> กลับไปประวัติคำสั่งซื้อ
      </Link>
      <div className="commerce-heading order-detail-heading">
        <p className="eyebrow">ORDER DETAILS</p>
        <h1>คำสั่งซื้อ {order.orderNumber}</h1>
        <p>สร้างเมื่อ {formatThaiDateTime(order.createdAt)}</p>
      </div>
      <div className="order-detail-layout">
        <section className="order-detail-main">
          <article className="commerce-panel">
            <div className="order-status-heading">
              <h2>สถานะคำสั่งซื้อ</h2>
              <span className={`order-status status-${order.status}`}>
                {order.status === "awaiting_payment"
                  ? order.paymentProvider === "stripe"
                    ? "รอชำระ PromptPay"
                    : "รอแจ้งชำระเงิน"
                  : order.status === "pending_review"
                    ? "รอตรวจสอบสลิป"
                    : "ชำระเงินแล้ว"}
              </span>
            </div>
            <div className="order-snapshot-list">
              {order.items.map((item, index) => (
                <div
                  className="order-snapshot-item"
                  key={`${item.productSlug}-${index}`}
                >
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      {bahtFormat.format(item.unitPrice)} × {item.quantity}
                    </span>
                  </div>
                  <strong>{bahtFormat.format(item.lineTotal)}</strong>
                </div>
              ))}
            </div>
            <div className="summary-row">
              <span>ยอดสินค้า</span>
              <strong>{bahtFormat.format(order.subtotal)}</strong>
            </div>
            <div className="summary-row">
              <span>ค่าจัดส่ง</span>
              <strong>{bahtFormat.format(order.shippingFee)}</strong>
            </div>
            <div className="summary-total">
              <span>ยอดรวม</span>
              <strong>{bahtFormat.format(order.total)}</strong>
            </div>
          </article>
          <article className="commerce-panel shipping-snapshot">
            <h2>ข้อมูลจัดส่ง ณ เวลาสั่งซื้อ</h2>
            <p>
              <strong>ผู้รับ:</strong> {order.shippingName}
            </p>
            <p>
              <strong>โทรศัพท์:</strong> {order.shippingPhone}
            </p>
            <p className="shipping-address">
              <strong>ที่อยู่:</strong> {order.shippingAddress}
            </p>
          </article>
        </section>
        <aside className="payment-panel">
          {order.paymentProvider === "stripe" ? (
            <>
              <p className="eyebrow">STRIPE PROMPTPAY</p>
              <h2>ชำระผ่าน PromptPay</h2>
              {order.status === "awaiting_payment" ? (
                <div className="stripe-payment-info">
                  <p>
                    ชำระผ่านหน้า Stripe ด้วย QR PromptPay
                    ระบบจะเปลี่ยนสถานะเมื่อได้รับการยืนยันจาก Stripe เท่านั้น
                  </p>
                  <StripeCheckoutButton orderNumber={order.orderNumber} />
                  <Link
                    className="stripe-refresh-link"
                    href={`/orders/${encodeURIComponent(order.orderNumber)}`}
                  >
                    รีเฟรชสถานะคำสั่งซื้อ
                  </Link>
                </div>
              ) : (
                <div className="proof-received">
                  <h3>
                    {order.status === "paid"
                      ? "Stripe ยืนยันการชำระเงินแล้ว"
                      : "คำสั่งซื้ออยู่ระหว่างตรวจสอบ"}
                  </h3>
                  <p>
                    {order.status === "paid"
                      ? "ได้รับการยืนยันจาก Stripe แล้ว"
                      : "กรุณาติดต่อผู้ดูแลระบบเพื่อตรวจสอบคำสั่งซื้อ"}
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="eyebrow">DEMO PAYMENT</p>
              <h2>เลือกวิธีชำระเงิน</h2>
              {order.status === "awaiting_payment" &&
              order.total >= 10 &&
              order.total <= 999999.99 ? (
                <div className="stripe-payment-option">
                  <p>จ่ายด้วย QR PromptPay ผ่าน Stripe</p>
                  <StripeCheckoutButton orderNumber={order.orderNumber} />
                  <small>
                    เมื่อเริ่มชำระผ่าน Stripe แล้ว
                    คำสั่งซื้อนี้จะใช้ช่องทาง Stripe เท่านั้น
                  </small>
                </div>
              ) : order.status === "awaiting_payment" ? (
                <p className="payment-explainer">
                  PromptPay ผ่าน Stripe รองรับยอด 10 ถึง 999,999.99 บาท
                  คำสั่งซื้อนี้สามารถใช้ช่องทางเดโมด้านล่างได้
                </p>
              ) : null}
              <div className="demo-payment-warning">
                ข้อมูลสาธิต ห้ามโอนเงินจริง
              </div>
              {order.status === "awaiting_payment" &&
              order.paymentReviewNote ? (
                <div className="payment-rejection-note" role="status">
                  <strong>สลิปก่อนหน้าถูกปฏิเสธ</strong>
                  <p>{order.paymentReviewNote}</p>
                  <span>แนบสลิปใหม่ได้ โดยไม่เปลี่ยนจำนวนสินค้าที่จองไว้</span>
                </div>
              ) : null}
              <dl className="demo-bank-details">
                <div>
                  <dt>ธนาคาร</dt>
                  <dd>ธนาคารตัวอย่าง (เดโม)</dd>
                </div>
                <div>
                  <dt>ชื่อบัญชี</dt>
                  <dd>LeeCom บัญชีสาธิต</dd>
                </div>
                <div>
                  <dt>เลขบัญชี</dt>
                  <dd>000-0-00000-0</dd>
                </div>
                <div>
                  <dt>ยอดในระบบ</dt>
                  <dd>{bahtFormat.format(order.total)}</dd>
                </div>
              </dl>
              {order.status === "awaiting_payment" ? (
                <>
                  <p className="payment-explainer">
                    หากเลือกช่องทางเดโม ให้แนบภาพตัวอย่างเท่านั้น
                    ระบบจะส่งให้ตรวจสอบและไม่ยืนยันการชำระเงินอัตโนมัติ
                  </p>
                  <PaymentProofForm orderNumber={order.orderNumber} />
                </>
              ) : (
                <div className="proof-received">
                  <h3>
                    {order.status === "paid"
                      ? "ยืนยันชำระเงินแล้ว"
                      : "รับข้อมูลแจ้งโอนแล้ว"}
                  </h3>
                  <p>
                    {order.status === "paid"
                      ? "สถานะชำระเงินแล้ว"
                      : "สถานะเป็น “รอตรวจสอบสลิป” ไม่มีการยืนยันชำระเงินอัตโนมัติ"}
                  </p>
                  {order.transferredAt ? (
                    <p>วันเวลาโอน: {formatThaiDateTime(order.transferredAt)}</p>
                  ) : null}
                  {order.transferAmount !== null ? (
                    <p>ยอดที่แจ้ง: {bahtFormat.format(order.transferAmount)}</p>
                  ) : null}
                  {order.hasPaymentProof ? (
                    <Link
                      className="button button-outline"
                      href={`/api/orders/${encodeURIComponent(order.orderNumber)}/proof`}
                      rel="noreferrer"
                      target="_blank"
                    >
                      ดูสลิปที่แนบ
                    </Link>
                  ) : null}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </>
  );
}
