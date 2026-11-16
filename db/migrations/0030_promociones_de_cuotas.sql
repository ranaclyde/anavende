-- Promociones de cuotas por medio de pago — F2.17, RF-40, 2026-11-16.
--
-- Solo agrega una tabla. Informativa como payment_methods (RN-01): ninguna
-- orden la nombra, y borrar el medio de pago se lleva sus promociones. Queda
-- cerrada a anon y authenticated por los privilegios por defecto de 0025.
CREATE TABLE "payment_promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_method_id" uuid NOT NULL,
	"plan_name" text,
	"installments" integer NOT NULL,
	"surcharge_pct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date,
	"min_amount" numeric(12, 2),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_promotions_installments" CHECK ("payment_promotions"."installments" BETWEEN 2 AND 48),
	CONSTRAINT "payment_promotions_surcharge" CHECK ("payment_promotions"."surcharge_pct" >= 0 AND "payment_promotions"."surcharge_pct" <= 200),
	CONSTRAINT "payment_promotions_dates" CHECK ("payment_promotions"."ends_on" IS NULL OR "payment_promotions"."ends_on" >= "payment_promotions"."starts_on"),
	CONSTRAINT "payment_promotions_plan_name" CHECK ("payment_promotions"."plan_name" IS NULL OR char_length("payment_promotions"."plan_name") BETWEEN 1 AND 40),
	CONSTRAINT "payment_promotions_min_amount" CHECK ("payment_promotions"."min_amount" IS NULL OR "payment_promotions"."min_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payment_promotions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_promotions" ADD CONSTRAINT "payment_promotions_payment_method_id_payment_methods_id_fk" FOREIGN KEY ("payment_method_id") REFERENCES "public"."payment_methods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_promotions_method_idx" ON "payment_promotions" USING btree ("payment_method_id");