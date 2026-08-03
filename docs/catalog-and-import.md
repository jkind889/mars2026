# Catalog and Poster Import

## Responsibilities

This component owns public poster discovery, poster details, purchasable print
variants, and the operational import of poster records and preview images.

Primary files:

- `mars2026/app/archive/page.tsx`
- `mars2026/components/archive-list.tsx`
- `mars2026/app/posters/[slug]/page.tsx`
- `mars2026/components/variantpicker.tsx`
- `mars2026/scripts/import-posters.mjs`
- `mars2026/data/posters.json`

## Read flow

The archive server component selects posters whose `status` is `active`, ordered
by `sort_order` and then newest `created_at`. The client-side archive list adds
search, list/grid switching, and image preview without issuing more queries.
`/shop` permanently redirects to `/archive`.

The poster detail route loads one active poster by slug, followed by its active
variants ordered by price. A `?variant=<id>` query can choose the initial variant
when that identifier belongs to the loaded poster. Selecting **Add to cart**
stores only the variant identifier; see [Cart](cart.md).

## Import manifest

Run the checked-in manifest with:

```bash
cd mars2026
npm run import:posters
```

The script accepts another manifest path directly:

```bash
node scripts/import-posters.mjs path/to/posters.json
```

Top-level fields:

| Field | Meaning |
| --- | --- |
| `bucket` | Public Supabase Storage bucket; defaults to `poster-preview-images` |
| `posters` | Non-empty array of poster definitions |

A poster requires `title`, `slug`, at least one `variant`, and either
`imagePath` or `storagePath`. `imagePath` uploads a local JPEG, PNG, or WebP with
upsert enabled. `storagePath` resolves an object that is already in the bucket.
Optional poster fields are `description`, `collection`, `status`, and
`storageName`; status defaults to `draft`.

A variant requires `sku`, `label`, `widthIn`, `heightIn`, `paperType`, and
`priceCents`. Optional fields include `currency` (defaults to `usd`),
`stripePriceId`, `isActive` (defaults to `true`), and `productionNotes`.

## Upsert behavior

- Posters are upserted by unique `slug`.
- Variants are looked up by `sku`, then updated or inserted.
- Existing objects at the same storage path are replaced.
- Items omitted from a later manifest are not deleted or deactivated.
- The importer runs sequentially and stops on the first error.
- The current importer does not write `sort_order`; manage it separately in
  Supabase if archive ordering needs to be curated.

## Pricing boundary

`price_cents` and `currency` in Supabase are the storefront source of truth. A
variant may also reference a Stripe Price with `stripe_price_id`. When it does,
checkout retrieves that Price and requires it to be active, one-time, and an
exact amount/currency match. Without a Stripe Price ID, checkout creates inline
Stripe `price_data` from the database values.

See [Supabase data contract](supabase-data-contract.md) for table fields and
[Stripe integration](stripe-integration.md) for payment configuration.
