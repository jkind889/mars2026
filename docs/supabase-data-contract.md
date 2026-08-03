# Supabase Data Contract

## Scope and source of truth

This is the database interface inferred from current application reads and
writes. The repository does not include SQL migrations, function definitions,
foreign keys, storage policies, or RLS policies. Treat this page as a contract
for an externally managed Supabase project, not as executable schema.

Primary clients live in `mars2026/lib/supabase/`; database call sites are in the
catalog, cart, checkout, order pages, webhook route, and poster importer.

## Tables

| Table | Fields used by the application | Responsibility |
| --- | --- | --- |
| `posters` | `id`, `title`, `slug`, `description`, `collection`, `image_url`, `status`, `sort_order`, `created_at` | Public catalog records |
| `variants` | `id`, `poster_id`, `sku`, `label`, `width_in`, `height_in`, `paper_type`, `price_cents`, `currency`, `stripe_price_id`, `is_active`, `production_notes` | Purchasable poster sizes/prices |
| `customer_profiles` | `user_id`, `stripe_customer_id` | Stripe customer lookup during checkout |
| `profiles` | `user_id`, `email`, `stripe_customer_id` | Mirrored checkout identity data |
| `orders` | `id`, `user_id`, `order_number`, `stripe_customer_id`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, `payment_status`, `fulfillment_status`, `subtotal_cents`, `shipping_cents`, `tax_cents`, `total_cents`, `currency`, `customer_email`, shipping name/address fields, `tracking_number`, `created_at`, `paid_at` | Checkout and fulfillment state |
| `order_items` | `id`, `order_id`, `poster_id`, `variant_id`, `quantity`, `unit_price_cents`, `line_total_cents`, `poster_title_snapshot`, `variant_label_snapshot`, `poster_image_snapshot` | Immutable-at-purchase line snapshots |
| `admin_users` | `user_id` | Admin authorization membership |

Relation names must support the embedded Supabase selects used by the app:
`variants → posters`, `orders → order_items`, and the corresponding foreign-key
relationships.

## Checkout function

The checkout route calls:

```text
create_or_recover_checkout_order(
  p_user_id,
  p_order_number,
  p_stripe_customer_id,
  p_subtotal_cents,
  p_currency,
  p_customer_email,
  p_items
)
```

`p_items` is a JSON array containing poster/variant identifiers, quantity,
unit/line totals, and poster/variant/image snapshots. The function must return a
single row with `id`, `payment_status`, `stripe_checkout_session_id`, and a
boolean `reused` field.

The application contract requires the function to atomically create the order
and items or recover the order for the same deterministic order number. It must
not silently accept different item content for an existing attempt. The route
treats Postgres error code `22023` as a cart-change conflict and performs an
additional item comparison for recovered orders.

## Storage

The importer defaults to the `poster-preview-images` bucket and generates public
URLs with `getPublicUrl`. That bucket and the imported objects must be publicly
readable for poster images to render. Imports authenticate with the service-role
key and upload with `upsert: true`.

## Required access-control behavior

The exact policies are external, but application behavior assumes:

- anonymous and authenticated users can read active posters and active variants;
- a customer can read only their own orders and related order items;
- an authenticated user can determine only their own admin membership;
- an admin member can read all orders and their items;
- browser clients cannot set payment status or read other customers' data;
- service-role checkout and webhook code can manage profiles, customers, orders,
  and items.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_` variable or Client
Component.

## Constraints needed by current code

- `posters.slug` is unique for importer upserts and detail routing.
- `variants.sku` is unique for importer update-or-insert behavior.
- `customer_profiles.user_id` and `profiles.user_id` support upsert conflict
  handling.
- `orders.order_number` must support deterministic attempt recovery.
- Money fields use integer minor units; all line items in one order share one
  currency.
- Order and item relationships support cascade/cleanup behavior expected when a
  still-pending order is deleted after a definite checkout failure.

Because those constraints are not versioned here, verify them directly in
Supabase before modifying checkout logic.
