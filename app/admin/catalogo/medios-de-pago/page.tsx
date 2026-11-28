import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ListadoDeMediosDePago } from "@/components/admin/pagos/listado";
import {
  cuantasPaginas,
  leerPaginaDeCatalogo,
  urlDePagina,
  type SearchParamsRecord,
} from "@/modules/catalog/filtros-panel";
import { listarMediosDePago } from "@/modules/settings/queries";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Medios de pago" };

const BASE = "/admin/catalogo/medios-de-pago";

export default async function MediosDePagoDelCatalogo({
  searchParams,
}: {
  searchParams: Promise<SearchParamsRecord>;
}) {
  await requireAdmin();

  const pagina = leerPaginaDeCatalogo(await searchParams);
  const { items, total } = await listarMediosDePago(pagina);

  // Una página que ya no existe lleva a la última que sí.
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
