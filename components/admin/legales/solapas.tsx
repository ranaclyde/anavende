"use client";

import { usePathname } from "next/navigation";

import { SolapasDelPanel } from "@/components/admin/solapas";
import { PAGINAS_LEGALES } from "@/modules/content/paginas";

/** Subrayado y sin número (DR §6.9): cada solapa es otra página. */
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
