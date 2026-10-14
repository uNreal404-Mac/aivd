-- One-off paid orders + Stripe event idempotency.
-- Apply once:
--   npx wrangler d1 execute dreamutopia-db --remote --file=migrations/005_orders.sql

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  payment_intent_id TEXT,
  input_media_key TEXT,
  preview_job_id TEXT,
  kie_task_id TEXT,
  model TEXT,
  cost_cents INTEGER,
  output_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  refund_id TEXT,
  refunded_at TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_kie_task ON orders(kie_task_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_output_key ON orders(output_key);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
