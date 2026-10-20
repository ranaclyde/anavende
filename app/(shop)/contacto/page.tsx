import { ArrowUpRight, ChevronRight, Mail } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { IconoFacebook, IconoInstagram } from "@/components/ui/iconos-de-redes";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { OPEN_GRAPH_BASE } from "@/lib/seo";
import { cn } from "@/lib/utils";
import { enlaceDeWhatsApp } from "@/lib/whatsapp";
import { leerLaConfiguracion } from "@/modules/settings/queries";

const DESCRIPCION =
  "Escribinos por WhatsApp o por email, o seguinos en Instagram y Facebook. Del otro lado está Ana.";

export const metadata: Metadata = {
  title: "Contacto",
  description: DESCRIPCION,
  alternates: { canonical: "/contacto" },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: "/contacto",
    title: "Contacto",
    description: DESCRIPCION,
  },
};

type Canal = {
  nombre: string;
  /** Para qué conviene: así nadie pregunta por su pedido en Facebook. */
  para: string;
  href: string;
  accion: string;
  Icono: React.ComponentType<{ className?: string }>;
  externo: boolean;
};

/**
 * Lo que suele preguntarse y ya tiene respuesta escrita. «Seguir o cancelar»
 * va a Mis compras y no a una página: ahí es donde se hace (RF-23).
 */
const AYUDA = [
  {
    href: "/legales/como-comprar",
    titulo: "Cómo comprar",
    bajada: "Los dos caminos, y qué pasa después de pedir.",
  },
  {
    href: "/legales/garantias",
    titulo: "Garantías y devoluciones",
    bajada: "Qué cubre la garantía y cómo se devuelve.",
  },
  {
    href: "/mi-cuenta/compras",
    titulo: "Seguir o cancelar un pedido",
    bajada: "Tus pedidos están en Mis compras.",
  },
];

/**
 * Contacto (2026-10-20). Un renglón por canal, con para qué sirve cada uno.
 *
 * Todo sale de la configuración (RF-20): el WhatsApp, el email al que llegan
 * los pedidos —el mismo que usan las páginas legales— y las redes. **Un canal
 * sin cargar no aparece**: un botón que no lleva a ningún lado es peor que no
 * tenerlo. WhatsApp es el único relleno en verde porque es por donde se vende
 * (DR §2.6); el resto va en contorno.
 */
export default async function Contacto() {
  const configuracion = await leerLaConfiguracion();
  const canales = canalesDe(configuracion);

  return (
    <div className="mx-auto flex w-full max-w-shop flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <header className="flex flex-col gap-2">
        <h1 id="titulo" className="text-title text-ink">
          Contacto
        </h1>
        <p className="text-body text-ink-secondary">
          Del otro lado está Ana. Elegí por dónde te queda más cómodo.
        </p>
      </header>

      {canales.length > 0 ? (
        <ul
          aria-labelledby="titulo"
          className="flex flex-col divide-y divide-border rounded-card bg-surface px-5 shadow-md sm:px-6"
        >
          {canales.map((canal) => (
            <RenglonDeCanal key={canal.nombre} {...canal} />
          ))}
        </ul>
      ) : (
        <p className="rounded-card bg-surface p-6 text-body text-ink-secondary shadow-md">
          Estamos cargando nuestros datos de contacto. Volvé en un rato.
        </p>
      )}

      <section aria-labelledby="ayuda" className="flex flex-col gap-3">
        <h2 id="ayuda" className="text-heading text-ink">
          Quizás ya está respondido
        </h2>
        <ul className="flex flex-col">
          {AYUDA.map((a) => (
            <li key={a.href} className="border-b border-border last:border-b-0">
              <Link
                href={a.href}
                className="group flex min-h-14 items-center justify-between gap-3 py-3 text-ink"
              >
                <span className="flex flex-col">
                  <span className="text-body font-medium">{a.titulo}</span>
                  <span className="text-body-sm text-ink-secondary">
                    {a.bajada}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-ink-tertiary transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function RenglonDeCanal({ nombre, para, href, accion, Icono, externo }: Canal) {
  const esWhatsApp = nombre === "WhatsApp";

  return (
    <li className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-5">
      <span className="flex flex-1 items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-pill bg-canvas">
          {/* El de WhatsApp trae su verde; los demás van en tinta. */}
          <Icono className={cn("size-5", !esWhatsApp && "text-ink")} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-medium text-ink">{nombre}</span>
          <span className="text-body-sm text-ink-secondary">{para}</span>
        </span>
      </span>
      {/* En el teléfono el botón va debajo, alineado con el texto y no con
          el ícono: 44 del disco más 16 de separación. */}
      <Button
        asChild
        variant={esWhatsApp ? "whatsapp" : "secondary"}
        className="min-w-0 max-sm:ml-15 sm:shrink-0"
      >
        <a
          href={href}
          {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          <span className="truncate">{accion}</span>
          {externo && !esWhatsApp ? <ArrowUpRight aria-hidden /> : null}
        </a>
      </Button>
    </li>
  );
}

function canalesDe(
  c: Awaited<ReturnType<typeof leerLaConfiguracion>>,
): Canal[] {
  if (!c) return [];

  const canales: (Canal | null)[] = [
    {
      nombre: "WhatsApp",
      para: "Consultas, pedidos y entregas. Es lo más rápido.",
      href: enlaceDeWhatsApp(c.whatsappNumber, "Hola, tengo una consulta."),
      accion: "Escribir",
      Icono: IconoWhatsApp,
      externo: true,
    },
    {
      nombre: "Email",
      para: "Para algo largo, o si tenés que mandar una foto o un comprobante.",
      href: `mailto:${c.adminNotificationEmail}`,
      accion: c.adminNotificationEmail,
      Icono: Mail,
      externo: false,
    },
    c.instagramUrl
      ? {
          nombre: "Instagram",
          para: "Lo que va entrando, antes de que llegue a la tienda.",
          href: c.instagramUrl,
          accion: "Seguir",
          Icono: IconoInstagram,
          externo: true,
        }
      : null,
    c.facebookUrl
      ? {
          nombre: "Facebook",
          para: "Novedades y publicaciones.",
          href: c.facebookUrl,
          accion: "Ver página",
          Icono: IconoFacebook,
          externo: true,
        }
      : null,
  ];

  return canales.filter((canal) => canal !== null);
}
