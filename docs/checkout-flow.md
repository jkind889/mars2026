# Checkout Flow

## Scope

This document covers application orchestration from cart submission through the
success screen. Stripe-specific settings and event handling are separated into
[Stripe integration and webhooks](stripe-integration.md).

Primary files:

- `mars2026/app/cart/page.tsx`
- `mars2026/app/api/checkout/route.ts`
- `mars2026/lib/checkout-security.ts`
- `mars2026/app/checkout/success/page.tsx`
- `mars2026/components/checkout-success-status.tsx`
- `mars2026/app/api/orders/[orderId]/status/route.ts`

## Request contract

`POST /api/checkout` expects authenticated cookies and JSON shaped as:

```json
{
  "checkoutAttemptId": "550e8400-e29b-41d4-a716-446655440000",
  "items": [{ "variantId": 7, "quantity": 2 }]
}
```

The attempt identifier must be an RFC 4122 version-4 UUID. The server combines
duplicate variants, permits at most 50 distinct lines, caps each combined
quantity at 99, and rejects empty or malformed carts.

## Server orchestration

1. Authenticate with Supabase `getUser`; the route also has an explicit 401
   response containing `/auth/login?returnTo=/cart` as defense in depth.
2. Reload all requested variants through the service-role client, requiring an
   active variant and active parent poster.
3. Require one currency, calculate subtotal from database prices, and validate
   any referenced Stripe Price.
4. Reuse a valid Stripe customer from `customer_profiles`, or create one and
   update both `customer_profiles` and `profiles`.
5. Call `create_or_recover_checkout_order` to atomically create/recover the
   pending order and item snapshots.
6. Recover an existing open/complete Session when the attempt has already been
   used, or create a new hosted Session.
7. Save the Session ID onto the order before returning its hosted URL.

The Checkout Session is configured for payment mode, automatic tax, US-only
shipping-address collection, one configured shipping rate, and customer
shipping updates. Success returns to
`/checkout/success?session_id={CHECKOUT_SESSION_ID}`; cancellation returns to
`/cart`.

## Idempotency and recovery

One browser attempt UUID connects three idempotency layers:

- order number: `marsord-<attempt UUID>`;
- database RPC: creates or recovers that checkout order;
- Stripe Session key: `checkout-session-<attempt UUID>`.

Stripe customer creation separately uses a deterministic key based on the
Supabase user and the previous customer identifier.

When Stripe gives an indeterminate network/API result, the pending order and
attempt identifier are retained so a retry can recover safely. A definite
Session-creation failure deletes the still-pending order and tells the client to
start a new attempt. If a newly created Session cannot be saved, the code first
expires it and then removes the pending order.

## Success verification

The success page accepts only Stripe Checkout Session IDs with the expected
`cs_test_` or `cs_live_` shape. It requires the logged-in user and loads an order
matching both that user and Session ID. It then retrieves the Session from
Stripe and checks Session ID, user reference, user metadata, and order metadata.
Mismatches fail closed with a not-found response.

The browser state is one of `paid`, `processing`, `failed`, or `unverified`.
Pending orders poll the authenticated no-store endpoint
`GET /api/orders/:orderId/status?session_id=...` after 750 ms, 1.25 s, 2 s, 3 s,
5 s, and 8 s. Only a database status of `paid` paired with the exact Session ID
is treated as paid. Only then does [Cart](cart.md) subtract purchased quantities.

## Public errors

Expected validation, stale-catalog, configuration, and Stripe availability
errors return a safe message with an appropriate 4xx/5xx status. Unexpected
errors are logged server-side and return a generic checkout failure. The
`resetCheckoutAttempt` flag tells the cart whether a retry must use a new UUID.
