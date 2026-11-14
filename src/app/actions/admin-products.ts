"use server";

import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  ImageUploadError,
  removeSavedFile,
  saveImageFile,
  validateImageFile,
} from "@/lib/uploads";

export type AdminProductActionState = {
  error?: string;
  success?: string;
};

class AdminProductActionError extends Error {}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const productSchema = z.object({
  name: z.string().trim().min(2, "กรุณากรอกชื่อสินค้า").max(160),
  description: z
    .string()
    .trim()
    .min(5, "กรุณากรอกรายละเอียดสินค้า")
    .max(10000),
  category: z.string().trim().min(2, "กรุณากรอกหมวดหมู่").max(80),
  price: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, "กรุณากรอกราคาให้ถูกต้อง")
    .refine((value) => Number(value) > 0, "ราคาต้องมากกว่า 0 บาท"),
  stock: z
    .string()
    .regex(/^\d+$/, "กรุณากรอกจำนวนคงเหลือเป็นจำนวนเต็ม")
    .transform(Number)
    .pipe(z.number().int().min(0).max(4294967295)),
});

interface ProductForEditRow extends RowDataPacket {
  slug: string;
  image: string;
}

interface UpdatedProductRow extends RowDataPacket {
  name: string;
  category: string;
  description: string;
  price: string | number;
  stock: number;
  is_active: number;
}

interface ProductForDeleteRow extends RowDataPacket {
  id: number;
  image: string;
}

interface OrderCountRow extends RowDataPacket {
  order_count: number;
}

const productImageDirectory = path.join(
  process.cwd(),
  "public",
  "uploads",
  "products",
);

function makeSlug(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 70) || "product";
  return `${base}-${randomUUID()}`;
}

function managedProductImagePath(imageUrl: string): string | undefined {
  const match =
    /^\/uploads\/products\/([0-9a-f-]{36}\.(?:jpg|png|svg|webp))$/.exec(
      imageUrl,
    );
  return match
    ? path.join(productImageDirectory, match[1])
    : undefined;
}

async function removeManagedProductImage(imageUrl: string): Promise<void> {
  const filePath = managedProductImagePath(imageUrl);
  if (!filePath) {
    return;
  }
  try {
    await unlink(filePath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function validatedProductId(value: number): number | undefined {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export async function saveProductAction(
  _previousState: AdminProductActionState,
  formData: FormData,
): Promise<AdminProductActionState> {
  await requireAdmin();

  const productIdInput = getString(formData, "productId");
  const productId =
    productIdInput === "" ? undefined : validatedProductId(Number(productIdInput));
  if (productIdInput !== "" && productId === undefined) {
    return { error: "รหัสสินค้าไม่ถูกต้อง" };
  }

  const parsed = productSchema.safeParse({
    name: getString(formData, "name"),
    description: getString(formData, "description"),
    category: getString(formData, "category"),
    price: getString(formData, "price"),
    stock: getString(formData, "stock"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "กรุณาตรวจสอบข้อมูลสินค้า" };
  }

  const isActive = formData.get("isActive") === "on";
  let image;
  try {
    image = await validateImageFile(
      formData.get("image"),
      ["image/jpeg", "image/png", "image/svg+xml", "image/webp"],
      false,
    );
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return { error: error.message };
    }
    throw error;
  }

  let saved: { filename: string; path: string } | undefined;
  let previousImage: string | undefined;
  try {
    if (image) {
      saved = await saveImageFile(image, productImageDirectory);
    }

    const connection = await getDb().getConnection();
    try {
      await connection.beginTransaction();
      if (productId === undefined) {
        await connection.execute<ResultSetHeader>(
          `INSERT INTO products (
             slug, name, category, description, price, stock, image, is_active
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            makeSlug(parsed.data.name),
            parsed.data.name,
            parsed.data.category,
            parsed.data.description,
            Number(parsed.data.price).toFixed(2),
            parsed.data.stock,
            saved
              ? `/uploads/products/${saved.filename}`
              : "/products/placeholder.svg",
            isActive ? 1 : 0,
          ],
        );
      } else {
        const [products] = await connection.execute<ProductForEditRow[]>(
          "SELECT slug, image, name, category, description, price, stock, is_active FROM products WHERE id = ? FOR UPDATE",
          [productId],
        );
        const product = products[0];
        if (!product) {
          throw new AdminProductActionError("ไม่พบสินค้าที่ต้องการแก้ไข");
        }
        previousImage = product.image;
        await connection.execute<ResultSetHeader>(
          `UPDATE products
           SET name = ?, category = ?, description = ?, price = ?, stock = ?,
               image = ?, is_active = ?,
               archived_at = IF(? = 1, NULL, archived_at)
           WHERE id = ?`,
          [
            parsed.data.name,
            parsed.data.category,
            parsed.data.description,
            Number(parsed.data.price).toFixed(2),
            parsed.data.stock,
            saved ? `/uploads/products/${saved.filename}` : product.image,
            isActive ? 1 : 0,
            isActive ? 1 : 0,
            productId,
          ],
        );
        const [updatedProducts] = await connection.execute<UpdatedProductRow[]>(
          `SELECT name, category, description, price, stock, is_active, image
           FROM products
           WHERE id = ?`,
          [productId],
        );
        const updatedProduct = updatedProducts[0];
        if (
          !updatedProduct ||
          updatedProduct.name !== parsed.data.name ||
          updatedProduct.category !== parsed.data.category ||
          updatedProduct.description !== parsed.data.description ||
          Number(updatedProduct.price).toFixed(2) !==
            Number(parsed.data.price).toFixed(2) ||
          updatedProduct.stock !== parsed.data.stock ||
          Number(updatedProduct.is_active) !== (isActive ? 1 : 0) ||
          updatedProduct.image !==
            (saved ? `/uploads/products/${saved.filename}` : product.image)
        ) {
          throw new AdminProductActionError(
            "ตรวจสอบข้อมูลหลังบันทึกไม่สำเร็จ กรุณาลองใหม่",
          );
        }
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    if (saved && previousImage && previousImage !== `/uploads/products/${saved.filename}`) {
      try {
        await removeManagedProductImage(previousImage);
      } catch (error) {
        console.error("Removing replaced product image failed:", error);
      }
    }
  } catch (error) {
    if (saved) {
      try {
        await removeSavedFile(saved.path);
      } catch (cleanupError) {
        console.error("Removing rejected product image failed:", cleanupError);
      }
    }
    if (error instanceof AdminProductActionError) {
      return { error: error.message };
    }
    console.error("Saving product failed:", error);
    return { error: "บันทึกสินค้าไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath("/");
  revalidatePath("/products/[id]", "page");
  revalidatePath("/admin/productls");
  return {
    success: productId === undefined ? "เพิ่มสินค้าแล้ว" : "บันทึกการแก้ไขแล้ว",
  };
}

export async function deleteProductAction(
  productId: number,
  _previousState: AdminProductActionState,
  _formData: FormData,
): Promise<AdminProductActionState> {
  void _previousState;
  void _formData;
  await requireAdmin();
  const id = validatedProductId(productId);
  if (!id) {
    return { error: "รหัสสินค้าไม่ถูกต้อง" };
  }

  let imageUrl: string | undefined;
  let archived = false;
  try {
    const connection = await getDb().getConnection();
    try {
      await connection.beginTransaction();
      const [products] = await connection.execute<ProductForDeleteRow[]>(
        "SELECT id, image FROM products WHERE id = ? FOR UPDATE",
        [id],
      );
      const product = products[0];
      if (!product) {
        throw new AdminProductActionError("ไม่พบสินค้าที่ต้องการลบ");
      }
      const [counts] = await connection.execute<OrderCountRow[]>(
        "SELECT COUNT(*) AS order_count FROM order_items WHERE product_id = ?",
        [id],
      );
      imageUrl = product.image;
      archived = Number(counts[0]?.order_count ?? 0) > 0;
      if (archived) {
        await connection.execute(
          `UPDATE products
           SET is_active = 0, archived_at = COALESCE(archived_at, CURRENT_TIMESTAMP)
           WHERE id = ?`,
          [id],
        );
      } else {
        await connection.execute("DELETE FROM products WHERE id = ?", [id]);
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error instanceof AdminProductActionError) {
      return { error: error.message };
    }
    console.error("Deleting product failed:", error);
    return { error: "ลบสินค้าไม่สำเร็จ กรุณาลองใหม่" };
  }

  if (!archived && imageUrl) {
    try {
      await removeManagedProductImage(imageUrl);
    } catch (error) {
      console.error("Removing deleted product image failed:", error);
    }
  }
  revalidatePath("/");
  revalidatePath("/admin/productls");
  return {
    success: archived
      ? "สินค้ามีประวัติคำสั่งซื้อ จึงเก็บถาวรและปิดการขายแล้ว"
      : "ลบสินค้าแล้ว",
  };
}
