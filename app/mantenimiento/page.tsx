import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Isotipo } from "@/components/shop/logo";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { enlaceDeWhatsApp } from "@/lib/whatsapp";
import { estaEnMantenimiento } from "@/modules/settings/mantenimiento";
import { numeroDeWhatsApp } from "@/modules/settings/queries";

/**
 * La tienda cerrada al público — F2.7b, DESIGN-REFERENCE §8 y §10.
 *
 * **No se llega acá por un enlace**: el proxy reescribe cualquier ruta de la
 * tienda a esta página, con 503 y `Retry-After`, y la dirección del navegador
 * sigue siendo la que se pidió (`lib/supabase/proxy.ts`). Por eso no hay
 * «volver al inicio»: el inicio también está cerrado, y un botón que lleva de
 * vuelta a este mismo cartel es una salida que no existe.
 *
 * **Con la tienda abierta, esta página no tiene nada que decir** y manda al
 * inicio. Pregunta con `estaEnMantenimiento()` —la memoria que usa el proxy—
 * y no con la base: si una dijera «cerrada» y la otra «abierta» en los
 * segundos después de reabrir, el proxy mandaría acá y esta página mandaría
 * al inicio, una y otra vez.
 *
 * Sin encabezado ni pie de la tienda, como las pantallas de identidad: no hay
 * nada que buscar ni ningún lado adonde ir.
 */
export const metadata: Metadata = {
  title: "Volvemos en un rato",
  // El 503 ya le dice a un buscador que no guarde esto; el `noindex` es por si
  // alguien llega a la dirección directa, que responde 200.
  robots: { index: false, follow: false },
};

export default async function Mantenimiento() {
  const [cerrada, numero] = await Promise.all([
    estaEnMantenimiento(),
    numeroDeWhatsApp(),
  ]);

  if (!cerrada) redirect("/");

  return (
    <main className="mx-auto flex min-h-svh max-w-shop flex-col items-center justify-center gap-8 px-4 py-16 text-center">
      <div className="inline-flex items-center gap-2.5">
        <Isotipo />
        <span className="text-heading text-ink">AnaVende</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <h1 className="text-title text-balance text-ink">
          Volvemos en un rato
        </h1>
        <p className="max-w-prose text-body text-pretty text-ink-secondary">
          Estamos acomodando la tienda. Cuando terminemos vas a encontrar todo
          acá mismo, en la misma dirección.
        </p>
      </div>

      {/* La única salida que hay, así que es la principal (§7.3, el mismo
          criterio que «Preguntá si va a haber»). Sin número cargado no se
          dibuja: un `wa.me` sin número abre WhatsApp en la nada. */}
      {numero ? (
        <div className="flex flex-col items-center gap-2">
          <Button asChild variant="brand" size="lg">
            <a
              href={enlaceDeWhatsApp(numero, "Hola, quería hacer una consulta.")}
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

      {/* §2.4: donde se ve una sola vez va la forma canónica, sin rotar. */}
      <p className="text-body-sm text-ink-secondary">
        Ana vende, vos elegís la tecnología.
      </p>
    </main>
  );
}
