-- ============================================
-- 0002_referrals
-- ============================================
--
-- ⚠️ 必须手动执行（本仓库暂未接入 drizzle journal / meta）：
--
--     psql "$DATABASE_URL" -f src/db/migrations/0002_referrals.sql
--
-- 本文件是幂等的，重复执行不会报错，也不会破坏数据。
-- 它 **不会** 被应用启动 / 构建 / 测试自动执行。
--
-- 内容：
--   1. referral_codes —— 每个用户一个邀请码（8 位大写字母数字，去掉易混淆字符）。
--   2. referrals      —— 邀请关系，invitee_user_id / invitee_email_norm 唯一，
--                        状态默认 PENDING，发放后写入 rewarded_at。
--   3. referrals (inviter_user_id) 索引，用于"我邀请了谁"的列表查询。

CREATE TABLE IF NOT EXISTS "referral_codes" (
  "user_id" text PRIMARY KEY,
  "code" text NOT NULL UNIQUE,
  "created_at" timestamp DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "referrals" (
  "id" serial PRIMARY KEY,
  "inviter_user_id" text NOT NULL,
  "invitee_user_id" text NOT NULL UNIQUE,
  "invitee_email_norm" text NOT NULL UNIQUE,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "rewarded_at" timestamp
);

--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "referrals_inviter_user_id_idx" ON "referrals" ("inviter_user_id");
