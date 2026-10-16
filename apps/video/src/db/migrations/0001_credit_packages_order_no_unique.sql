-- ============================================
-- 0001_credit_packages_order_no_unique
-- ============================================
--
-- ⚠️ 必须手动执行（本仓库暂未接入 drizzle journal / meta）：
--
--     psql "$DATABASE_URL" -f src/db/migrations/0001_credit_packages_order_no_unique.sql
--
-- 本文件是幂等的，重复执行不会报错，也不会破坏数据。
--
-- 步骤：
--   1. 去重：同一 order_no 存在多条非空记录时，仅保留最早的一条
--      （created_at 最小，其次 id 最小），其余重命名为
--      order_no || '_dup_' || id。
--   2. 在 order_no 上创建唯一索引（IF NOT EXISTS）。

WITH ranked AS (
  SELECT
    id,
    order_no,
    ROW_NUMBER() OVER (PARTITION BY order_no ORDER BY created_at, id) AS rn
  FROM "credit_packages"
  WHERE order_no IS NOT NULL
)
UPDATE "credit_packages" AS cp
SET order_no = cp.order_no || '_dup_' || cp.id
FROM ranked
WHERE cp.id = ranked.id
  AND ranked.rn > 1;

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_packages_order_no_unique" ON "credit_packages" ("order_no");
