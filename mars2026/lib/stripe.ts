import Stripe from "stripe";

export function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Missing required environment variable: STRIPE_SECRET_KEY");
  }

  return new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
    maxNetworkRetries: 2,
  });
}
