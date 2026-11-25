CREATE TABLE "content_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"page_key" text NOT NULL,
	"section_key" text NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"draft_payload" jsonb,
	"published_payload" jsonb,
	"draft_revision" integer DEFAULT 0 NOT NULL,
	"published_revision" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "content_sections_draft_revision_nonnegative" CHECK ("content_sections"."draft_revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE "faq_items" (
	"id" text PRIMARY KEY NOT NULL,
	"locale" text DEFAULT 'ar' NOT NULL,
	"draft_question" text NOT NULL,
	"draft_answer" text NOT NULL,
	"draft_sort_order" integer NOT NULL,
	"draft_visible" boolean DEFAULT true NOT NULL,
	"published_question" text,
	"published_answer" text,
	"published_sort_order" integer,
	"published_visible" boolean,
	"draft_deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "faq_items_draft_sort_order_nonnegative" CHECK ("faq_items"."draft_sort_order" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "content_sections_page_section_locale_unique" ON "content_sections" USING btree ("page_key","section_key","locale");--> statement-breakpoint
CREATE INDEX "content_sections_page_locale_idx" ON "content_sections" USING btree ("page_key","locale");--> statement-breakpoint
CREATE INDEX "faq_items_locale_order_idx" ON "faq_items" USING btree ("locale","draft_sort_order");