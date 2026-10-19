ALTER TABLE `videos` ADD `media_type` text DEFAULT 'video' NOT NULL;--> statement-breakpoint
ALTER TABLE `videos` ADD `parent_uuid` text;--> statement-breakpoint
CREATE INDEX `videos_user_media_type_idx` ON `videos` (`user_id`,`media_type`);--> statement-breakpoint
CREATE INDEX `videos_parent_uuid_idx` ON `videos` (`parent_uuid`);