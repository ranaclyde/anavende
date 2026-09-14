ALTER TABLE "user_profiles" ADD COLUMN "closure_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "closure_reason" text;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "closure_has_reason" CHECK ("user_profiles"."closure_requested_at" IS NULL OR "user_profiles"."closure_reason" IS NOT NULL);