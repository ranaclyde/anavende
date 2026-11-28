import Link from "next/link";

import { LogoHorizontal } from "@/components/shop/logo";
import { IconoFacebook, IconoInstagram } from "@/components/ui/iconos-de-redes";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";
import type { RedesSociales } from "@/modules/settings/queries";

/** Pie de la tienda (DESIGN-REFERENCE §5.1). */

export type MedioDePago = { id: string; name: string };

const legal = (slug: string) => {
  const p = PAGINAS_LEGALES.find((p) => p.slug === slug)!;
  return { href: `/legales/${p.slug}`, titulo: p.titulo };
};

const GRUPOS = [
  {
    titulo: "Tienda",
    enlaces: [
      { href: "/productos", titulo: "Productos" },
      { href: "/categorias", titulo: "Categorías" },
      { href: "/nosotros", titulo: "Nosotros" },
    ],
  },
  {
    titulo: "Ayuda",
    enlaces: [
      { href: "/contacto", titulo: "Contacto" },
      legal("como-comprar"),
      legal("garantias"),
      // Lleva a «Mis compras», donde un pedido activo se cancela (RF-23).
      { href: "/mi-cuenta/compras", titulo: "Botón de arrepentimiento" },
    ],
  },
  {
    titulo: "Legales",
    enlaces: [
      legal("terminos"),
      legal("privacidad"),
      // Requisito legal: la baja tiene que estar a la vista (RF-34).
      { href: "/mi-cuenta#baja", titulo: "Dar de baja mi cuenta" },
    ],
  },
];

const TITULO_DE_GRUPO =
  "text-caption font-semibold tracking-wide text-ink-inverse uppercase";

export function SiteFooter({
  mediosDePago = [],
  redes = { facebook: null, instagram: null },
}: {
  mediosDePago?: MedioDePago[];
  redes?: RedesSociales;
}) {
  const perfiles = [
    { red: "Instagram", href: redes.instagram, Icono: IconoInstagram },
    { red: "Facebook", href: redes.facebook, Icono: IconoFacebook },
  ].flatMap((p) => (p.href ? [{ ...p, href: p.href }] : []));

  return (
    <footer className="mt-20 bg-ink text-ink-inverse">
      <div className="mx-auto max-w-shop px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:justify-between md:gap-10">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              {/* Versión clara: el burdeos no se lee sobre este fondo. */}
              <LogoHorizontal claro className="self-start" />
              {/* El eslogan en su forma canónica: acá no rota. */}
              <p className="text-body text-white/85">
                Ana vende, vos elegís la tecnología.
              </p>
            </div>
            {perfiles.length > 0 && (
              // `-ml-2.5`: alinea el primer ícono con el isotipo y no con su aire.
              <ul aria-label="Redes sociales" className="-ml-2.5 flex gap-1">
                {perfiles.map(({ red, href, Icono }) => (
                  <li key={red}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`AnaVende en ${red}`}
                      className="flex size-11 items-center justify-center rounded-pill text-white/75 transition-colors duration-150 hover:bg-white/10 hover:text-ink-inverse"
                    >
                      <Icono className="size-5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-body-sm text-white/65">
              Tu tienda de confianza para productos de tecnología y accesorios.
            </p>
          </div>

          {/* En el teléfono, un grupo debajo del otro. */}
          <div className="flex flex-col gap-6 md:flex-row md:gap-16">
            {GRUPOS.map((grupo) => (
              <nav
                key={grupo.titulo}
                aria-label={grupo.titulo}
                className="flex flex-col gap-3 max-md:gap-1"
              >
                <h2 className={TITULO_DE_GRUPO}>{grupo.titulo}</h2>
                {/*
                  40px por fila en teléfono y no 44, a propósito (sobra para
                  WCAG 2.5.8). Sin `TOUCH_AREA`: se metería en la fila vecina.
                */}
                <ul className="flex flex-col gap-2 max-md:gap-0">
                  {grupo.enlaces.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex items-center rounded-pill text-body-sm text-white/70 underline-offset-4 transition-colors duration-150 max-md:min-h-10 hover:text-ink-inverse hover:underline"
                      >
                        {l.titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>

          {mediosDePago.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className={TITULO_DE_GRUPO}>Medios de pago</h2>
              <ul className="flex flex-wrap gap-2">
                {mediosDePago.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-pill bg-white/10 px-3 py-1 text-body-sm text-white/85"
                  >
                    {m.name}
                  </li>
                ))}
              </ul>
              <p className="text-caption text-white/50">
                El pago se coordina por WhatsApp: la página no cobra en línea.
              </p>
            </div>
          )}
        </div>

        <p className="mt-8 border-t border-white/10 pt-6 text-caption text-white/50 md:mt-10">
          © {new Date().getFullYear()} AnaVende
        </p>
      </div>
    </footer>
  );
}
