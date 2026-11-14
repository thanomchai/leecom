"use server";

import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export type CartActionState = {
  error?: string;
  success?: string;
};

class CartActionError extends Error {}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const productIdSchema = z.string().min(1).max(120);
const quantitySchema = z.coerce.number().int().min(1).max(99);

interface ProductCartRow extends RowDataPacket {
  id: number;
  stock: number;
}

interface CartQuantityRow extends RowDataPacket {
  quantity: number;
}

export async function addToCartAction(
  _previousState: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const user = await requireUser();
  const productId = productIdSchema.safeParse(getString(formData, "productId"));
  const quantity = quantitySchema.safeParse(getString(formData, "quantity"));
  if (!productId.success || !quantity.success) {
    return { error: "ข้อมูลสินค้าไม่ถูกต้อง" };
  }

  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("INSERT IGNORE INTO carts (user_id) VALUES (?)", [
      user.id,
    ]);
    const [products] = await connection.execute<ProductCartRow[]>(
      `SELECT id, stock FROM products
       WHERE slug = ? AND is_active = 1 AND archived_at IS NULL
       LIMIT 1`,
      [productId.data],
    );
    const product = products[0];
    if (!product) {
      throw new CartActionError("ไม่พบสินค้าหรือสินค้าปิดการขายแล้ว");
    }

    const [cartRows] = await connection.execute<CartQuantityRow[]>(
      "SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ? FOR UPDATE",
      [user.id, product.id],
    );
    const nextQuantity = (cartRows[0]?.quantity ?? 0) + quantity.data;
    const [lockedProducts] = await connection.execute<ProductCartRow[]>(
      "SELECT id, stock FROM products WHERE id = ? FOR UPDATE",
      [product.id],
    );
    const lockedProduct = lockedProducts[0];
    if (!lockedProduct || nextQuantity > lockedProduct.stock) {
      throw new CartActionError(
        `เพิ่มไม่ได้ สินค้ามีคงเหลือ ${lockedProduct?.stock ?? 0} ชิ้น`,
      );
    }
    if (nextQuantity > 99) {
      throw new CartActionError("สินค้าแต่ละรายการเพิ่มได้ไม่เกิน 99 ชิ้น");
    }

    if (cartRows[0]) {
      await connection.execute(
        "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?",
        [nextQuantity, user.id, product.id],
      );
    } else {
      await connection.execute<ResultSetHeader>(
        "INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)",
        [user.id, product.id, quantity.data],
      );
    }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error instanceof CartActionError) {
      return { error: error.message };
    }
    console.error("Adding cart item failed:", error);
    return { error: "เพิ่มสินค้าไม่สำเร็จ กรุณาลองใหม่" };
  } finally {
    connection.release();
  }

  revalidatePath("/cart");
  return { success: "เพิ่มสินค้าในตะกร้าแล้ว" };
}

export async function updateCartQuantityAction(
  _previousState: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const user = await requireUser();
  const productId = productIdSchema.safeParse(getString(formData, "productId"));
  const quantity = quantitySchema.safeParse(getString(formData, "quantity"));
  if (!productId.success || !quantity.success) {
    return { error: "กรุณาระบุจำนวนสินค้าให้ถูกต้อง" };
  }

  try {
    const db = getDb();
    const [products] = await db.execute<ProductCartRow[]>(
      `SELECT id, stock FROM products
       WHERE slug = ? AND is_active = 1 AND archived_at IS NULL
       LIMIT 1`,
      [productId.data],
    );
    const product = products[0];
    if (!product) {
      return { error: "สินค้านี้ปิดการขายแล้ว กรุณาลบออกจากตะกร้า" };
    }
    if (quantity.data > product.stock) {
      return { error: `สินค้ามีคงเหลือเพียง ${product.stock} ชิ้น` };
    }
    await db.execute(
      "UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?",
      [quantity.data, user.id, product.id],
    );
  } catch (error) {
    console.error("Updating cart item failed:", error);
    return { error: "ปรับจำนวนสินค้าไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath("/cart");
  return { success: "ปรับจำนวนสินค้าแล้ว" };
}

export async function removeCartItemAction(
  _previousState: CartActionState,
  formData: FormData,
): Promise<CartActionState> {
  const user = await requireUser();
  const productId = productIdSchema.safeParse(getString(formData, "productId"));
  if (!productId.success) {
    return { error: "ไม่พบรายการสินค้าที่ต้องการลบ" };
  }

  try {
    await getDb().execute(
      `DELETE FROM cart_items
       WHERE user_id = ? AND product_id = (
         SELECT id FROM products WHERE slug = ? LIMIT 1
       )`,
      [user.id, productId.data],
    );
  } catch (error) {
    console.error("Removing cart item failed:", error);
    return { error: "ลบสินค้าไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath("/cart");
  return { success: "ลบสินค้าออกจากตะกร้าแล้ว" };
}
