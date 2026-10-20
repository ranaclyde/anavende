import { Truck } from "lucide-react";
import Link from "next/link";

import { Isotipo } from "@/components/shop/logo";
import { IconoFacebook, IconoInstagram } from "@/components/ui/iconos-de-redes";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";
import type { RedesSociales } from "@/modules/settings/queries";

/**
 * Pie de la tienda — DESIGN-REFERENCE §5.1.
 * Pie oscuro con la zona de entrega, los medios de pago, la ayuda y los
 * legales.
 *
 * Los medios de pago los carga la vendedora (RF-19, F2.6), las páginas
 * legales son editables (RF-29, F9.3) y las redes sociales salen de la
 * configuración (2026-10-20): llegan como datos, no como texto fijo en el
 * código.
 */

export type MedioDePago = { id: string; name: string };

const legal = (slug: string) => {
  const p = PAGINAS_LEGALES.find((p) => p.slug === slug)!;
  return { href: `/legales/${p.slug}`, titulo: p.titulo };
};

/**
 * Dos grupos con nombre y no una sola lista (pedido del 2026-10-20): con
 * Contacto eran siete enlaces bajo «Información», y una lista de siete no se
 * escanea. «Ayuda» es lo que se busca para resolver algo; «Legales», lo que
 * hay que tener a mano.
 */
const GRUPOS = [
  {
    titulo: "Ayuda",
    enlaces: [
      { href: "/contacto", titulo: "Contacto" },
      legal("como-comprar"),
      legal("garantias"),
      /*
       * El «botón de arrepentimiento» (F9.3, pedido del 2026-10-16), con ese
       * nombre porque es el que la gente busca. Lleva a «Mis compras», donde un
       * pedido activo se cancela (RF-23); sin sesión, el ingreso vuelve ahí.
       */
      { href: "/mi-cuenta/compras", titulo: "Botón de arrepentimiento" },
    ],
  },
  {
    titulo: "Legales",
    enlaces: [
      legal("terminos"),
      legal("privacidad"),
      /*
       * RF-34 pide el acceso a la baja «a la vista», y es un requisito legal: el
       * pie está en todas las páginas. Lleva a la tarjeta de «Mis datos» donde se
       * pide (pedido del 2026-09-14); sin sesión, el ingreso vuelve ahí.
       */
      { href: "/mi-cuenta#baja", titulo: "Dar de baja mi cuenta" },
    ],
  },
];

/**
 * El título de cada grupo, en blanco pleno y semibold: hasta el 2026-10-20
 * iba en el mismo blanco atenuado que los enlaces y se leían al mismo nivel.
 */
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
    // El pie es la única superficie oscura de la tienda, y lo es a propósito:
    // cierra la página sin competir con las fotos de producto.
    <footer className="mt-20 bg-ink text-ink-inverse">
      <div className="mx-auto max-w-shop px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="flex items-center gap-2.5">
              {/* Versión clara: el burdeos del original no se lee sobre
                  esta superficie (§2.3). */}
              <Isotipo claro />
              <span className="text-heading">AnaVende</span>
            </div>
            {perfiles.length > 0 && (
              // Debajo del logo, pedido del 2026-10-20. 44px de lado (§9), y
              // corrido a la izquierda lo que sobra del cuadro, para que el
              // primer ícono quede alineado con el isotipo y no con su aire.
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
              Teclados, mouses, auriculares, cables y memorias.
            </p>
            <p className="flex items-start gap-2 text-body-sm text-white/65">
              <Truck aria-hidden className="mt-0.5 size-4 shrink-0" />
              {/*
                Se nombra la ZONA y no la mensajería (RN-10, reescrita el
                2026-09-08): la empresa que lleva el paquete puede cambiar, y
                lo que decide si alguien puede comprar acá no es su nombre
                sino hasta dónde llegamos. La tienda atiende Viedma, Carmen de
                Patagones y los pueblos de alrededor, no la provincia entera.
              */}
              <span>
                Entregamos a domicilio en{" "}
                <span className="text-ink-inverse">
                  Viedma, Carmen de Patagones y alrededores
                </span>
                , o lo retirás por nuestro punto de entrega. El envío se
                coordina por WhatsApp cuando armamos tu pedido.
              </span>
            </p>
          </div>

          {/* En el teléfono, los dos grupos lado a lado: apilados, el pie
              sumaba otra pantalla entera de enlaces. */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:flex md:gap-16">
            {GRUPOS.map((grupo) => (
              <nav
                key={grupo.titulo}
                aria-label={grupo.titulo}
                className="flex flex-col gap-3"
              >
                <h2 className={TITULO_DE_GRUPO}>{grupo.titulo}</h2>
                {/*
                  44px de alto por fila en teléfono (§9). Acá no sirve
                  `AREA_TACTIL`: con 8px entre filas, lo que sobresale de una se
                  mete en la de al lado y el dedo activa el enlace equivocado. La
                  fila gana altura de verdad y el `gap` se va, que es lo mismo por
                  otro lado. En escritorio queda como estaba.
                */}
                <ul className="flex flex-col gap-2 max-md:gap-0">
                  {grupo.enlaces.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="inline-flex items-center rounded-pill text-body-sm text-white/70 underline-offset-4 transition-colors duration-150 max-md:min-h-11 hover:text-ink-inverse hover:underline"
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

        <p className="mt-10 border-t border-white/10 pt-6 text-caption text-white/50">
          © {new Date().getFullYear()} AnaVende
        </p>
      </div>
    </footer>
  );
}
