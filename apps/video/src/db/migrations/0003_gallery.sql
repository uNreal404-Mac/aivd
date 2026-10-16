-- ============================================
-- 0003_gallery
-- ============================================
--
-- manual, not yet applied
--
-- ⚠️ 必须手动执行（本仓库暂未接入 drizzle journal / meta）：
--
--     psql "$DATABASE_URL" -f src/db/migrations/0003_gallery.sql
--
-- 本文件是幂等的，重复执行不会报错，也不会破坏数据。
--
-- 步骤：
--   1. "videos" 增加 gallery 分享/下载相关列
--      （visibility / published_at / gallery_title / gallery_description /
--      public_prompt / prompt_protected / assets_reusable）。
--   2. "user" 增加 isSuperAccount 列。
--   3. 在 (visibility, published_at) 上创建索引。

ALTER TABLE "videos"
  ADD COLUMN IF NOT EXISTS "visibility" text DEFAULT 'private' NOT NULL,
  ADD COLUMN IF NOT EXISTS "published_at" timestamp,
  ADD COLUMN IF NOT EXISTS "gallery_title" text,
  ADD COLUMN IF NOT EXISTS "gallery_description" text,
  ADD COLUMN IF NOT EXISTS "public_prompt" text,
  ADD COLUMN IF NOT EXISTS "prompt_protected" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "assets_reusable" boolean DEFAULT false NOT NULL;

--> statement-breakpoint
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "isSuperAccount" boolean DEFAULT false NOT NULL;

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "videos_visibility_published_idx"
  ON "videos" ("visibility", "published_at");
