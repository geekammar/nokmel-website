CREATE TABLE "site_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"contact_email" text,
	"contact_phone" text,
	"contact_telegram_url" text,
	"contact_whatsapp_url" text,
	"social_instagram_url" text,
	"social_facebook_url" text,
	"social_x_url" text,
	"notifications_enabled" boolean DEFAULT false NOT NULL,
	"telegram_chat_id" text,
	"telegram_bot_username" text,
	"telegram_bot_name" text,
	"analytics_enabled" boolean DEFAULT false NOT NULL,
	"public_revision" integer DEFAULT 0 NOT NULL,
	"notification_revision" integer DEFAULT 0 NOT NULL,
	"analytics_revision" integer DEFAULT 0 NOT NULL,
	"last_notification_test_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_settings_single_row" CHECK ("site_settings"."id" = 'default'),
	CONSTRAINT "site_settings_contact_email_length" CHECK ("site_settings"."contact_email" is null or char_length("site_settings"."contact_email") between 3 and 254),
	CONSTRAINT "site_settings_contact_phone_length" CHECK ("site_settings"."contact_phone" is null or char_length("site_settings"."contact_phone") between 8 and 20),
	CONSTRAINT "site_settings_public_revision_nonnegative" CHECK ("site_settings"."public_revision" >= 0),
	CONSTRAINT "site_settings_notification_revision_nonnegative" CHECK ("site_settings"."notification_revision" >= 0),
	CONSTRAINT "site_settings_analytics_revision_nonnegative" CHECK ("site_settings"."analytics_revision" >= 0),
	CONSTRAINT "site_settings_telegram_chat_id_format" CHECK ("site_settings"."telegram_chat_id" is null or "site_settings"."telegram_chat_id" ~ '^[0-9]{1,20}$'),
	CONSTRAINT "site_settings_telegram_bot_identity_length" CHECK (("site_settings"."telegram_bot_username" is null or char_length("site_settings"."telegram_bot_username") <= 64) and ("site_settings"."telegram_bot_name" is null or char_length("site_settings"."telegram_bot_name") <= 128)),
	CONSTRAINT "site_settings_public_url_length" CHECK (("site_settings"."contact_telegram_url" is null or char_length("site_settings"."contact_telegram_url") <= 500) and ("site_settings"."contact_whatsapp_url" is null or char_length("site_settings"."contact_whatsapp_url") <= 500) and ("site_settings"."social_instagram_url" is null or char_length("site_settings"."social_instagram_url") <= 500) and ("site_settings"."social_facebook_url" is null or char_length("site_settings"."social_facebook_url") <= 500) and ("site_settings"."social_x_url" is null or char_length("site_settings"."social_x_url") <= 500))
);
--> statement-breakpoint
ALTER TABLE "join_requests" ADD COLUMN "notification_state" text;--> statement-breakpoint
ALTER TABLE "join_requests" ADD COLUMN "notification_attempted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "join_requests" ADD COLUMN "notification_delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "join_requests" ADD COLUMN "notification_error_code" text;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_notification_state_valid" CHECK ("join_requests"."notification_state" is null or "join_requests"."notification_state" in ('skipped', 'pending', 'sending', 'sent', 'failed', 'uncertain'));--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_notification_error_length" CHECK ("join_requests"."notification_error_code" is null or char_length("join_requests"."notification_error_code") <= 40);