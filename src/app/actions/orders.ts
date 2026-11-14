"use server";

import { randomBytes } from "node:crypto";
import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import {
  getAppUrl,
  getStripeClient,
  PROMPTPAY_MAXIMUM_CENTS,
  PROMPTPAY_MINIMUM_CENTS,
} from "@/lib/stripe";
import {
  ImageUploadError,
  removeSavedFile,
  saveImageFile,
  validateImageFile,
} from "@/lib/uploads";

const SHIPPING_FEE_CENTS = 0;
const MAX_CART_PRODUCTS = 50;

export type OrderActionState = {
  error?: string;
  success?: string;
};

class OrderActionError extends Error {}

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid("กรุณาโหลดหน้า checkout ใหม่"),
  shippingName: z.string().trim().min(2, "กรุณากรอกชื่อผู้รับ").max(100),
  shippingPhone: z
    .string()
    .trim()
    .regex(/^[0-9+()\s.-]{8,20}$/, "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง"),
  shippingAddress: z
    .string()
    .trim()
    .min(10, "กรุณากรอกที่อยู่จัดส่งให้ครบถ้วน")
    .max(2000),
});

interface ExistingOrderRow extends RowDataPacket {
  order_number: string;
}

interface CartRow extends RowDataPacket {
  product_id: number;
  quantity: number;
}

interface CheckoutProductRow extends RowDataPacket {
  id: number;
  slug: string;
  name: string;
  price: string | number;
  stock: number;
  is_active: number;
  archived_at: Date | string | null;
}

export async function createOrderAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await requireUser();
  const parsed = checkoutSchema.safeParse({
    idempotencyKey: getString(formData, "idempotencyKey"),
    shippingName: getString(formData, "shippingName"),
    shippingPhone: getString(formData, "shippingPhone"),
    shippingAddress: getString(formData, "shippingAddress"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "กรุณาตรวจสอบข้อมูลจัดส่ง" };
  }

  const connection = await getDb().getConnection();
  let orderNumber: string | undefined;
  try {
    await connection.beginTransaction();
    const [existingBeforeLock] = await connection.execute<ExistingOrderRow[]>(
      `SELECT order_number FROM orders
       WHERE user_id = ? AND idempotency_key = ?
       LIMIT 1`,
      [user.id, parsed.data.idempotencyKey],
    );
    if (existingBeforeLock[0]) {
      orderNumber = existingBeforeLock[0].order_number;
    } else {
      const [cartRows] = await connection.execute<CartRow[]>(
        `SELECT product_id, quantity
         FROM cart_items
         WHERE user_id = ?
         ORDER BY product_id
         FOR UPDATE`,
        [user.id],
      );

      const [existingAfterLock] = await connection.execute<ExistingOrderRow[]>(
        `SELECT order_number FROM orders
         WHERE user_id = ? AND idempotency_key = ?
         LIMIT 1
         FOR UPDATE`,
        [user.id, parsed.data.idempotencyKey],
      );
      if (existingAfterLock[0]) {
        orderNumber = existingAfterLock[0].order_number;
      } else {
        if (cartRows.length === 0) {
          throw new OrderActionError("ตะกร้าสินค้าว่าง กรุณาเลือกสินค้าก่อน");
        }
        if (cartRows.length > MAX_CART_PRODUCTS) {
          throw new OrderActionError("ตะกร้ามีสินค้าเกินจำนวนที่รองรับ");
        }

        const orderItems: Array<{
          productId: number;
          slug: string;
          name: string;
          quantity: number;
          unitPriceCents: number;
          lineTotalCents: number;
        }> = [];
        let subtotalCents = 0;

        for (const cartItem of cartRows) {
          const [products] = await connection.execute<CheckoutProductRow[]>(
            `SELECT id, slug, name, price, stock, is_active, archived_at
             FROM products
             WHERE id = ?
             FOR UPDATE`,
            [cartItem.product_id],
          );
          const product = products[0];
          if (!product || product.is_active !== 1 || product.archived_at !== null) {
            throw new OrderActionError(
              "มีสินค้าปิดการขายในตะกร้า กรุณากลับไปแก้ไขตะกร้าก่อน",
            );
          }
          if (cartItem.quantity < 1 || cartItem.quantity > product.stock) {
            throw new OrderActionError(
              `สินค้า ${product.name} มีคงเหลือ ${product.stock} ชิ้น กรุณาปรับจำนวน`,
            );
          }

          const unitPriceCents = Math.round(Number(product.price) * 100);
          const lineTotalCents = unitPriceCents * cartItem.quantity;
          subtotalCents += lineTotalCents;
          orderItems.push({
            productId: product.id,
            slug: product.slug,
            name: product.name,
            quantity: cartItem.quantity,
            unitPriceCents,
            lineTotalCents,
          });
        }

        if (!Number.isSafeInteger(subtotalCents)) {
          throw new OrderActionError("ยอดสั่งซื้อสูงเกินกว่าที่ระบบรองรับ");
        }

        const totalCents = subtotalCents + SHIPPING_FEE_CENTS;
        const datePart = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Bangkok",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        })
          .format(new Date())
          .replaceAll("-", "");
        orderNumber = `LC-${datePart}-${randomBytes(8).toString("hex").toUpperCase()}`;
        const [orderResult] = await connection.execute<ResultSetHeader>(
          `INSERT INTO orders (
             order_number, idempotency_key, user_id, status,
             recipient_name, recipient_phone, shipping_address,
             subtotal, shipping_fee, total
           ) VALUES (?, ?, ?, 'awaiting_payment', ?, ?, ?, ?, ?, ?)`,
          [
            orderNumber,
            parsed.data.idempotencyKey,
            user.id,
            parsed.data.shippingName,
            parsed.data.shippingPhone,
            parsed.data.shippingAddress,
            (subtotalCents / 100).toFixed(2),
            (SHIPPING_FEE_CENTS / 100).toFixed(2),
            (totalCents / 100).toFixed(2),
          ],
        );

        for (const item of orderItems) {
          const [stockResult] = await connection.execute<ResultSetHeader>(
            `UPDATE products
             SET stock = stock - ?
             WHERE id = ? AND stock >= ?
               AND is_active = 1 AND archived_at IS NULL`,
            [item.quantity, item.productId, item.quantity],
          );
          if (stockResult.affectedRows !== 1) {
            throw new OrderActionError(
              `สินค้า ${item.name} มีสต็อกไม่เพียงพอ กรุณาตรวจสอบตะกร้า`,
            );
          }

          await connection.execute(
            `INSERT INTO order_items (
               order_id, product_id, product_slug, product_name,
               quantity, unit_price, line_total
             ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              orderResult.insertId,
              item.productId,
              item.slug,
              item.name,
              item.quantity,
              (item.unitPriceCents / 100).toFixed(2),
              (item.lineTotalCents / 100).toFixed(2),
            ],
          );
        }

        await connection.execute("DELETE FROM cart_items WHERE user_id = ?", [
          user.id,
        ]);
      }
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    if (error instanceof OrderActionError) {
      return { error: error.message };
    }
    console.error("Creating order failed:", error);
    return { error: "สร้างคำสั่งซื้อไม่สำเร็จ กรุณาลองใหม่" };
  } finally {
    connection.release();
  }

  if (!orderNumber) {
    throw new Error("Order creation completed without an order number.");
  }
  revalidatePath("/");
  revalidatePath("/cart");
  revalidatePath("/orders");
  redirect(`/orders/${encodeURIComponent(orderNumber)}`);
}

const orderNumberSchema = z
  .string()
  .regex(/^LC-\d{8}-[A-F0-9]{16}$/);

interface StripeCheckoutOrderRow extends RowDataPacket {
  id: number;
  order_number: string;
  status: "awaiting_payment" | "pending_review" | "paid";
  total: string | number;
  payment_provider: "manual" | "stripe";
  stripe_checkout_session_id: string | null;
  stripe_checkout_attempt: number;
}

export async function createStripeCheckoutAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await requireUser();
  const parsedOrderNumber = orderNumberSchema.safeParse(
    getString(formData, "orderNumber"),
  );
  if (!parsedOrderNumber.success) {
    return { error: "เลขคำสั่งซื้อไม่ถูกต้อง" };
  }

  let stripe: ReturnType<typeof getStripeClient>;
  let appUrl: string;
  try {
    stripe = getStripeClient();
    appUrl = getAppUrl();
  } catch (error) {
    console.error("Stripe checkout is not configured:", error);
    return { error: "ระบบชำระเงินยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ" };
  }

  const connection = await getDb().getConnection();
  let checkoutUrl: string | undefined;
  let successMessage: string | undefined;
  try {
    await connection.beginTransaction();
    const [orders] = await connection.execute<StripeCheckoutOrderRow[]>(
      `SELECT id, order_number, status, total, payment_provider,
              stripe_checkout_session_id, stripe_checkout_attempt
       FROM orders
       WHERE order_number = ? AND user_id = ?
       LIMIT 1
       FOR UPDATE`,
      [parsedOrderNumber.data, user.id],
    );
    const order = orders[0];
    if (!order) {
      throw new OrderActionError("ไม่พบคำสั่งซื้อนี้");
    }
    if (order.status !== "awaiting_payment") {
      throw new OrderActionError("คำสั่งซื้อนี้ไม่สามารถชำระเงินได้แล้ว");
    }

    const amountCents = Math.round(Number(order.total) * 100);
    if (!Number.isSafeInteger(amountCents)) {
      throw new OrderActionError("ยอดคำสั่งซื้อไม่ถูกต้อง");
    }
    if (
      amountCents < PROMPTPAY_MINIMUM_CENTS ||
      amountCents > PROMPTPAY_MAXIMUM_CENTS
    ) {
      throw new OrderActionError(
        "ยอด PromptPay ผ่าน Stripe ต้องอยู่ระหว่าง 10 ถึง 999,999.99 บาท",
      );
    }

    const nextAttempt = order.stripe_checkout_attempt + 1;
    if (!Number.isSafeInteger(nextAttempt)) {
      throw new OrderActionError("ไม่สามารถเริ่มรายการชำระเงินใหม่ได้");
    }

    if (order.stripe_checkout_session_id) {
      const existingSession = await stripe.checkout.sessions.retrieve(
        order.stripe_checkout_session_id,
      );
      if (existingSession.status === "open") {
        if (!existingSession.url) {
          throw new Error("Open Stripe Checkout Session has no redirect URL.");
        }
        checkoutUrl = existingSession.url;
      } else if (existingSession.status === "complete") {
        successMessage =
          "รับข้อมูลจาก Stripe แล้ว ระบบกำลังยืนยันสถานะชำระเงิน กรุณารีเฟรชหน้านี้อีกครั้ง";
      }
    }

    if (!checkoutUrl && !successMessage) {
      const successUrl =
        `${appUrl}/orders/${encodeURIComponent(order.order_number)}` +
        "?payment=success";
      const cancelUrl =
        `${appUrl}/orders/${encodeURIComponent(order.order_number)}` +
        "?payment=cancelled";
      const metadata = {
        order_id: String(order.id),
        order_number: order.order_number,
      };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          allowed_payment_method_types: ["promptpay"],
          customer_email: user.email,
          client_reference_id: String(order.id),
          metadata,
          payment_intent_data: { metadata },
          line_items: [
            {
              price_data: {
                currency: "thb",
                unit_amount: amountCents,
                product_data: {
                  name: `คำสั่งซื้อ LeeCom ${order.order_number}`,
                },
              },
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
        {
          idempotencyKey: `leecom-order-${order.id}-promptpay-${nextAttempt}`,
        },
      );
      if (!session.url) {
        throw new Error("Stripe Checkout Session did not include a URL.");
      }

      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET payment_provider = 'stripe',
             stripe_checkout_session_id = ?,
             stripe_payment_intent_id = NULL,
             stripe_checkout_attempt = ?
         WHERE id = ? AND user_id = ? AND status = 'awaiting_payment'`,
        [session.id, nextAttempt, order.id, user.id],
      );
      if (updateResult.affectedRows !== 1) {
        throw new OrderActionError(
          "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่",
        );
      }
      checkoutUrl = session.url;
    }

    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Rolling back Stripe checkout failed:", rollbackError);
    }
    if (error instanceof OrderActionError) {
      return { error: error.message };
    }
    console.error("Creating Stripe Checkout Session failed:", error);
    return { error: "เริ่มชำระผ่าน PromptPay ไม่สำเร็จ กรุณาลองใหม่" };
  } finally {
    connection.release();
  }

  if (checkoutUrl) {
    redirect(checkoutUrl);
  }
  return {
    success:
      successMessage ??
      "กำลังตรวจสอบสถานะการชำระเงิน กรุณารีเฟรชหน้านี้อีกครั้ง",
  };
}

const transferDateTimeSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

const transferAmountSchema = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, "กรุณากรอกยอดโอนให้ถูกต้อง");

function toUtcMysqlDateTime(value: string): string | undefined {
  const [date, time] = value.split("T");
  if (!date || !time) {
    return undefined;
  }
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const checkDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    checkDate.getUTCFullYear() !== year ||
    checkDate.getUTCMonth() !== month - 1 ||
    checkDate.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  ) {
    return undefined;
  }

  return new Date(`${value}:00+07:00`)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

interface AwaitingOrderRow extends RowDataPacket {
  id: number;
  status: "awaiting_payment" | "pending_review" | "paid";
  payment_provider: "manual" | "stripe";
  payment_proof_filename: string | null;
}

export async function uploadPaymentProofAction(
  _previousState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const user = await requireUser();
  const parsedOrderNumber = orderNumberSchema.safeParse(
    getString(formData, "orderNumber"),
  );
  const parsedDateTime = transferDateTimeSchema.safeParse(
    getString(formData, "transferredAt"),
  );
  const parsedAmount = transferAmountSchema.safeParse(
    getString(formData, "transferAmount"),
  );
  if (!parsedOrderNumber.success || !parsedDateTime.success) {
    return { error: "กรุณาระบุเลขคำสั่งซื้อและวันเวลาโอนให้ถูกต้อง" };
  }
  if (!parsedAmount.success || Number(parsedAmount.data) <= 0) {
    return { error: "กรุณาระบุยอดโอนที่มากกว่า 0 บาท" };
  }

  const transferredAt = toUtcMysqlDateTime(parsedDateTime.data);
  if (!transferredAt) {
    return { error: "วันหรือเวลาโอนไม่ถูกต้อง" };
  }
  if (new Date(`${transferredAt.replace(" ", "T")}Z`).getTime() > Date.now()) {
    return { error: "วันเวลาโอนไม่สามารถอยู่ในอนาคตได้" };
  }

  let image;
  try {
    image = await validateImageFile(
      formData.get("proof"),
      ["image/jpeg", "image/png"],
      true,
    );
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return { error: error.message };
    }
    throw error;
  }
  if (!image) {
    return { error: "กรุณาแนบสลิป JPG หรือ PNG" };
  }

  const db = getDb();
  const [orders] = await db.execute<AwaitingOrderRow[]>(
    `SELECT id, status, payment_provider,
            payment_slip_filename AS payment_proof_filename
     FROM orders
     WHERE order_number = ? AND user_id = ?
     LIMIT 1`,
    [parsedOrderNumber.data, user.id],
  );
  const order = orders[0];
  if (!order) {
    return { error: "ไม่พบคำสั่งซื้อนี้" };
  }
  if (
    order.status !== "awaiting_payment" ||
    order.payment_provider !== "manual" ||
    order.payment_proof_filename
  ) {
    return { error: "คำสั่งซื้อนี้ไม่สามารถแนบสลิปซ้ำได้" };
  }

  const directory = path.join(process.cwd(), ".private", "payment-proofs");
  let saved: { filename: string; path: string } | undefined;
  try {
    saved = await saveImageFile(image, directory);
    const [result] = await db.execute<ResultSetHeader>(
      `UPDATE orders
       SET status = 'pending_review',
           payment_slip_filename = ?,
           transferred_at = ?, transfer_amount = ?,
           payment_review_note = NULL, payment_reviewed_by = NULL,
           payment_reviewed_at = NULL
       WHERE id = ? AND user_id = ?
         AND status = 'awaiting_payment'
         AND payment_provider = 'manual'
         AND payment_slip_filename IS NULL`,
      [
        saved.filename,
        transferredAt,
        Number(parsedAmount.data).toFixed(2),
        order.id,
        user.id,
      ],
    );
    if (result.affectedRows !== 1) {
      await removeSavedFile(saved.path);
      return { error: "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่" };
    }
  } catch (error) {
    if (saved) {
      try {
        await removeSavedFile(saved.path);
      } catch (cleanupError) {
        console.error("Removing rejected payment proof failed:", cleanupError);
      }
    }
    console.error("Uploading payment proof failed:", error);
    return { error: "อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath(`/orders/${parsedOrderNumber.data}`);
  revalidatePath("/orders");
  return { success: "ส่งสลิปแล้ว คำสั่งซื้ออยู่ระหว่างรอตรวจสอบ" };
}
