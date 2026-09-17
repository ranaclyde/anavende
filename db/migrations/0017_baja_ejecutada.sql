ALTER TABLE "user_status_history" DROP CONSTRAINT "user_event_valid";--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD COLUMN "closed_by" uuid;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_closed_by_user_profiles_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "closed_was_requested" CHECK ("user_profiles"."closed_at" IS NULL OR "user_profiles"."closure_requested_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "user_status_history" ADD CONSTRAINT "user_event_valid" CHECK ("user_status_history"."event" IN ('bloqueo', 'desbloqueo', 'baja', 'reversion_de_baja'));