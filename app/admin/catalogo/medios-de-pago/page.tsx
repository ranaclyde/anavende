import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ListadoDeMediosDePago } from "@/components/admin/pagos/listado";
import {
  cuantasPaginas,
  leerPaginaDeCatalogo,
  urlDePagina,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/filtros-panel";
import { listarMediosDePago } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Medios de pago" };

const BASE = "/admin/catalogo/medios-de-pago";

export default async function MediosDePagoDelCatalogo({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa; el acceso sincrónico se quitó.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const pagina = leerPaginaDeCatalogo(await searchParams);
  const { items, total } = await listarMediosDePago(pagina);

  // Pedir una página que ya no existe —un enlace viejo, o borrar el último de
  // la última— lleva a la última que sí existe, como en los otros listados.
  const paginas = cuantasPaginas(total);
  if (pagina > paginas) redirect(urlDePagina(BASE, paginas));

  return (
    <ListadoDeMediosDePago
      items={items}
      total={total}
      pagina={pagina}
      paginas={paginas}
      base={BASE}
    />
  );
}
