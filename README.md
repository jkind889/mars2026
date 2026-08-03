# MARS

MARS is a Next.js poster storefront backed by Supabase and Stripe Checkout. The
application source lives in [`mars2026/`](mars2026/).

## Documentation

Open the component guide related to the work you are doing:

- [Developer setup and verification](docs/developer-setup.md)
- [Catalog and poster import](docs/catalog-and-import.md)
- [Cart](docs/cart.md)
- [Authentication and route protection](docs/authentication.md)
- [Checkout flow](docs/checkout-flow.md)
- [Stripe integration and webhooks](docs/stripe-integration.md)
- [Orders and fulfillment](docs/orders-and-fulfillment.md)
- [Supabase data contract](docs/supabase-data-contract.md)

Each guide names the source files it owns and links to adjacent flows.

## Quick start

```bash
cd mars2026
npm install
npm run dev
```

The app also needs Supabase and Stripe configuration. See
[Developer setup and verification](docs/developer-setup.md)
before expecting catalog, authentication, or checkout features to work.
