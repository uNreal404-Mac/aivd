CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`idToken` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_provider_account_id_idx` ON `account` (`providerId`,`accountId`);--> statement-breakpoint
CREATE TABLE `credit_holds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`video_uuid` text NOT NULL,
	`credits` integer NOT NULL,
	`status` text DEFAULT 'HOLDING' NOT NULL,
	`package_allocation` text NOT NULL,
	`package_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`settled_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_holds_video_uuid_unique` ON `credit_holds` (`video_uuid`);--> statement-breakpoint
CREATE INDEX `credit_holds_user_id_idx` ON `credit_holds` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_holds_status_idx` ON `credit_holds` (`status`);--> statement-breakpoint
CREATE INDEX `credit_holds_package_id_idx` ON `credit_holds` (`package_id`);--> statement-breakpoint
CREATE TABLE `credit_packages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`initial_credits` integer NOT NULL,
	`remaining_credits` integer NOT NULL,
	`frozen_credits` integer DEFAULT 0 NOT NULL,
	`trans_type` text NOT NULL,
	`order_no` text,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`expired_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	CONSTRAINT "credit_packages_remaining_nonnegative" CHECK("credit_packages"."remaining_credits" >= 0),
	CONSTRAINT "credit_packages_frozen_nonnegative" CHECK("credit_packages"."frozen_credits" >= 0)
);
--> statement-breakpoint
CREATE INDEX `credit_packages_user_id_status_idx` ON `credit_packages` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `credit_packages_user_id_expired_at_idx` ON `credit_packages` (`user_id`,`expired_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_packages_order_no_unique` ON `credit_packages` (`order_no`);--> statement-breakpoint
CREATE TABLE `credit_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`trans_no` text NOT NULL,
	`user_id` text NOT NULL,
	`trans_type` text NOT NULL,
	`credits` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`package_id` integer,
	`video_uuid` text,
	`order_no` text,
	`hold_id` integer,
	`remark` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_transactions_trans_no_unique` ON `credit_transactions` (`trans_no`);--> statement-breakpoint
CREATE INDEX `credit_transactions_user_id_idx` ON `credit_transactions` (`user_id`);--> statement-breakpoint
CREATE INDEX `credit_transactions_trans_type_idx` ON `credit_transactions` (`trans_type`);--> statement-breakpoint
CREATE INDEX `credit_transactions_created_at_idx` ON `credit_transactions` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_transactions_order_no_unique` ON `credit_transactions` (`order_no`);--> statement-breakpoint
CREATE UNIQUE INDEX `credit_transactions_hold_id_unique` ON `credit_transactions` (`hold_id`);--> statement-breakpoint
CREATE TABLE `creem_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`product_id` text NOT NULL,
	`subscription_id` text NOT NULL,
	`status` text NOT NULL,
	`current_period_end` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `creem_subscriptions_subscription_id_unique` ON `creem_subscriptions` (`subscription_id`);--> statement-breakpoint
CREATE INDEX `creem_subscriptions_user_id_idx` ON `creem_subscriptions` (`user_id`);--> statement-breakpoint
CREATE TABLE `Customer` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`authUserId` text NOT NULL,
	`name` text,
	`plan` text,
	`stripeCustomerId` text,
	`stripeSubscriptionId` text,
	`stripePriceId` text,
	`stripeCurrentPeriodEnd` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `Customer_stripeCustomerId_unique` ON `Customer` (`stripeCustomerId`);--> statement-breakpoint
CREATE UNIQUE INDEX `Customer_stripeSubscriptionId_unique` ON `Customer` (`stripeSubscriptionId`);--> statement-breakpoint
CREATE INDEX `Customer_authUserId_idx` ON `Customer` (`authUserId`);--> statement-breakpoint
CREATE TABLE `K8sClusterConfig` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`location` text NOT NULL,
	`authUserId` text NOT NULL,
	`plan` text DEFAULT 'FREE',
	`network` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`status` text DEFAULT 'PENDING',
	`delete` integer DEFAULT false
);
--> statement-breakpoint
CREATE INDEX `K8sClusterConfig_authUserId_idx` ON `K8sClusterConfig` (`authUserId`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`token` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`isAdmin` integer DEFAULT false NOT NULL,
	`isSuperAccount` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`uuid` text NOT NULL,
	`user_id` text NOT NULL,
	`prompt` text NOT NULL,
	`model` text NOT NULL,
	`parameters` text,
	`idempotency_key` text,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`provider` text,
	`external_task_id` text,
	`error_message` text,
	`start_image_url` text,
	`original_video_url` text,
	`video_url` text,
	`thumbnail_url` text,
	`duration` integer,
	`resolution` text,
	`aspect_ratio` text,
	`file_size` integer,
	`credits_used` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`completed_at` integer,
	`generation_time` integer,
	`is_deleted` integer DEFAULT false NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`published_at` integer,
	`gallery_title` text,
	`gallery_description` text,
	`public_prompt` text,
	`prompt_protected` integer DEFAULT false NOT NULL,
	`assets_reusable` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_uuid_unique` ON `videos` (`uuid`);--> statement-breakpoint
CREATE INDEX `videos_user_id_idx` ON `videos` (`user_id`);--> statement-breakpoint
CREATE INDEX `videos_status_idx` ON `videos` (`status`);--> statement-breakpoint
CREATE INDEX `videos_created_at_idx` ON `videos` (`created_at`);--> statement-breakpoint
CREATE INDEX `videos_visibility_published_idx` ON `videos` (`visibility`,`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `videos_user_id_idempotency_key_unique` ON `videos` (`user_id`,`idempotency_key`);