import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AddToCartForm } from "@/app/components/add-to-cart-form";
import { ProductImage } from "@/app/components/product-image";
import { getCurrentUser } from "@/lib/auth";
import { getProduct } from "@/lib/products";
import { bahtFormat } from "@/lib/presentation";

type ProductPageProps = PageProps<"/products/[id]">;

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  await connection();
  const product = await getProduct(id);
  return product
    ? { title: product.name, description: product.description }
    : { title: "ไม่พบสินค้า" };
}

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <main className="detail-page">
      <Suspense fallback={<div className="loading-grid">กำลังโหลดสินค้า...</div>}>
        <ProductDetails params={params} />
      </Suspense>
    </main>
  );
}

async function ProductDetails({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) {
    notFound();
  }
  const user = await getCurrentUser();

  return (
    <>
      <Link className="back-link" href="/#products">
        <span aria-hidden="true">←</span> กลับไปหน้าร้าน
      </Link>
      <article className="detail-card">
        <div className="detail-image">
          <ProductImage
            alt={product.name}
            priority
            sizes="(max-width: 760px) 100vw, 50vw"
            src={product.imageUrl}
          />
        </div>
        <div className="detail-info">
          <span className="category-chip detail-category">{product.category}</span>
          <p className="eyebrow">LEECom PRODUCT</p>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <strong className="detail-price">{bahtFormat.format(product.price)}</strong>
          <div className="detail-stock">
            <span
              aria-hidden="true"
              className={`availability-dot${product.stock === 0 ? " dot-empty" : ""}`}
            />
            {product.stock > 0
              ? `มีสินค้าพร้อมส่ง ${product.stock} ชิ้น`
              : "สินค้าหมดชั่วคราว"}
          </div>
          <div className="detail-note">
            <span aria-hidden="true">✓</span>
            สินค้าตัวอย่างสำหรับ Local demo
          </div>
          {user ? (
            <AddToCartForm productId={product.id} stock={product.stock} />
          ) : (
            <Link className="button detail-login-button" href="/login">
              เข้าสู่ระบบเพื่อสั่งซื้อ
            </Link>
          )}
        </div>
      </article>
    </>
  );
}
