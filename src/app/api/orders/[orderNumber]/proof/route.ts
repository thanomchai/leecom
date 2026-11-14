import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

interface PaymentProofRow extends RowDataPacket {
  user_id: number;
  payment_proof_filename: string | null;
}

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/orders/[orderNumber]/proof">,
) {
  const user = await getCurrentUser();
  if (!user) {
    return notFoundResponse();
  }

  const { orderNumber } = await params;
  if (!/^LC-\d{8}-[A-F0-9]{16}$/.test(orderNumber)) {
    return notFoundResponse();
  }

  const [rows] = await getDb().execute<PaymentProofRow[]>(
    `SELECT user_id, payment_slip_filename AS payment_proof_filename
     FROM orders
     WHERE order_number = ?
     LIMIT 1`,
    [orderNumber],
  );
  const order = rows[0];
  if (!order || (order.user_id !== user.id && user.role !== "admin")) {
    return notFoundResponse();
  }
  const filename = order.payment_proof_filename;
  if (!filename) {
    return notFoundResponse();
  }
  const match = filename.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.(jpg|png)$/,
  );
  if (!match) {
    return notFoundResponse();
  }

  let contents: Buffer;
  try {
    contents = await readFile(
      path.join(process.cwd(), ".private", "payment-proofs", filename),
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return notFoundResponse();
    }
    throw error;
  }

  const contentType = match[2] === "jpg" ? "image/jpeg" : "image/png";
  const body = new Uint8Array(contents);
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="payment-proof.${match[2]}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
