import { randomUUID } from "node:crypto";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/app/components/checkout-form";
import { requireUser } from "@/lib/auth";
import { getCartItems } from "@/lib/products";
import { bahtFormat } from "@/lib/presentation";

export default function CheckoutPage() {
  return (
    <main className="commerce-page">
      <Suspense fallback={<div className="loading-grid">กำลังเตรียม checkout...</div>}>
        <CheckoutContent />
      </Suspense>
    </main>
  );
}

async function CheckoutContent() {
  const user = await requireUser();
  const items = await getCartItems(user.id);
  if (items.length === 0) {
    redirect("/cart");
  }

  const total = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );

  return (
    <>
      <div className="commerce-heading">
        <p className="eyebrow">CHECKOUT</p>
        <h1>ข้อมูลจัดส่ง</h1>
        <p>กรอกข้อมูลผู้รับให้ครบถ้วนก่อนยืนยันคำสั่งซื้อ</p>
      </div>
      <div className="checkout-layout">
        <section className="checkout-panel">
          <h2>ที่อยู่จัดส่ง</h2>
          <CheckoutForm idempotencyKey={randomUUID()} />
          <p className="payment-explainer">
            หลังสร้างคำสั่งซื้อ คุณเลือกชำระผ่าน PromptPay ของ Stripe
            หรือใช้ช่องทางเดโมและแนบสลิปได้
          </p>
        </section>
        <aside className="cart-summary">
          <h2>สรุปคำสั่งซื้อ</h2>
          <div className="checkout-preview-list">
            {items.map((item) => (
              <div className="checkout-preview-item" key={item.productId}>
                <span>
                  {item.name} <small>× {item.quantity}</small>
                </span>
                <strong>{bahtFormat.format(item.price * item.quantity)}</strong>
              </div>
            ))}
          </div>
          <div className="summary-row">
            <span>ค่าจัดส่ง (เดโม)</span>
            <strong>{bahtFormat.format(0)}</strong>
          </div>
          <div className="summary-total">
            <span>ยอดรวม</span>
            <strong>{bahtFormat.format(total)}</strong>
          </div>
          <p>ราคาสุดท้ายและสต็อกจะถูกตรวจสอบจากฐานข้อมูลบนเซิร์ฟเวอร์</p>
        </aside>
      </div>
    </>
  );
}
