CREATE TABLE "join_intake_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "join_intake_rate_limits_count_nonnegative" CHECK ("join_intake_rate_limits"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "join_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"email" text,
	"business_activity" text,
	"plan_id" text,
	"plan_name_snapshot" text,
	"plan_price_minor_snapshot" integer,
	"plan_price_period_snapshot" text,
	"plan_currency_snapshot" text,
	"source" text DEFAULT 'direct' NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"submission_token" text NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "join_requests_status_valid" CHECK ("join_requests"."status" in ('new', 'contacted', 'closed')),
	CONSTRAINT "join_requests_source_valid" CHECK ("join_requests"."source" in ('direct', 'pricing', 'join')),
	CONSTRAINT "join_requests_revision_nonnegative" CHECK ("join_requests"."revision" >= 0),
	CONSTRAINT "join_requests_phone_length" CHECK (char_length("join_requests"."phone") between 8 and 20),
	CONSTRAINT "join_requests_plan_snapshot_valid" CHECK ("join_requests"."plan_id" is null or ("join_requests"."plan_name_snapshot" is not null and "join_requests"."plan_currency_snapshot" is not null)),
	CONSTRAINT "join_requests_price_period_valid" CHECK ("join_requests"."plan_price_period_snapshot" is null or "join_requests"."plan_price_period_snapshot" in ('monthly', 'yearly')),
	CONSTRAINT "join_requests_price_snapshot_nonnegative" CHECK ("join_requests"."plan_price_minor_snapshot" is null or "join_requests"."plan_price_minor_snapshot" >= 0),
	CONSTRAINT "join_requests_notes_length" CHECK ("join_requests"."notes" is null or char_length("join_requests"."notes") <= 4000)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"draft_name" text NOT NULL,
	"draft_description" text NOT NULL,
	"draft_features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"draft_monthly_price_minor" integer,
	"draft_yearly_price_minor" integer,
	"draft_currency" text NOT NULL,
	"draft_cta_label" text NOT NULL,
	"draft_featured" boolean DEFAULT false NOT NULL,
	"draft_display_order" integer DEFAULT 0 NOT NULL,
	"published_name" text,
	"published_description" text,
	"published_features" jsonb,
	"published_monthly_price_minor" integer,
	"published_yearly_price_minor" integer,
	"published_currency" text,
	"published_cta_label" text,
	"published_featured" boolean,
	"published_display_order" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"draft_revision" integer DEFAULT 0 NOT NULL,
	"published_revision" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "plans_status_valid" CHECK ("plans"."status" in ('draft', 'published', 'hidden')),
	CONSTRAINT "plans_draft_revision_nonnegative" CHECK ("plans"."draft_revision" >= 0),
	CONSTRAINT "plans_draft_monthly_price_nonnegative" CHECK ("plans"."draft_monthly_price_minor" is null or "plans"."draft_monthly_price_minor" >= 0),
	CONSTRAINT "plans_draft_yearly_price_nonnegative" CHECK ("plans"."draft_yearly_price_minor" is null or "plans"."draft_yearly_price_minor" >= 0),
	CONSTRAINT "plans_published_monthly_price_nonnegative" CHECK ("plans"."published_monthly_price_minor" is null or "plans"."published_monthly_price_minor" >= 0),
	CONSTRAINT "plans_published_yearly_price_nonnegative" CHECK ("plans"."published_yearly_price_minor" is null or "plans"."published_yearly_price_minor" >= 0),
	CONSTRAINT "plans_display_order_range" CHECK ("plans"."draft_display_order" between 0 and 9999 and ("plans"."published_display_order" is null or "plans"."published_display_order" between 0 and 9999)),
	CONSTRAINT "plans_draft_currency_format" CHECK ("plans"."draft_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "plans_published_currency_format" CHECK ("plans"."published_currency" is null or "plans"."published_currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "plans_published_complete" CHECK ("plans"."status" <> 'published' or (
        "plans"."published_name" is not null and
        "plans"."published_description" is not null and
        "plans"."published_features" is not null and
        "plans"."published_currency" is not null and
        "plans"."published_cta_label" is not null and
        "plans"."published_featured" is not null and
        "plans"."published_display_order" is not null and
        "plans"."published_revision" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "join_intake_rate_limits_window_idx" ON "join_intake_rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE UNIQUE INDEX "join_requests_submission_token_unique" ON "join_requests" USING btree ("submission_token");--> statement-breakpoint
CREATE INDEX "join_requests_created_at_idx" ON "join_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "join_requests_status_created_at_idx" ON "join_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "join_requests_plan_id_idx" ON "join_requests" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "plans_slug_unique" ON "plans" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "plans_public_order_idx" ON "plans" USING btree ("status","published_display_order");