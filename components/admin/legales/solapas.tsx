"use client";

import { usePathname } from "next/navigation";

import { SolapasDelPanel } from "@/components/admin/solapas";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";

/**
 * Las cuatro páginas legales — RF-29, F9.3.
 *
 * **Subrayado y sin número** (§6.9), como el catálogo: cada solapa es otra
 * página, no otra vista del mismo listado.
 */
export function SolapasDeLegales() {
  const pathname = usePathname();

  return (
    <SolapasDelPanel
      etiqueta="Páginas legales"
      variante="subrayado"
      solapas={PAGINAS_LEGALES.map((p) => {
        const href = `/admin/legales/${p.slug}`;
        return { href, etiqueta: p.titulo, activa: pathname === href };
      })}
    />
  );
}
