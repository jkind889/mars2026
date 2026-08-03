# Authentication and Route Protection

## Responsibilities

Supabase Auth owns email/password identity. Application code owns cookie-aware
clients, safe post-login routing, and the division between public and protected
paths.

Primary files:

- `mars2026/lib/supabase/client.ts`
- `mars2026/lib/supabase/server.ts`
- `mars2026/lib/supabase/proxy.ts`
- `mars2026/proxy.ts`
- `mars2026/lib/auth-redirect.ts`
- `mars2026/app/auth/` and the corresponding form components

## Client roles

| Client | Credential | Use |
| --- | --- | --- |
| Browser client | Supabase publishable key | Login, signup, logout, and password forms |
| Server client | Publishable key plus request cookies | Server Components and user-scoped route handlers |
| Admin client | Service-role key, no persisted session | Trusted checkout, webhook, and import operations |

The admin client must never be imported into a Client Component or exposed to
the browser.

## Session proxy

The root `proxy.ts` applies Supabase session refresh to all non-static paths.
The following prefixes are public: `/`, `/auth`, `/login`, `/shop`, `/gallery`,
`/archive`, `/about`, `/commissions`, `/contact`, and `/posters`. Every other
application path is redirected to `/auth/login` when claims are absent.

`/api/stripe/webhook` bypasses Supabase session work because Stripe authenticates
that request with a webhook signature. If the two public Supabase variables are
missing, the proxy currently skips all session checks to keep initial setup
reachable; data-backed pages can still fail without valid configuration.

## Return-path safety

When a protected request is redirected, its path and query are placed in the
`returnTo` parameter. `safeReturnTo` permits only same-origin destinations and
rejects protocol-relative, external, backslash-containing, non-string, and
malformed values. After password login, the client navigates to that sanitized
path.

## User flows

- **Login:** calls `signInWithPassword`, then pushes the safe return path and
  refreshes server-rendered session state.
- **Signup:** validates matching passwords, calls `signUp`, requests an email
  redirect to `/account/orders`, then shows `/auth/sign-up-success`.
- **Email confirmation:** `/auth/confirm` verifies `token_hash` and `type`, then
  redirects through the same safe-return helper.
- **Forgot password:** sends a recovery link targeting
  `/auth/update-password`.
- **Update password:** calls `updateUser` and replaces the route with
  `/account/orders`.
- **Logout:** calls `signOut`, returns to login, and refreshes the router.

Supabase must allow the deployed and local redirect URLs used by signup and
password recovery.

## Authorization beyond login

Login is not sufficient for administrator access. `/admin/orders` checks the
current user against `admin_users`, and the subsequent order read depends on RLS
to allow only administrators. Customer order reads similarly depend on RLS to
limit rows to `orders.user_id = auth.uid()`.
