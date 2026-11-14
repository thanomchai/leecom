import "server-only";
import { connection } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getDb } from "@/lib/db";

export type OrderStatus = "awaiting_payment" | "pending_review" | "paid";
export type PaymentProvider = "manual" | "stripe";

export type OrderSummary = {
  orderNumber: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
};

export type OrderItemSnapshot = {
  productName: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export type OrderDetail = OrderSummary & {
  paymentProvider: PaymentProvider;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  subtotal: number;
  shippingFee: number;
  transferAmount: number | null;
  transferredAt: string | null;
  hasPaymentProof: boolean;
  paymentReviewNote: string | null;
  items: OrderItemSnapshot[];
};

export type PaymentReview = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  transferAmount: number | null;
  transferredAt: string | null;
  createdAt: string;
  hasPaymentProof: boolean;
};

export type PaymentReviewHistoryEntry = {
  id: number;
  orderNumber: string;
  decision: "approved" | "rejected";
  reviewerName: string;
  reviewerEmail: string;
  reviewedAt: string;
  note: string | null;
  customerName: string;
  customerEmail: string;
  total: number;
};

export type AdminTransaction = {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: OrderStatus;
  paymentProvider: PaymentProvider;
  createdAt: string;
  paidAt: string | null;
  transferredAt: string | null;
  reviewedAt: string | null;
};

export type AdminTransactionFilters = {
  search: string;
  status: OrderStatus | "";
  from: string;
  to: string;
  page: number;
};

export type AdminTransactionPage = {
  transactions: AdminTransaction[];
  totalCount: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

interface OrderRow extends RowDataPacket {
  order_number: string;
  status: OrderStatus;
  payment_provider: PaymentProvider;
  total: string | number;
  created_at: Date | string;
  shipping_name: string;
  shipping_phone: string;
  shipping_address: string;
  subtotal: string | number;
  shipping_fee: string | number;
  transfer_amount: string | number | null;
  transferred_at: Date | string | null;
  payment_proof_filename: string | null;
  payment_review_note: string | null;
}

interface PaymentReviewRow extends RowDataPacket {
  order_number: string;
  customer_name: string;
  customer_email: string;
  total: string | number;
  transfer_amount: string | number | null;
  transferred_at: Date | string | null;
  created_at: Date | string;
  payment_proof_filename: string | null;
}

interface PaymentReviewHistoryRow extends RowDataPacket {
  id: number;
  order_number: string;
  decision: "approved" | "rejected";
  reviewer_name: string;
  reviewer_email: string;
  reviewed_at: Date | string;
  note: string | null;
  customer_name: string;
  customer_email: string;
  total: string | number;
}

interface AdminTransactionRow extends RowDataPacket {
  order_number: string;
  customer_name: string;
  customer_email: string;
  total: string | number;
  status: OrderStatus;
  payment_provider: PaymentProvider;
  created_at: Date | string;
  paid_at: Date | string | null;
  transferred_at: Date | string | null;
  payment_reviewed_at: Date | string | null;
}

interface AdminTransactionCountRow extends RowDataPacket {
  total_count: number;
}

interface OrderItemRow extends RowDataPacket {
  product_name: string;
  product_slug: string;
  quantity: number;
  unit_price: string | number;
  line_total: string | number;
}

function toIsoDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : `${value.replace(" ", "T")}Z`;
}

function toNullableIsoDate(value: Date | string | null): string | null {
  return value === null ? null : toIsoDate(value);
}

function bangkokStartOfDayUtc(value: string): string {
  return new Date(`${value}T00:00:00+07:00`)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
}

function toOrderSummary(row: OrderRow): OrderSummary {
  return {
    orderNumber: row.order_number,
    status: row.status,
    total: Number(row.total),
    createdAt: toIsoDate(row.created_at),
  };
}

export async function getOrderHistory(userId: number): Promise<OrderSummary[]> {
  await connection();
  const [rows] = await getDb().execute<OrderRow[]>(
    `SELECT order_number, status, total, created_at
     FROM orders
     WHERE user_id = ?
     ORDER BY created_at DESC, id DESC`,
    [userId],
  );
  return rows.map(toOrderSummary);
}

export async function getPendingPaymentReviews(): Promise<PaymentReview[]> {
  await connection();
  const [rows] = await getDb().execute<PaymentReviewRow[]>(
    `SELECT o.order_number, u.name AS customer_name, u.email AS customer_email,
            o.total, o.transfer_amount, o.transferred_at, o.created_at,
            o.payment_slip_filename AS payment_proof_filename
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     WHERE o.status = 'pending_review'
     ORDER BY o.created_at ASC, o.id ASC`,
  );
  return rows.map((row) => ({
    orderNumber: row.order_number,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    total: Number(row.total),
    transferAmount:
      row.transfer_amount === null ? null : Number(row.transfer_amount),
    transferredAt: toNullableIsoDate(row.transferred_at),
    createdAt: toIsoDate(row.created_at),
    hasPaymentProof: row.payment_proof_filename !== null,
  }));
}

export async function getPaymentReviewHistory(): Promise<
  PaymentReviewHistoryEntry[]
> {
  await connection();
  const [rows] = await getDb().execute<PaymentReviewHistoryRow[]>(
    `SELECT pr.id, o.order_number, pr.decision,
            pr.reviewer_name, pr.reviewer_email, pr.reviewed_at, pr.note,
            u.name AS customer_name, u.email AS customer_email, o.total
     FROM payment_reviews pr
     INNER JOIN orders o ON o.id = pr.order_id
     INNER JOIN users u ON u.id = o.user_id
     ORDER BY pr.reviewed_at DESC, pr.id DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    decision: row.decision,
    reviewerName: row.reviewer_name,
    reviewerEmail: row.reviewer_email,
    reviewedAt: toIsoDate(row.reviewed_at),
    note: row.note,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    total: Number(row.total),
  }));
}

export async function getAdminTransactions(
  filters: AdminTransactionFilters,
): Promise<AdminTransactionPage> {
  await connection();
  const conditions: string[] = [];
  const values: (string | number)[] = [];

  if (filters.search) {
    conditions.push(
      "(LOCATE(?, o.order_number) > 0 OR LOCATE(?, u.name) > 0 OR LOCATE(?, u.email) > 0)",
    );
    values.push(filters.search, filters.search, filters.search);
  }
  if (filters.status) {
    conditions.push("o.status = ?");
    values.push(filters.status);
  }
  if (filters.from) {
    conditions.push("o.created_at >= ?");
    values.push(bangkokStartOfDayUtc(filters.from));
  }
  if (filters.to) {
    conditions.push("o.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(bangkokStartOfDayUtc(filters.to));
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const db = getDb();
  const [countRows] = await db.execute<AdminTransactionCountRow[]>(
    `SELECT COUNT(*) AS total_count
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     ${whereClause}`,
    values,
  );
  const totalCount = Number(countRows[0]?.total_count ?? 0);
  const pageSize = 25;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const page = Math.min(filters.page, pageCount);
  const offset = (page - 1) * pageSize;
  const [rows] = await db.execute<AdminTransactionRow[]>(
    `SELECT o.order_number, u.name AS customer_name,
            u.email AS customer_email, o.total, o.status,
            o.payment_provider, o.created_at, o.paid_at, o.transferred_at,
            o.payment_reviewed_at
     FROM orders o
     INNER JOIN users u ON u.id = o.user_id
     ${whereClause}
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT ? OFFSET ?`,
    [...values, pageSize, offset],
  );

  return {
    transactions: rows.map((row) => ({
      orderNumber: row.order_number,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      total: Number(row.total),
      status: row.status,
      paymentProvider: row.payment_provider,
      createdAt: toIsoDate(row.created_at),
      paidAt: toNullableIsoDate(row.paid_at),
      transferredAt: toNullableIsoDate(row.transferred_at),
      reviewedAt: toNullableIsoDate(row.payment_reviewed_at),
    })),
    totalCount,
    page,
    pageCount,
    pageSize,
  };
}

export async function getOrderForUser(
  userId: number,
  orderNumber: string,
): Promise<OrderDetail | undefined> {
  await connection();
  const db = getDb();
  const [orders] = await db.execute<OrderRow[]>(
    `SELECT order_number, status, payment_provider, total, created_at,
            recipient_name AS shipping_name,
            recipient_phone AS shipping_phone, shipping_address,
            subtotal, shipping_fee, transfer_amount, transferred_at,
            payment_slip_filename AS payment_proof_filename,
            payment_review_note
     FROM orders
     WHERE order_number = ? AND user_id = ?
     LIMIT 1`,
    [orderNumber, userId],
  );
  const row = orders[0];
  if (!row) {
    return undefined;
  }

  const [items] = await db.execute<OrderItemRow[]>(
    `SELECT product_name, product_slug, quantity, unit_price, line_total
     FROM order_items
     WHERE order_id = (
       SELECT id FROM orders WHERE order_number = ? AND user_id = ? LIMIT 1
     )
     ORDER BY id`,
    [orderNumber, userId],
  );

  return {
    ...toOrderSummary(row),
    paymentProvider: row.payment_provider,
    shippingName: row.shipping_name,
    shippingPhone: row.shipping_phone,
    shippingAddress: row.shipping_address,
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    transferAmount:
      row.transfer_amount === null ? null : Number(row.transfer_amount),
    transferredAt: toNullableIsoDate(row.transferred_at),
    hasPaymentProof: row.payment_proof_filename !== null,
    paymentReviewNote: row.payment_review_note,
    items: items.map((item) => ({
      productName: item.product_name,
      productSlug: item.product_slug,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
      lineTotal: Number(item.line_total),
    })),
  };
}
