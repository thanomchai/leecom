import { ProductCard } from "@/app/components/product-card";
import { getProducts } from "@/lib/products";

export async function ProductList() {
  const products = await getProducts();

  if (products.length === 0) {
    return (
      <div className="empty-products">
        <span aria-hidden="true">⌕</span>
        <h3>ยังไม่มีสินค้าในร้าน</h3>
        <p>ลองตรวจสอบการตั้งค่าฐานข้อมูลและรันคำสั่ง npm run db:setup</p>
      </div>
    );
  }

  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
