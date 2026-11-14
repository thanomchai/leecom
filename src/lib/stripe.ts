import "server-only";
import Stripe from "stripe";

let stripe: Stripe | undefined;

export const PROMPTPAY_MINIMUM_CENTS = 1_000;
export const PROMPTPAY_MAXIMUM_CENTS = 99_999_999;

export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY environment variable.");
  }

  stripe ??= new Stripe(secretKey, { maxNetworkRetries: 2 });
  return stripe;
}

export function getAppUrl(): string {
  const value = process.env.APP_URL?.trim();
  if (!value) {
    throw new Error("Missing APP_URL environment variable.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_URL must be an absolute URL.");
  }

  const isLocalHttp =
    url.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !isLocalHttp) ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "APP_URL must use HTTPS (HTTP is allowed for localhost) and contain only the site origin.",
    );
  }

  return url.origin;
}
