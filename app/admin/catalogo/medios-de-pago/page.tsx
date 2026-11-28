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
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Medios de pago" };

const BASE = "/admin/catalogo/medios-de-pago";

export default async function MediosDePagoDelCatalogo({
  searchParams,
}: {
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  await exigirAdmin();

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
