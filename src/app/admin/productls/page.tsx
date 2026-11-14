import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminProductDeleteForm } from "@/app/components/admin-product-delete-form";
import { AdminProductForm } from "@/app/components/admin-product-form";
import { ProductImage } from "@/app/components/product-image";
import { requireAdmin } from "@/lib/auth";
import { getAdminProducts } from "@/lib/products";

export const metadata: Metadata = {
  title: "จัดการสินค้า",
};

const priceFormat = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 2,
});

export default function AdminProductsPage() {
  return (
    <main className="admin-products-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดสินค้า...</div>}>
        <AdminProductsContent />
      </Suspense>
    </main>
  );
}

async function AdminProductsContent() {
  await requireAdmin();
  const products = await getAdminProducts();

  return (
    <>
      <div className="admin-page-heading">
        <div>
          <p className="eyebrow">LEECOM ADMIN</p>
          <h1>จัดการสินค้า</h1>
          <p>เพิ่ม แก้ไข ปิดการขาย หรือเก็บถาวรสินค้า</p>
        </div>
        <span className="section-note">{products.length} รายการ</span>
      </div>
      <section aria-labelledby="create-product-heading" className="admin-panel">
        <h2 id="create-product-heading">เพิ่มสินค้าใหม่</h2>
        <AdminProductForm mode="create" />
      </section>
      <section aria-labelledby="product-list-heading" className="admin-product-list">
        <div className="admin-list-heading">
          <h2 id="product-list-heading">รายการสินค้าทั้งหมด</h2>
          <p>การเปลี่ยนแปลงจะแสดงบนหน้าร้านจากข้อมูลฐานข้อมูลล่าสุด</p>
        </div>
        {products.length === 0 ? (
          <div className="empty-products">
            <h3>ยังไม่มีสินค้า</h3>
            <p>เพิ่มสินค้าใหม่จากแบบฟอร์มด้านบน</p>
          </div>
        ) : (
          <div className="admin-products-grid">
            {products.map((product) => (
              <article className="admin-product-card" key={product.dbId}>
                <div className="admin-product-summary">
                  <div className="admin-product-image">
                    <ProductImage
                      alt={product.name}
                      sizes="120px"
                      src={product.imageUrl}
                    />
                  </div>
                  <div className="admin-product-details">
                    <span
                      className={`admin-status ${
                        product.archivedAt
                          ? "status-archived"
                          : product.isActive
                            ? "status-active"
                            : "status-inactive"
                      }`}
                    >
                      {product.archivedAt
                        ? "เก็บถาวร"
                        : product.isActive
                          ? "เปิดขาย"
                          : "ปิดขาย"}
                    </span>
                    <h3>{product.name}</h3>
                    <p>{product.category}</p>
                    <div className="admin-product-meta">
                      <strong>{priceFormat.format(product.price)}</strong>
                      <span>คงเหลือ {product.stock}</span>
                    </div>
                  </div>
                </div>
                <details className="admin-edit-details">
                  <summary>แก้ไขรายละเอียด</summary>
                  <AdminProductForm mode="edit" product={product} />
                </details>
                <AdminProductDeleteForm
                  productId={product.dbId}
                  productName={product.name}
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
