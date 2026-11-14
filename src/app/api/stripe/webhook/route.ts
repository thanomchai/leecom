import "server-only";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import Stripe from "stripe";
import { getDb } from "@/lib/db";
import { getStripeClient } from "@/lib/stripe";

interface StripeOrderRow extends RowDataPacket {
  id: number;
  order_number: string;
  status: "awaiting_payment" | "pending_review" | "paid";
  total: string | number;
  payment_provider: "manual" | "stripe";
  stripe_checkout_session_id: string | null;
}

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ER_DUP_ENTRY"
  );
}

async function applyCheckoutSessionEvent(
  eventId: string,
  eventType: string,
  session: Stripe.Checkout.Session,
  paymentFailed: boolean,
): Promise<"processed" | "duplicate" | "ignored"> {
  const connection = await getDb().getConnection();
  try {
    await connection.beginTransaction();
    try {
      await connection.execute<ResultSetHeader>(
        `INSERT INTO stripe_webhook_events (event_id, event_type)
         VALUES (?, ?)`,
        [eventId, eventType],
      );
    } catch (error) {
      if (!isDuplicateEntry(error)) {
        throw error;
      }
      await connection.rollback();
      return "duplicate";
    }

    const metadata = session.metadata;
    const orderNumber = metadata?.order_number;
    const orderId = metadata?.order_id;
    if (
      !orderNumber ||
      !/^LC-\d{8}-[A-F0-9]{16}$/.test(orderNumber) ||
      !orderId ||
      !/^\d+$/.test(orderId)
    ) {
      console.error("Ignoring Stripe payment with invalid order metadata.", {
        eventId,
        sessionId: session.id,
      });
      await connection.commit();
      return "ignored";
    }

    const [orders] = await connection.execute<StripeOrderRow[]>(
      `SELECT id, order_number, status, total, payment_provider,
              stripe_checkout_session_id
       FROM orders
       WHERE order_number = ?
       LIMIT 1
       FOR UPDATE`,
      [orderNumber],
    );
    const order = orders[0];
    const expectedAmount = order
      ? Math.round(Number(order.total) * 100)
      : Number.NaN;
    if (
      !order ||
      !Number.isSafeInteger(Number(orderId)) ||
      order.id !== Number(orderId) ||
      session.client_reference_id !== String(order.id) ||
      order.payment_provider !== "stripe" ||
      order.stripe_checkout_session_id !== session.id ||
      session.currency !== "thb" ||
      session.amount_total !== expectedAmount
    ) {
      console.error("Ignoring Stripe payment that does not match an order.", {
        eventId,
        sessionId: session.id,
        orderNumber,
      });
      await connection.commit();
      return "ignored";
    }

    if (paymentFailed && order.status === "awaiting_payment") {
      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET payment_provider = 'manual',
             stripe_checkout_session_id = NULL,
             stripe_payment_intent_id = NULL
         WHERE id = ? AND status = 'awaiting_payment'
           AND payment_provider = 'stripe'
           AND stripe_checkout_session_id = ?`,
        [order.id, session.id],
      );
      if (updateResult.affectedRows !== 1) {
        throw new Error("Order status changed while recording Stripe failure.");
      }
    } else if (paymentFailed && order.status !== "paid") {
      console.error("Ignoring Stripe failure for an order in an incompatible state.", {
        eventId,
        orderNumber,
        status: order.status,
      });
      await connection.commit();
      return "ignored";
    } else if (!paymentFailed && order.status === "awaiting_payment") {
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : (session.payment_intent?.id ?? null);
      const [updateResult] = await connection.execute<ResultSetHeader>(
        `UPDATE orders
         SET status = 'paid', paid_at = UTC_TIMESTAMP(3),
             stripe_payment_intent_id = ?
         WHERE id = ? AND status = 'awaiting_payment'
           AND payment_provider = 'stripe'
           AND stripe_checkout_session_id = ?`,
        [paymentIntentId, order.id, session.id],
      );
      if (updateResult.affectedRows !== 1) {
        throw new Error("Order status changed while recording Stripe payment.");
      }
    } else if (!paymentFailed && order.status !== "paid") {
      console.error("Ignoring Stripe payment for an order in an incompatible state.", {
        eventId,
        orderNumber,
        status: order.status,
      });
      await connection.commit();
      return "ignored";
    }

    await connection.commit();
    return "processed";
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      console.error("Rolling back Stripe webhook transaction failed:", rollbackError);
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!signature) {
    return new Response("Missing Stripe signature.", { status: 400 });
  }
  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET environment variable.");
    return new Response("Stripe webhook is not configured.", { status: 500 });
  }

  let stripe: Stripe;
  try {
    stripe = getStripeClient();
  } catch (error) {
    console.error("Stripe webhook client is not configured:", error);
    return new Response("Stripe webhook is not configured.", { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return new Response("Invalid Stripe webhook.", { status: 400 });
  }

  const paymentFailed = event.type === "checkout.session.async_payment_failed";
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    !paymentFailed
  ) {
    return Response.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (
    (paymentFailed && session.payment_status === "paid") ||
    (!paymentFailed && session.payment_status !== "paid")
  ) {
    return Response.json({ received: true });
  }

  try {
    await applyCheckoutSessionEvent(
      event.id,
      event.type,
      session,
      paymentFailed,
    );
    return Response.json({ received: true });
  } catch (error) {
    console.error("Processing Stripe webhook failed:", error);
    return new Response("Stripe webhook processing failed.", { status: 500 });
  }
}
