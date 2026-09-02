import type { Metadata } from "next";

import { PanelDeCatalogo } from "@/components/admin/catalogo/panel";
import { listarMarcas } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Marcas" };

export default async function MarcasDelCatalogo() {
  const items = await listarMarcas();
  return <PanelDeCatalogo tipo="marca" items={items} />;
}
