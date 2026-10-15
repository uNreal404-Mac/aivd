-- Idempotent Stripe Checkout credit grants (one row per Checkout Session).
-- Apply once:
--   npx wrangler d1 execute dreamutopia-db --remote --file=migrations/005_stripe_sessions.sql

CREATE TABLE IF NOT EXISTS stripe_sessions (
  session_id TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL,
  pack TEXT NOT NULL,
  credits INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
