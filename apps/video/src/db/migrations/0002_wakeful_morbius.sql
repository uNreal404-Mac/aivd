CREATE TABLE `video_ratings` (
	`video_uuid` text NOT NULL,
	`user_id` text NOT NULL,
	`score` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_ratings_video_user_unique` ON `video_ratings` (`video_uuid`,`user_id`);--> statement-breakpoint
CREATE INDEX `video_ratings_video_uuid_idx` ON `video_ratings` (`video_uuid`);