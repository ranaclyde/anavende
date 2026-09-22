import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PanelDeCatalogo } from "@/components/admin/catalogo/panel";
import {
  cuantasPaginas,
  leerPaginaDeCatalogo,
  urlDePagina,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/filtros-panel";
import { listarCategorias } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Categorías" };

const BASE = "/admin/catalogo/categorias";

export default async function CategoriasDelCatalogo({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa; el acceso sincrónico se quitó.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const pagina = leerPaginaDeCatalogo(await searchParams);
  const { items, total } = await listarCategorias(pagina);

  // Pedir una página que ya no existe —un enlace viejo, o borrar el último de
  // la última— lleva a la última que sí existe, como en los otros listados.
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
    />
  );
}
