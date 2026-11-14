import Link from "next/link";
import { ProductImage } from "@/app/components/product-image";
import type { Product } from "@/lib/products";
import { bahtFormat } from "@/lib/presentation";

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link
        aria-label={`ดูรายละเอียด ${product.name}`}
        className="product-image-link"
        href={`/products/${product.id}`}
      >
        <div className="product-image">
          <ProductImage
            alt={product.name}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            src={product.imageUrl}
          />
          <span className="category-chip">{product.category}</span>
        </div>
      </Link>
      <div className="product-card-content">
        <h3>
          <Link href={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <div className="product-card-bottom">
          <strong className="price">{bahtFormat.format(product.price)}</strong>
          <span
            className={`stock-label${product.stock === 0 ? " stock-empty" : ""}`}
          >
            {product.stock > 0
              ? `เหลือ ${product.stock} ชิ้น`
              : "สินค้าหมด"}
          </span>
        </div>
      </div>
    </article>
  );
}
