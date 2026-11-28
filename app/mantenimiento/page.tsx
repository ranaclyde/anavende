import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoHorizontal } from "@/components/shop/logo";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { NO_INDEX } from "@/lib/seo";
import { whatsappLink } from "@/lib/whatsapp";
import { estaEnMantenimiento } from "@/modules/settings/mantenimiento";
import { numeroDeWhatsApp } from "@/modules/settings/queries";

/**
 * El proxy reescribe acá cualquier ruta de la tienda
 * (`lib/supabase/proxy.ts`): por eso no hay «volver al inicio», que también
 * está cerrado.
 *
 * Pregunta con `estaEnMantenimiento()`, la memoria del proxy, y no con la
 * base: si discreparan al reabrir, el proxy y esta página se mandarían uno al
 * otro en bucle.
 */
export const metadata: Metadata = {
  title: "Volvemos en un rato",
  // Por si alguien llega a la dirección directa, que responde 200 y no 503.
  robots: NO_INDEX,
};

// Sin esto `next build` la prerrenderiza y consulta la base al compilar, donde
// no la hay (§18.2). En `next dev` no se ve.
export const dynamic = "force-dynamic";

export default async function Mantenimiento() {
  const [cerrada, numero] = await Promise.all([
    estaEnMantenimiento(),
    // Es la página de cuando algo no anda: no puede caerse con un 500 porque
    // la base tardó. Sin número, sale sin el botón.
    numeroDeWhatsApp().catch((error: unknown) => {
      console.error(
        "[mantenimiento] No se pudo leer el número de WhatsApp.",
        error,
      );
      return null;
    }),
  ]);

  if (!cerrada) redirect("/");

  return (
    <main className="mx-auto flex min-h-svh max-w-shop flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <LogoHorizontal />

      <div className="flex flex-col items-center gap-3">
        <h1 className="text-title text-balance text-ink">
          Volvemos en un rato
        </h1>
        <p className="max-w-prose text-body text-pretty text-ink-secondary">
          Estamos acomodando la tienda. Cuando terminemos vas a encontrar todo
          acá mismo, en la misma dirección.
        </p>
      </div>

      {/* Un `wa.me` sin número abre WhatsApp en la nada. */}
      {numero ? (
        <div className="flex flex-col items-center gap-2">
          <Button asChild variant="whatsapp" size="lg">
            <a
              href={whatsappLink(numero, "Hola, quería hacer una consulta.")}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconoWhatsApp className="size-4" />
              Escribinos por WhatsApp
            </a>
          </Button>
          <p className="text-caption text-ink-secondary">
            Si necesitás algo ahora, te contestamos por ahí.
          </p>
        </div>
      ) : null}

      {/* La forma canónica, sin rotar (§2.4). */}
      <p className="text-body-sm text-ink-secondary">
        Ana vende, vos elegís la tecnología.
      </p>
    </main>
  );
}
