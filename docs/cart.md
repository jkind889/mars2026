# Cart

## Responsibilities

The cart owns browser-side selection and quantity state. It deliberately does
not own product names, availability, or prices.

Primary files:

- `mars2026/components/cart-provider.tsx`
- `mars2026/components/variantpicker.tsx`
- `mars2026/app/cart/page.tsx`
- `mars2026/components/checkout-success-cart-cleanup.tsx`

## Stored shape

The `CartProvider` wraps the entire application and persists this minimal shape
under the local-storage key `mars-cart-v1`:

```json
[{ "variantId": 7, "quantity": 2 }]
```

Invalid rows are discarded, duplicate variant rows are combined, and each
variant quantity is capped at 99. A browser `storage` listener synchronizes cart
changes across tabs. If local storage is unavailable, the in-memory cart remains
usable for the current page lifetime.

## Cart page flow

After hydration, `/cart` queries active variants and their active parent posters
from Supabase. This supplies current labels, images, currency, price, and
availability. Missing variants are shown as unavailable and block checkout until
removed. The displayed subtotal is only a preview; the checkout API reloads and
validates all values server-side.

The route-protection proxy currently treats `/cart` as authenticated, so an
anonymous navigation is redirected to `/auth/login?returnTo=/cart`.

## Starting checkout

The page creates a UUID checkout-attempt identifier and posts it with
`variantId`/`quantity` rows to `/api/checkout`. The identifier is reused for
retries until the cart changes or the API explicitly asks the client to reset
it. This is the browser half of checkout idempotency; the server behavior is in
[Checkout flow](checkout-flow.md).

## Paid-order cleanup

The success screen never clears the whole cart blindly. Once an order is
confirmed paid, it subtracts the quantities captured in that order. Items added
after checkout therefore remain. Processed order identifiers are remembered in
`mars-cart-cleaned-orders-v1` (up to 50 entries) so refreshing a success page
does not subtract the same quantities twice.

For pending, failed, canceled, or unverified checkouts, the cart is unchanged.
