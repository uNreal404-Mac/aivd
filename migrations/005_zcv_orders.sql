-- Private, recoverable order state for the one-off Zombie Couple Video product.
CREATE TABLE IF NOT EXISTS zcv_assets (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('user', 'guest')),
  user_id INTEGER,
  guest_id TEXT,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('input', 'preview', 'video_input', 'video')),
  content_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((owner_kind = 'user' AND user_id IS NOT NULL AND guest_id IS NULL) OR
         (owner_kind = 'guest' AND user_id IS NULL AND guest_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_zcv_assets_owner ON zcv_assets(owner_kind, user_id, guest_id);

CREATE TABLE IF NOT EXISTS zcv_previews (
  id TEXT PRIMARY KEY,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('user', 'guest')),
  user_id INTEGER,
  guest_id TEXT,
  input_asset_id TEXT NOT NULL,
  full_asset_id TEXT,
  preview_asset_id TEXT,
  task_id TEXT UNIQUE,
  callback_token TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'nano-banana-2',
  model_version TEXT NOT NULL DEFAULT 'nano-banana-2',
  model_cost_usd REAL NOT NULL DEFAULT 0,
  model_cost_cents INTEGER NOT NULL DEFAULT 0,
  model_provider_credits REAL,
  status TEXT NOT NULL DEFAULT 'starting',
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK ((owner_kind = 'user' AND user_id IS NOT NULL AND guest_id IS NULL) OR
         (owner_kind = 'guest' AND user_id IS NULL AND guest_id IS NOT NULL)),
  FOREIGN KEY (input_asset_id) REFERENCES zcv_assets(id),
  FOREIGN KEY (full_asset_id) REFERENCES zcv_assets(id),
  FOREIGN KEY (preview_asset_id) REFERENCES zcv_assets(id)
);
CREATE INDEX IF NOT EXISTS idx_zcv_previews_owner ON zcv_previews(owner_kind, user_id, guest_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_zcv_previews_active_input ON zcv_previews(input_asset_id)
  WHERE status IN ('starting','processing','needs_check','ready');

CREATE TABLE IF NOT EXISTS zcv_rate_limits (
  quota_key TEXT PRIMARY KEY,
  usage_count INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS zcv_orders (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  preview_id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  amount_total INTEGER NOT NULL,
  currency TEXT NOT NULL,
  checkout_session_id TEXT UNIQUE,
  checkout_url TEXT,
  payment_intent_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  status TEXT NOT NULL DEFAULT 'checkout_pending',
  video_input_asset_id TEXT,
  video_task_id TEXT UNIQUE,
  video_model TEXT NOT NULL DEFAULT 'kling-2.6/image-to-video',
  video_model_version TEXT NOT NULL DEFAULT 'kling-2.6',
  video_cost_usd REAL NOT NULL DEFAULT 0,
  video_cost_cents INTEGER NOT NULL DEFAULT 0,
  video_provider_credits REAL NOT NULL DEFAULT 0,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  output_asset_id TEXT,
  generation_attempts INTEGER NOT NULL DEFAULT 0,
  refund_id TEXT,
  refund_status TEXT,
  last_error TEXT,
  callback_token TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (preview_id) REFERENCES zcv_previews(id),
  FOREIGN KEY (video_input_asset_id) REFERENCES zcv_assets(id),
  FOREIGN KEY (output_asset_id) REFERENCES zcv_assets(id)
);
CREATE INDEX IF NOT EXISTS idx_zcv_orders_owner ON zcv_orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zcv_orders_status ON zcv_orders(status, updated_at);

-- Preserve every paid KIE attempt, including retries and ambiguous createTask outcomes.
CREATE TABLE IF NOT EXISTS zcv_task_attempts (
  order_id TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  task_id TEXT UNIQUE,
  model TEXT NOT NULL,
  model_version TEXT NOT NULL,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  provider_credits_consumed REAL,
  status TEXT NOT NULL DEFAULT 'starting',
  last_error TEXT,
  output_asset_id TEXT,
  video_width INTEGER,
  video_height INTEGER,
  video_duration_sec REAL,
  video_has_audio INTEGER,
  moderation_model TEXT NOT NULL DEFAULT 'gemini-4-argon-openai',
  moderation_model_version TEXT NOT NULL DEFAULT 'gemini-4-argon',
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  moderation_call_count INTEGER NOT NULL DEFAULT 0,
  moderation_estimated_cost_usd REAL NOT NULL DEFAULT 0.01,
  moderation_estimated_cost_cents INTEGER NOT NULL DEFAULT 1,
  moderation_provider_credits REAL,
  moderation_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (order_id, attempt),
  FOREIGN KEY (order_id) REFERENCES zcv_orders(id),
  FOREIGN KEY (output_asset_id) REFERENCES zcv_assets(id)
);
CREATE INDEX IF NOT EXISTS idx_zcv_task_attempts_task ON zcv_task_attempts(task_id);

CREATE TABLE IF NOT EXISTS zcv_stripe_events (
  event_id TEXT PRIMARY KEY,
  checkout_session_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (order_id) REFERENCES zcv_orders(id)
);
