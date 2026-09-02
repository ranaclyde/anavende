import { Truck } from "lucide-react";
import Link from "next/link";

import { Isotipo } from "@/components/shop/logo";

/**
 * Pie de la tienda — DESIGN-REFERENCE §5.1.
 * Pie oscuro con el aviso de PedidosYa, los medios de pago y los legales.
 *
 * Los medios de pago los carga la vendedora (RF-19, F2.6) y las páginas
 * legales son editables (RF-29, F9.3): los dos llegan como datos, no como
 * texto fijo en el código.
 */

export type MedioDePago = { id: string; name: string };

const LEGALES = [
  { slug: "como-comprar", titulo: "Cómo comprar" },
  { slug: "garantias", titulo: "Garantías y devoluciones" },
  { slug: "terminos", titulo: "Términos y condiciones" },
  { slug: "privacidad", titulo: "Privacidad" },
];

export function SiteFooter({
  mediosDePago = [],
}: {
  mediosDePago?: MedioDePago[];
}) {
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
            <p className="text-body-sm text-white/65">
              Teclados, mouses, auriculares, cables y memorias.
            </p>
            <p className="flex items-start gap-2 text-body-sm text-white/65">
              <Truck aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                Los envíos se hacen por{" "}
                <span className="text-ink-inverse">PedidosYa</span>, y se
                coordinan por WhatsApp cuando armamos tu pedido.
              </span>
            </p>
          </div>

          <nav aria-label="Información" className="flex flex-col gap-3">
            <h2 className="text-caption tracking-wide text-white/70 uppercase">
              Información
            </h2>
            <ul className="flex flex-col gap-2">
              {LEGALES.map((l) => (
                <li key={l.slug}>
                  <Link
                    href={`/legales/${l.slug}`}
                    className="rounded-pill text-body-sm text-white/75 underline-offset-4 transition-colors duration-150 hover:text-ink-inverse hover:underline"
                  >
                    {l.titulo}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {mediosDePago.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-caption tracking-wide text-white/70 uppercase">
                Medios de pago
              </h2>
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
