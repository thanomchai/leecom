"use server";

import path from "node:path";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { removeSavedFile } from "@/lib/uploads";

export type PaymentReviewActionState = {
  error?: string;
  success?: string;
};

class PaymentReviewActionError extends Error {}

interface ReviewOrderRow extends RowDataPacket {
  id: number;
  status: "awaiting_payment" | "pending_review" | "paid";
  payment_slip_filename: string | null;
}

const reviewSchema = z.object({
  orderNumber: z.string().regex(/^LC-\d{8}-[A-F0-9]{16}$/),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(1000, "หมายเหตุต้องไม่เกิน 1,000 ตัวอักษร"),
});

function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function reviewPaymentAction(
  _previousState: PaymentReviewActionState,
  formData: FormData,
): Promise<PaymentReviewActionState> {
  const admin = await requireAdmin();
  const parsed = reviewSchema.safeParse({
    orderNumber: getString(formData, "orderNumber"),
    decision: getString(formData, "decision"),
    note: getString(formData, "note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลตรวจสอบไม่ถูกต้อง" };
  }

  const connection = await getDb().getConnection();
  let transactionStarted = false;
  let proofFilename: string | undefined;
  try {
    await connection.beginTransaction();
    transactionStarted = true;
    const [orders] = await connection.execute<ReviewOrderRow[]>(
      `SELECT id, status, payment_slip_filename
       FROM orders
       WHERE order_number = ?
       LIMIT 1
       FOR UPDATE`,
      [parsed.data.orderNumber],
    );
    const order = orders[0];
    if (!order) {
      throw new PaymentReviewActionError("ไม่พบคำสั่งซื้อนี้");
    }
    if (order.status !== "pending_review") {
      throw new PaymentReviewActionError(
        "คำสั่งซื้อนี้ไม่อยู่ระหว่างรอตรวจสอบแล้ว กรุณาโหลดหน้าใหม่",
      );
    }
    const validProofFilename =
      order.payment_slip_filename &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/.test(
        order.payment_slip_filename,
      )
        ? order.payment_slip_filename
        : undefined;
    if (parsed.data.decision === "approve" && !validProofFilename) {
      throw new PaymentReviewActionError("ไม่พบไฟล์สลิปที่ถูกต้องสำหรับคำสั่งซื้อนี้");
    }

    const note =
      parsed.data.decision === "reject"
        ? parsed.data.note || "กรุณาตรวจสอบข้อมูลการโอนและแนบสลิปใหม่"
        : parsed.data.note || null;
    let result: ResultSetHeader;
    if (parsed.data.decision === "approve") {
      [result] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET status = 'paid', paid_at = UTC_TIMESTAMP(3),
             payment_review_note = ?,
             payment_reviewed_by = ?, payment_reviewed_at = UTC_TIMESTAMP()
         WHERE id = ? AND status = 'pending_review'`,
        [note, admin.id, order.id],
      );
    } else {
      [result] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET status = 'awaiting_payment', payment_slip_filename = NULL,
             transfer_amount = NULL, transferred_at = NULL,
             payment_review_note = ?, payment_reviewed_by = ?,
             payment_reviewed_at = UTC_TIMESTAMP()
         WHERE id = ? AND status = 'pending_review'`,
        [note, admin.id, order.id],
      );
      proofFilename = validProofFilename;
    }
    if (result.affectedRows !== 1) {
      throw new PaymentReviewActionError(
        "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่",
      );
    }
    await connection.execute<ResultSetHeader>(
      `INSERT INTO payment_reviews (
         order_id, order_number, decision, reviewer_id, reviewer_name,
         reviewer_email, reviewed_at, note
       ) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3), ?)`,
      [
        order.id,
        parsed.data.orderNumber,
        parsed.data.decision === "approve" ? "approved" : "rejected",
        admin.id,
        admin.name,
        admin.email,
        note,
      ],
    );
    await connection.commit();
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error("Rolling back payment review failed:", rollbackError);
      }
    }
    if (error instanceof PaymentReviewActionError) {
      return { error: error.message };
    }
    console.error("Reviewing payment failed:", error);
    return { error: "บันทึกผลตรวจสอบไม่สำเร็จ กรุณาลองใหม่" };
  } finally {
    connection.release();
  }

  let success =
    parsed.data.decision === "approve"
      ? "อนุมัติการชำระเงินแล้ว"
      : "ปฏิเสธสลิปแล้ว ลูกค้าสามารถแนบสลิปใหม่ได้โดยไม่คืนสต็อก";
  if (proofFilename) {
    try {
      await removeSavedFile(
        path.join(process.cwd(), ".private", "payment-proofs", proofFilename),
      );
    } catch (error) {
      console.error("Removing rejected payment proof failed:", error);
      success += " แต่ลบไฟล์สลิปเดิมไม่สำเร็จ กรุณาตรวจสอบไฟล์ส่วนตัว";
    }
  }

  revalidatePath("/admin/payments");
  revalidatePath("/admin/payments/history");
  revalidatePath("/orders");
  revalidatePath(`/orders/${parsed.data.orderNumber}`);
  return { success };
}
