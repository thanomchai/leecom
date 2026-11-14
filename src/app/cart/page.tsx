import { Suspense } from "react";
import Link from "next/link";
import { CartItemControls } from "@/app/components/cart-item-controls";
import { ProductImage } from "@/app/components/product-image";
import { requireUser } from "@/lib/auth";
import { getCartItems } from "@/lib/products";
import { bahtFormat } from "@/lib/presentation";

export default function CartPage() {
  return (
    <main className="commerce-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดตะกร้า...</div>}>
        <CartContent />
      </Suspense>
    </main>
  );
}

async function CartContent() {
  const user = await requireUser();
  const items = await getCartItems(user.id);
  if (items.length === 0) {
    return (
      <section className="empty-commerce-state">
        <p className="eyebrow">YOUR CART</p>
        <h1>ตะกร้าของคุณยังว่างอยู่</h1>
        <p>เลือกสินค้าที่สนใจแล้วเพิ่มลงตะกร้าได้จากหน้ารายละเอียดสินค้า</p>
        <Link className="button" href="/#products">
          กลับไปเลือกสินค้า
        </Link>
      </section>
    );
  }

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const allAvailable = items.every((item) => item.available);

  return (
    <>
      <div className="commerce-heading">
        <p className="eyebrow">YOUR CART</p>
        <h1>ตะกร้าสินค้า</h1>
        <p>ตรวจสอบรายการและจำนวนสินค้าก่อนดำเนินการต่อ</p>
      </div>
      <div className="cart-layout">
        <section aria-label="รายการสินค้าในตะกร้า" className="cart-items">
          {items.map((item) => (
            <article className="cart-item" key={item.productId}>
              <Link
                aria-label={`ดูรายละเอียด ${item.name}`}
                className="cart-item-image"
                href={`/products/${item.productId}`}
              >
                <ProductImage
                  alt={item.name}
                  sizes="100px"
                  src={item.imageUrl}
                />
              </Link>
              <div className="cart-item-info">
                <span className="cart-item-category">{item.category}</span>
                <h2>{item.name}</h2>
                <p className="cart-item-price">{bahtFormat.format(item.price)}</p>
                <CartItemControls
                  available={item.available}
                  productId={item.productId}
                  quantity={item.quantity}
                  stock={item.stock}
                />
              </div>
              <strong className="cart-line-total">
                {bahtFormat.format(item.price * item.quantity)}
              </strong>
            </article>
          ))}
        </section>
        <aside className="cart-summary">
          <h2>สรุปรายการ</h2>
          <div className="summary-row">
            <span>ยอดสินค้า</span>
            <strong>{bahtFormat.format(subtotal)}</strong>
          </div>
          <div className="summary-row">
            <span>ค่าจัดส่ง</span>
            <strong>{bahtFormat.format(0)}</strong>
          </div>
          <div className="summary-total">
            <span>ยอดรวมโดยประมาณ</span>
            <strong>{bahtFormat.format(subtotal)}</strong>
          </div>
          <p>ระบบจะคำนวณราคาและตรวจสอบสต็อกอีกครั้งตอนยืนยันคำสั่งซื้อ</p>
          {allAvailable ? (
            <Link className="button checkout-link" href="/checkout">
              ไปหน้าจัดส่งและชำระเงิน
            </Link>
          ) : (
            <p className="form-message form-error">
              กรุณาลบสินค้าที่ปิดขายออกจากตะกร้าก่อน
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
