import Link from "next/link";

import { Isotipo } from "@/components/shop/logo";
import { IconoFacebook, IconoInstagram } from "@/components/ui/iconos-de-redes";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";
import type { RedesSociales } from "@/modules/settings/queries";

/**
 * Pie de la tienda — DESIGN-REFERENCE §5.1.
 * Pie oscuro con la marca y su eslogan, los medios de pago, la ayuda y los
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
 * Grupos con nombre y no una sola lista (pedido del 2026-10-20): con Contacto
 * eran siete enlaces bajo «Información», y una lista de siete no se escanea.
 * «Tienda» es por dónde se recorre lo que hay (F3.10, DR §5.1); «Ayuda», lo
 * que se busca para resolver algo; «Legales», lo que hay que tener a mano.
 */
const GRUPOS = [
  {
    titulo: "Tienda",
    enlaces: [
      { href: "/productos", titulo: "Catálogo" },
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
        <div className="flex flex-col gap-8 md:flex-row md:justify-between md:gap-10">
          <div className="flex max-w-sm flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5">
                {/* Versión clara: el burdeos del original no se lee sobre
                    esta superficie (§2.3). */}
                <Isotipo claro />
                <span className="text-heading">AnaVende</span>
              </div>
              {/*
                El eslogan en su forma canónica (§2.4): el pie se ve una vez y
                tiene que decir de qué se trata, así que acá no rota. Ocupa el
                lugar del aviso de zona (pedido del 2026-10-21), que sigue en
                la home, la ficha, el carrito y el checkout.
              */}
              <p className="text-body text-white/85">
                Ana vende, vos elegís la tecnología.
              </p>
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
              Tu tienda de confianza para productos de tecnología y accesorios.
            </p>
          </div>

          {/* En el teléfono, un grupo debajo del otro y juntos (pedido del
              2026-10-21): de a dos por fila, los nombres largos de «Ayuda»
              partían la columna y el pie quedaba desparejo. */}
          <div className="flex flex-col gap-6 md:flex-row md:gap-16">
            {GRUPOS.map((grupo) => (
              <nav
                key={grupo.titulo}
                aria-label={grupo.titulo}
                className="flex flex-col gap-3 max-md:gap-1"
              >
                <h2 className={TITULO_DE_GRUPO}>{grupo.titulo}</h2>
                {/*
                  40px de alto por fila en teléfono, y no los 44 de §9 (pedido
                  del 2026-10-21): con 44 el pie medía 850px. 40 sigue muy por
                  encima de los 24 de WCAG 2.5.8, y sin espacio entre filas
                  ningún enlace le roba el toque al de al lado. Acá no sirve
                  `AREA_TACTIL`: lo que sobresale de una fila se mete en la
                  vecina. En escritorio queda como estaba.
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
