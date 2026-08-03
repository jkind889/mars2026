# Orders and Fulfillment

## Responsibilities

This component presents paid customer history, administrator order details, and
the status endpoint used immediately after checkout. Creation and payment-state
mutation belong to the checkout and Stripe components.

Primary files:

- `mars2026/app/account/orders/page.tsx`
- `mars2026/app/admin/orders/page.tsx`
- `mars2026/app/api/orders/[orderId]/status/route.ts`
- `mars2026/app/api/stripe/webhook/route.ts`

## Customer history

`/account/orders` reads the current claim subject and selects only that user's
orders with `payment_status = paid`, newest first. It displays totals,
fulfillment/payment state, and item snapshots. Snapshot fields ensure historical
orders keep the purchased title, variant label, and price even if catalog rows
change later.

The query uses the cookie-scoped Supabase client and therefore requires an RLS
policy that exposes only the authenticated user's rows and related order items.

## Checkout status endpoint

`GET /api/orders/:orderId/status?session_id=...` validates both identifiers,
requires authentication, and selects a row matching order ID, user ID, and
Stripe Session ID. Responses disable caching and vary on cookies. The response
contains only the order number, raw payment status, and a boolean that is true
only when the row is paid for the exact Session.

## Administrator view

`/admin/orders` first looks for the current user in `admin_users`; unauthorized
and unauthenticated users receive a not-found page. It then displays all orders,
including shipping name/address, tracking number, status, totals, and item
snapshots.

This page is currently read-only. There is no UI or route in the repository for
changing fulfillment status or tracking numbers. Those values must currently be
managed outside this application.

Because the page does not use the service-role client, RLS must allow an
`admin_users` member to read all needed order and order-item rows.

## State ownership

The checkout RPC creates orders in `pending`. Only the signed Stripe webhook is
authoritative for these transitions:

| Condition | Payment status | Fulfillment status |
| --- | --- | --- |
| Successful payment | `paid` | `unfulfilled` |
| Async payment failed | `failed` | `canceled` |
| Checkout Session expired | `canceled` | `canceled` |

Webhook updates are conditional on the order still being `pending`, making
repeat deliveries idempotent. See [Stripe integration](stripe-integration.md)
for reconciliation details and [Supabase data contract](supabase-data-contract.md)
for fields and policy expectations.
