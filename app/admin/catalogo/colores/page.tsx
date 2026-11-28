import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PanelDeCatalogo } from "@/components/admin/catalogo/panel";
import {
  cuantasPaginas,
  leerPaginaDeCatalogo,
  urlDePagina,
  type SearchParamsRecord,
} from "@/modules/catalog/filtros-panel";
import { listarColores } from "@/modules/catalog/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Colores" };

const BASE = "/admin/catalogo/colores";

export default async function ColoresDelCatalogo({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  await requireAdmin();

  const pagina = leerPaginaDeCatalogo(await searchParams);
  const { items, total } = await listarColores(pagina);

  // Una página que ya no existe lleva a la última que sí.
  const paginas = cuantasPaginas(total);
  if (pagina > paginas) redirect(urlDePagina(BASE, paginas));

  return (
    <PanelDeCatalogo
      tipo="color"
      items={items}
      total={total}
      pagina={pagina}
      paginas={paginas}
      base={BASE}
    />
  );
}
