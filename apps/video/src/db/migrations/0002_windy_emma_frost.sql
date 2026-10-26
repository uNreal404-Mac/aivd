CREATE TABLE `admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`target_user_id` text,
	`details` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `admin_audit_log_actor_idx` ON `admin_audit_log` (`actor`);--> statement-breakpoint
CREATE INDEX `admin_audit_log_target_user_id_idx` ON `admin_audit_log` (`target_user_id`);--> statement-breakpoint
CREATE INDEX `admin_audit_log_created_at_idx` ON `admin_audit_log` (`created_at`);--> statement-breakpoint
ALTER TABLE `user` ADD `isBanned` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `banReason` text;--> statement-breakpoint
ALTER TABLE `user` ADD `bannedAt` integer;