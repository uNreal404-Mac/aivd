# Credits

User-scoped credit system for paid actions (currently: image generation). Credits are granted by registration gift, redemption codes, or one-time package purchases. Subscription-based credit grants are scaffolded in the codebase (transaction type `SUBSCRIPTION_RENEWAL`, helper `processSubscriptionRenewal`) but **the project ships credit-package only** — there is no subscription credit UI.

Consumption uses **FIFO** with optimistic locking on the balance row to prevent double-spend. Failed actions automatically refund.

> See [Image Generation](./image-generation.md) for the consumer side and [Payment](./payment.md) for the upstream Stripe / Creem provider abstraction.

---

## Directory structure

```
src/
├── credits/
│   ├── credits.ts            # Core: ensureUserCredit, addCredits, consumeCredits,
│   │                         #       refundCredits, getUserCredits, processSubscriptionRenewal
│   ├── packages.ts           # getAllCreditPackages / getCreditPackageById (reads websiteConfig)
│   ├── redemption.ts         # createRedemptionCode, redeemCode, getRedemptionCode, disableRedemptionCode
│   └── types.ts              # CreditTransactionType, CreditValidity, TRANSACTION_VALIDITY_MAP
├── api/credits.ts            # getCreditBalance, getCreditBalanceSummary, redeemCreditCode
├── api/payment.ts            # createCreditCheckoutSession (calls @/payment.createCreditCheckout)
├── auth/auth.ts              # onCreateUser → addCredits(REGISTER_GIFT)
├── payment/
│   ├── types.ts              # CreditPackage, CreateCreditCheckoutParams, PaymentScene='credit'
│   ├── index.ts              # createCreditCheckout (provider-agnostic entrypoint)
│   └── provider/stripe.ts    # createCreditCheckout + processCreditPackagePurchase webhook handler
├── hooks/use-credits.ts      # useCredits (balance + transactions)
├── components/
│   ├── shared/credit-badge.tsx                          # Header badge
│   ├── settings/credits/credit-checkout-button.tsx      # Stripe checkout redirect
│   ├── settings/credits/credit-packages.tsx             # Package grid (settings)
│   └── pricing/public-credit-packages.tsx               # Package grid (marketing /pricing)
├── routes/settings/credits.tsx                          # /settings/credits page
└── db/app.schema.ts          # user_credit, credit_transaction, redemption_code, redemption_record
```

---

## Data model

Four tables in `src/db/app.schema.ts`:

### `user_credit`

One row per user. Holds the **current balance** and is updated atomically on add / consume / refund / expire. Created on demand by `ensureUserCredit`.

| column | type | notes |
|---|---|---|
| `id` | text PK | nanoid |
| `user_id` | text → `user.id` (cascade) | unique 1-1 with user |
| `current_credits` | integer | denormalized balance, updated atomically |
| `created_at` / `updated_at` | timestamp | |

### `credit_transaction`

Append-only audit log. Every grant, consumption, refund, and expiry is a row.

| column | notes |
|---|---|
| `id` | nanoid PK |
| `user_id` | FK → `user.id` |
| `type` | `CreditTransactionType` (see below) |
| `amount` | signed: positive for grants, negative for consumption / expiry |
| `remaining_amount` | for **grant** rows only — drives FIFO consumption (decremented as the batch is spent) |
| `expiration_date` | nullable; null means never expires |
| `payment_id` | for `PURCHASE_PACKAGE` — Stripe invoice id |
| `related_transaction_id` | for `REFUND` (points to the refunded `USAGE`) and `EXPIRE` (points to the expired grant) |
| `description` | human-readable, surfaced in the transaction history table |
| `created_at` | timestamp |

### `redemption_code` / `redemption_record`

Codes (`code`, `credits_amount`, `max_redemptions`, `per_user_limit`, `expires_at`, `credit_expires_at`, `bound_user_id`, `disabled`, ...) and an audit row per successful redemption (`code_id`, `user_id`, `credits_granted`, `credit_transaction_id`).

---

## Transaction types (`src/credits/types.ts`)

| type | sign | source | validity |
|---|---|---|---|
| `REGISTER_GIFT` | + | `auth.ts > onCreateUser` | permanent (or `expireDays` from config) |
| `SUBSCRIPTION_RENEWAL` | + | `processSubscriptionRenewal` *(scaffolded; not wired to a webhook in this project)* | billing-cycle |
| `PURCHASE_PACKAGE` | + | Stripe webhook `processCreditPackagePurchase` | `expireDays` from package config; default permanent |
| `REDEMPTION_CODE` | + | `redeemCode` | optional `creditExpiresAt` from the code |
| `REFUND` | + | `refundCredits` | permanent |
| `USAGE` | − | `consumeCredits` | n/a |
| `EXPIRE` | − | `processSubscriptionRenewal` (sweeps old billing-cycle grants) | n/a |

`TRANSACTION_VALIDITY_MAP` formalises the BILLING_CYCLE vs PERMANENT split. Today only `SUBSCRIPTION_RENEWAL` is BILLING_CYCLE; everything else is PERMANENT.

---

## Lifecycle

### Registration

```
auth.ts > onCreateUser(user)
   └─ addCredits({
         userId: user.id,
         amount:   websiteConfig.credits.registerGiftCredits.amount  ?? 10,
         expirationDate: registerGiftCredits.expireDays
                       ? now + expireDays * 24h
                       : undefined,
         type: REGISTER_GIFT,
      })
```

Fully gated by `websiteConfig.credits.registerGiftCredits.enable !== false`. Failures are logged but do **not** block account creation.

### Package purchase (Stripe)

1. Client renders `<CreditPackages />` (settings) or `<PublicCreditPackages />` (marketing). Each package card calls `createCreditCheckoutSession` (`src/api/payment.ts`).
2. Server validates the package + `priceId` (`getCreditPackageById`), looks up the user email, and calls `createCreditCheckout` from `@/payment` which dispatches to the active provider.
3. Stripe provider (`src/payment/provider/stripe.ts > createCreditCheckout`) creates a `mode: 'payment'` session with `metadata = { userId, packageId, credits, scene: 'credit' }` and a `client_reference_id = packageId`. **The credits amount is stamped at session-creation time** so fulfilment can never trust a later config edit.
4. After payment, the `invoice.paid` webhook handler routes to `processCreditPackagePurchase`:
   - Reads `packageId` and `credits` from session metadata (rejects if either is missing or malformed).
   - Reads `expireDays` from the current package config (best-effort — package may have been removed since purchase, in which case credits default to permanent).
   - Calls `addCredits({ type: PURCHASE_PACKAGE, paymentId: invoice.id, ... })`.

The `PaymentScene` enum has been extended with `'credit'` so the existing `payment` row can store credit purchases alongside subscription / lifetime ones.

### Package purchase (Creem)

Not implemented. `CreemProvider.createCreditCheckout` throws explicitly. The Stripe path is the only credit-purchase route in this project; the stub keeps the `PaymentProvider` interface satisfied so subscription flows on Creem stay type-safe.

### Redemption codes

`redeemCode(userId, codeInput)` enforces: code exists → not disabled → not past `expiresAt` → user matches `bound_user_id` (if set) → global `max_redemptions` not reached → per-user count below `per_user_limit`. Then increments `redemptions_count` with optimistic locking, calls `addCredits({ type: REDEMPTION_CODE, expirationDate: code.creditExpiresAt })`, and writes a `redemption_record` audit row. Errors are returned as `{ success: false, error, reason }` (not thrown).

`createRedemptionCode` is the admin-issuing helper; `disableRedemptionCode` soft-deletes a code so further redemptions are rejected with `code_disabled`.

### Consumption — FIFO with optimistic locking

`consumeCredits({ userId, amount, description })`:

1. **Atomic balance check + decrement** —
   ```sql
   UPDATE user_credit
      SET current_credits = current_credits - ?,
          updated_at      = ?
    WHERE user_id = ? AND current_credits >= ?
   ```
   If `meta.changes === 0`, return `{ success: false, error: 'Insufficient credits' }`. This single SQLite statement is the concurrency boundary — even under concurrent requests, only one can win when the balance straddles the threshold.
2. **Walk grants oldest-first** (`createdAt asc`), filtered to non-expired rows with `remaining_amount > 0`. Decrement `remaining_amount` on each grant until `amount` is consumed. Older billing-cycle credits are naturally consumed first because they were inserted earlier than permanent ones in `processSubscriptionRenewal`.
3. **Append a USAGE row** with `amount = -amount` and return `{ success: true, usageTransactionId }`.

The image-generation path (`src/api/generate.ts`) wraps this with refund-on-failure:

```ts
const consumeResult = await consumeCredits({ userId, amount: cost, ... });
if (!consumeResult.success) {
  throw new Error(`${INSUFFICIENT_CREDITS_ERROR}: ${consumeResult.error}`);
}
try {
  // ...generate + upload...
} catch (err) {
  await refundCredits(userId, consumeResult.usageTransactionId, /* reason */);
  throw err;
}
```

`INSUFFICIENT_CREDITS_ERROR` is a sentinel string the client matches on to redirect to `/settings/credits` instead of surfacing a generic error.

### Refund

`refundCredits(userId, usageTransactionId, reason)` — looks up the original `USAGE` transaction (must have `amount < 0`), inserts a matching `REFUND` row with `relatedTransactionId = usageTransactionId`, and adds the absolute amount back to `user_credit.current_credits`.

The async workflow (`src/workflows/image-generation.ts`) implements the equivalent in raw SQL inside its `refund-credits` step (the workflow can't import the Drizzle helpers cleanly), and additionally flips `generation_history.status = 'failed'`.

### Subscription renewal *(scaffolded, not wired)*

`processSubscriptionRenewal(userId, periodEnd, creditsAmount)` exists for completeness:

1. Find prior `SUBSCRIPTION_RENEWAL` grants whose `expirationDate < now` and whose `relatedTransactionId is null`.
2. For each one with `remainingAmount > 0`, insert an `EXPIRE` transaction and decrement the balance.
3. `addCredits({ type: SUBSCRIPTION_RENEWAL, expirationDate: periodEnd })`.

There is currently no webhook calling this — the Stripe provider's `invoice.paid` handler only fans out to `processCreditPackagePurchase` and the existing subscription-payment processor. Wire it in if you re-enable subscription credits.

---

## Server API (Server Functions)

| function | path | auth | purpose |
|---|---|---|---|
| `getCreditBalance` | `src/api/credits.ts` | required | full balance + transaction history |
| `getCreditBalanceSummary` | `src/api/credits.ts` | required | `{ total, expiringCredits, permanentCredits }` for header badges |
| `redeemCreditCode` | `src/api/credits.ts` | required | redeem a code |
| `createCreditCheckoutSession` | `src/api/payment.ts` | required | Stripe / Creem checkout for a package |

The first three call `auth.api.getSession({ headers })` directly; `createCreditCheckoutSession` uses `authApiMiddleware`.

---

## UI surfaces

- **`/settings/credits`** — balance summary (Total / Billing-cycle / Permanent), package grid (`<CreditPackages />`), redemption code form, transaction history table.
- **`/pricing`** — public package grid (`<PublicCreditPackages />`); routes logged-out users to `/auth/login`.
- **Header badge** — `<CreditBadge />` on dashboard pages and the explicit `<CreditsBadge />` in the `/generate` header (clicking either jumps to `/settings/credits`).
- **Generate page** — pre-flight balance check + segmented quality / model badges showing the live cost.

All UI is gated by `websiteConfig.credits?.enable`; when disabled the components return `null` and the credit badge / settings page disappear.

---

## Configuration (`src/config/website.ts`)

```ts
credits: {
  enable: true,
  registerGiftCredits: {
    enable: true,
    amount: 10,
    expireDays: undefined, // permanent
  },
  packages: {
    starter: {
      id: 'starter',
      amount: 100,
      price: { priceId: 'price_xxx', amount: 990, currency: 'USD' },
      tier: 'starter',
      // expireDays?: 365  // omit for permanent credits
      // popular?: true
      // ...
    },
    // pro, ultimate, ...
  },
}
```

Each package's `price.priceId` must exist in the configured Stripe account. Free-tier placeholder cards (with `isFreeTier: true`) render without a checkout button — useful for advertising the registration gift on the package grid.

---

## Common tasks

| Task | Where |
|---|---|
| Change registration gift amount | `websiteConfig.credits.registerGiftCredits.amount` |
| Add / edit a package | `websiteConfig.credits.packages` (and create the matching Stripe price) |
| Issue a redemption code | call `createRedemptionCode` from an admin route or script |
| Hook credit consumption into a new feature | `import { consumeCredits, refundCredits } from '@/credits/credits'` and follow the pattern in `api/generate.ts` |
| Change FIFO behaviour | `consumeCredits` in `src/credits/credits.ts` (atomic UPDATE + grant walk) |
| Wire subscription credits | call `processSubscriptionRenewal` from the Stripe `invoice.paid` handler in `src/payment/provider/stripe.ts` |
