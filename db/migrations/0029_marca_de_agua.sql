-- Marca de agua en las fotos de productos — F2.16, RF-39, 2026-11-11.
--
-- Solo agrega. Tres tablas nuevas y una columna con DEFAULT false: las fotos
-- que ya están quedan marcadas como subidas sin marca, que es lo que son. Sin
-- fila en watermark_settings la marca está apagada, así que desplegar esto
-- no cambia ninguna subida hasta que se prenda desde el panel (TS §9.6).
CREATE TABLE "watermark_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "watermark_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "watermark_layers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"anchor" text DEFAULT 'abajo-derecha' NOT NULL,
	"size_pct" integer DEFAULT 20 NOT NULL,
	"margin_pct" integer DEFAULT 3 NOT NULL,
	"opacity_pct" integer DEFAULT 50 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "watermark_layers_mode" CHECK ("watermark_layers"."mode" IN ('posicion', 'cubrir', 'estirar', 'mosaico')),
	CONSTRAINT "watermark_layers_anchor" CHECK ("watermark_layers"."anchor" IN ('arriba-izquierda', 'arriba', 'arriba-derecha', 'izquierda', 'centro', 'derecha', 'abajo-izquierda', 'abajo', 'abajo-derecha')),
	CONSTRAINT "watermark_layers_size" CHECK ("watermark_layers"."size_pct" BETWEEN 5 AND 100),
	CONSTRAINT "watermark_layers_margin" CHECK ("watermark_layers"."margin_pct" BETWEEN 0 AND 20),
	CONSTRAINT "watermark_layers_opacity" CHECK ("watermark_layers"."opacity_pct" BETWEEN 5 AND 100)
);
--> statement-breakpoint
ALTER TABLE "watermark_layers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "watermark_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watermark_settings_singleton" CHECK ("watermark_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "watermark_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variant_images" ADD COLUMN "has_watermark" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "watermark_layers" ADD CONSTRAINT "watermark_layers_image_id_watermark_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."watermark_images"("id") ON DELETE cascade ON UPDATE no action;