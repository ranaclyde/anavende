CREATE TABLE "user_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"event" text NOT NULL,
	"reason" text,
	"actor_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "user_event_valid" CHECK ("user_status_history"."event" IN ('bloqueo', 'desbloqueo'))
);
--> statement-breakpoint
ALTER TABLE "user_status_history" ADD CONSTRAINT "user_status_history_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_status_history" ADD CONSTRAINT "user_status_history_actor_user_id_user_profiles_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_status_history_user_idx" ON "user_status_history" USING btree ("user_id","created_at" DESC NULLS LAST);