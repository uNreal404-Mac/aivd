CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`storage_key` text NOT NULL,
	`name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_assets_storage_key_unique` ON `media_assets` (`storage_key`);--> statement-breakpoint
CREATE INDEX `media_assets_user_created_idx` ON `media_assets` (`user_id`,`created_at`);