ALTER TABLE "join_requests" ADD COLUMN "offer_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "draft_promotion" jsonb;--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "published_promotion" jsonb;--> statement-breakpoint
ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_offer_snapshot_object" CHECK ("join_requests"."offer_snapshot" is null or jsonb_typeof("join_requests"."offer_snapshot") = 'object');--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_draft_promotion_object" CHECK ("plans"."draft_promotion" is null or jsonb_typeof("plans"."draft_promotion") = 'object');--> statement-breakpoint
ALTER TABLE "plans" ADD CONSTRAINT "plans_published_promotion_object" CHECK ("plans"."published_promotion" is null or jsonb_typeof("plans"."published_promotion") = 'object');