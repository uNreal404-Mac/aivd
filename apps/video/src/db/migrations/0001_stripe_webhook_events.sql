CREATE TABLE `stripe_webhook_events` (
	`event_id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`livemode` integer DEFAULT false NOT NULL,
	`result` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `stripe_webhook_events_type_idx` ON `stripe_webhook_events` (`type`);