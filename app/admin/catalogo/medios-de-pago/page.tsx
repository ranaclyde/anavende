import type { Metadata } from "next";

import { ListadoDeMediosDePago } from "@/components/admin/pagos/listado";
import { listarMediosDePago } from "@/modules/settings/queries";

export const metadata: Metadata = { title: "Medios de pago" };

export default async function MediosDePagoDelCatalogo() {
  const items = await listarMediosDePago();
  return <ListadoDeMediosDePago items={items} />;
}
