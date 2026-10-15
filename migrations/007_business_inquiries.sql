-- B2B /business inquiry quotes. Apply once:
--   npx wrangler d1 execute dreamutopia-db --remote --file=migrations/007_business_inquiries.sql

CREATE TABLE IF NOT EXISTS business_inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  contact TEXT NOT NULL,
  industry TEXT,
  need_type TEXT,
  quantity TEXT,
  budget TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_business_inquiries_created ON business_inquiries(created_at DESC);
