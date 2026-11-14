import "server-only";
import { connection } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";

export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
};

export type AdminProduct = Product & {
  dbId: number;
  isActive: boolean;
  archivedAt: string | null;
};

export type CartItem = {
  productId: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  quantity: number;
  imageUrl: string;
  available: boolean;
};

interface ProductRow extends RowDataPacket {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string | number;
  stock: number;
  image_url: string;
}

interface AdminProductRow extends ProductRow {
  db_id: number;
  is_active: number;
  archived_at: Date | string | null;
}

interface CartRow extends RowDataPacket {
  product_id: string | null;
  name: string | null;
  category: string | null;
  price: string | number | null;
  stock: number | null;
  quantity: number;
  image_url: string | null;
  is_active: number | null;
  archived_at: Date | string | null;
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    price: Number(row.price),
    stock: row.stock,
    imageUrl: row.image_url,
  };
}

function toIsoDate(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : `${value.replace(" ", "T")}Z`;
}

export async function getProducts(): Promise<Product[]> {
  await connection();
  const [rows] = await getDb().execute<ProductRow[]>(
    `SELECT slug AS id, name, category, description, price, stock, image AS image_url
     FROM products
     WHERE is_active = 1 AND archived_at IS NULL
     ORDER BY name`,
  );
  return rows.map(toProduct);
}

export async function getAdminProducts(): Promise<AdminProduct[]> {
  await connection();
  const [rows] = await getDb().execute<AdminProductRow[]>(
    `SELECT id AS db_id, slug AS id, name, category, description, price,
            stock, image AS image_url, is_active, archived_at
     FROM products
     ORDER BY archived_at IS NOT NULL, is_active DESC, name`,
  );
  return rows.map((row) => ({
    ...toProduct(row),
    dbId: row.db_id,
    isActive: row.is_active === 1,
    archivedAt: toIsoDate(row.archived_at),
  }));
}

export async function getProduct(id: string): Promise<Product | undefined> {
  await connection();
  const [rows] = await getDb().execute<ProductRow[]>(
    `SELECT slug AS id, name, category, description, price, stock, image AS image_url
     FROM products
     WHERE slug = ? AND is_active = 1 AND archived_at IS NULL
     LIMIT 1`,
    [id],
  );
  return rows[0] ? toProduct(rows[0]) : undefined;
}

export async function getCartItems(userId: number): Promise<CartItem[]> {
  await connection();
  const [rows] = await getDb().execute<CartRow[]>(
    `SELECT p.slug AS product_id, p.name, p.category, p.price, p.stock,
            ci.quantity, p.image AS image_url, p.is_active, p.archived_at
     FROM cart_items ci
     LEFT JOIN products p ON p.id = ci.product_id
     WHERE ci.user_id = ?
     ORDER BY ci.updated_at DESC`,
    [userId],
  );
  return rows.map((row) => {
    if (row.product_id === null) {
      throw new Error("Cart item references a product that no longer exists.");
    }

    return {
      productId: row.product_id,
      name: row.name ?? "สินค้านี้ไม่มีในระบบแล้ว",
      category: row.category ?? "สินค้า",
      price: Number(row.price ?? 0),
      stock: row.stock ?? 0,
      quantity: row.quantity,
      imageUrl: row.image_url ?? "/products/placeholder.svg",
      available:
        row.name !== null &&
        row.is_active === 1 &&
        row.archived_at === null,
    };
  });
}
