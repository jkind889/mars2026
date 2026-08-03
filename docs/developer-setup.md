# Developer Setup and Verification

## Application root

Commands run from the nested application directory:

```bash
cd mars2026
npm install
npm run dev
```

The development server uses the normal Next.js address,
`http://localhost:3000`. The repository does not pin a Node.js version, so use a
Node release supported by the installed Next.js version.

## Environment variables

Store local values in `mars2026/.env.local`. Do not commit secret values.

| Variable | Visibility | Required by |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | All Supabase clients and the poster importer |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Browser auth, server rendering, and session proxy |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret, server only | Checkout writes, webhooks, and poster import |
| `STRIPE_SECRET_KEY` | Secret, server only | Checkout Session/customer operations and webhook reconciliation |
| `STRIPE_WEBHOOK_SECRET` | Secret, server only | Signature verification at `/api/stripe/webhook` |
| `STRIPE_SHIPPING_RATE_ID` | Server configuration | The single shipping option attached to Checkout Sessions |
| `SITE_URL` | Server configuration | Canonical success and cancel URL origin; recommended in every environment |
| `VERCEL_URL` | Platform-provided | Fallback origin and metadata base on Vercel |

`SITE_URL` must be an absolute HTTP or HTTPS URL. Checkout falls back to
`https://${VERCEL_URL}` and then the request origin when it is absent.

## External prerequisites

Before the full app can run, provision:

- the Supabase tables, relationships, function, RLS policies, and storage bucket
  described in the [Supabase data contract](supabase-data-contract.md);
- Supabase Auth redirect URLs for the application origin, account-order page,
  and password-update page;
- Stripe secret credentials, a shipping rate, and a webhook endpoint described
  in [Stripe integration and webhooks](stripe-integration.md).

The repository has no migrations, so `npm install` does not create the database.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Create a production build and run framework/type checks |
| `npm start` | Serve an existing production build |
| `npm run lint` | Run ESLint over the application |
| `npm test` | Run Node tests for auth redirects and checkout helpers |
| `npm run import:posters` | Import `data/posters.json` into Supabase |

## Verification by change type

- UI or route changes: run `npm run lint` and `npm run build`, then exercise the
  relevant route in a browser.
- Checkout/security helper changes: also run `npm test`.
- Stripe/webhook changes: send a signed test event and confirm the expected
  database transition; unit tests do not currently cover the route handler.
- Catalog/import changes: use a non-production Supabase project first and verify
  the uploaded object plus poster and variant rows.

## Known verification gaps

Tests currently cover pure validation, idempotency identifiers, return-path
sanitization, checkout status mapping, polling delays, and cart subtraction.
There are no repository-owned integration tests for Supabase policies, the
checkout RPC, Stripe Session creation, webhook delivery, or page rendering.
