# Stripe Integration and Webhooks

## Responsibilities

Stripe provides hosted payment collection, automatic tax, shipping-rate
selection, persistent customers, and payment lifecycle events. Application-side
cart and order orchestration is documented in [Checkout flow](checkout-flow.md).

Primary files:

- `mars2026/lib/stripe.ts`
- `mars2026/app/api/checkout/route.ts`
- `mars2026/app/api/stripe/webhook/route.ts`
- `mars2026/lib/checkout-security.ts`

## Server client

`createStripeClient` constructs a new server-side client with
`STRIPE_SECRET_KEY`, API version `2026-06-24.dahlia`, and two network retries.
No Stripe secret is used in browser code. Although `@stripe/stripe-js` is
installed, the current implementation redirects to Stripe-hosted Checkout and
does not use Elements.

## Product and price strategy

Variants may store a `stripe_price_id`:

- With an ID, checkout retrieves the Price and requires it to be active,
  one-time, and equal to the Supabase amount/currency.
- Without an ID, checkout sends inline `price_data`, including poster/variant
  metadata and the poster image when available.

This supports gradual Stripe catalog adoption while keeping Supabase as the
storefront catalog. A mismatch blocks checkout rather than charging a stale
amount.

## Customer strategy

The app stores the Stripe Customer ID in `customer_profiles` and mirrors it to
`profiles`. A missing, deleted, or nonexistent Stripe Customer is recreated with
the Supabase user ID in metadata. The Session uses that customer and allows
Stripe to update its shipping details.

## Webhook endpoint

Configure Stripe to send events to:

```text
POST /api/stripe/webhook
```

The route reads the raw body and validates the `stripe-signature` header with
`STRIPE_WEBHOOK_SECRET`. It bypasses Supabase login middleware but is not public
in the trust sense: an invalid or missing signature receives HTTP 400.

Subscribed event behavior:

| Event | Order transition |
| --- | --- |
| `checkout.session.completed` | Marks paid only when the retrieved Session reports paid |
| `checkout.session.async_payment_succeeded` | Marks the pending order paid |
| `checkout.session.async_payment_failed` | `pending` → payment `failed`, fulfillment `canceled` |
| `checkout.session.expired` | `pending` → payment and fulfillment `canceled` |

Other event types are acknowledged without mutation.

Before any transition, the handler checks the Session's mode, user reference,
user metadata, Stripe Customer, subtotal, currency, and stored Session identity
against the order. Successful-payment handling first retrieves the current
Session from Stripe; failed and expired handling validates the signed event
object. These checks prevent a signed but unrelated Session from updating an
order.

Successful events persist Stripe payment/session identifiers, subtotal,
shipping, tax, total, currency, email, shipping address, `paid_at`, payment
status `paid`, and fulfillment status `unfulfilled`. Duplicate delivery is safe:
updates are conditional on `payment_status = pending`. A repeated success event
may still backfill shipping fields on an already-processed order.

Failures return HTTP 500 so Stripe can retry. Successful handling returns
`{"received":true}`.

## Local webhook testing

With the Stripe CLI authenticated, forward test events to the running app:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Use the signing secret printed by that process as `STRIPE_WEBHOOK_SECRET`, and
keep Stripe test-mode keys, Price IDs, and shipping-rate IDs together. Confirm
the full database transition instead of relying only on a 200 response.

## Production checklist

- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are from the same mode as all
  referenced Price and shipping-rate IDs.
- The endpoint subscribes to all four handled event types.
- `SITE_URL` is the canonical HTTPS origin.
- The shipping rate is active and suitable for US addresses.
- Webhook failures are monitored and replayable from Stripe.
- The Supabase service-role key is available only to server execution.
