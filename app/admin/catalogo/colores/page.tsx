import type { Metadata } from "next";

import { PanelDeCatalogo } from "@/components/admin/catalogo/panel";
import { listarColores } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Colores" };

export default async function ColoresDelCatalogo() {
  const items = await listarColores();
  return <PanelDeCatalogo tipo="color" items={items} />;
}
