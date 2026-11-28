import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PanelDeCatalogo } from "@/components/admin/catalogo/panel";
import {
  cuantasPaginas,
  leerPaginaDeCatalogo,
  urlDePagina,
  type SearchParamsRecord,
} from "@/modules/catalog/filtros-panel";
import {
  listarCategorias,
  listarRelacionables,
} from "@/modules/catalog/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Categorías" };

const BASE = "/admin/catalogo/categorias";

export default async function CategoriasDelCatalogo({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  await requireAdmin();

  const pagina = leerPaginaDeCatalogo(await searchParams);
  const [{ items, total }, relacionables] = await Promise.all([
    listarCategorias(pagina),
    listarRelacionables(),
  ]);

  // Una página que ya no existe lleva a la última que sí.
  const paginas = cuantasPaginas(total);
  if (pagina > paginas) redirect(urlDePagina(BASE, paginas));

  return (
    <PanelDeCatalogo
      tipo="categoria"
      items={items}
      total={total}
      pagina={pagina}
      paginas={paginas}
      base={BASE}
      relacionables={relacionables}
    />
  );
}
