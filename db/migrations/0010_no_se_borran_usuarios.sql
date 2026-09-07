ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_user_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE restrict ON UPDATE no action;