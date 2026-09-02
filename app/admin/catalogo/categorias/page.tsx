import type { Metadata } from "next";

import { PanelDeCatalogo } from "@/components/admin/catalogo/panel";
import { listarCategorias } from "@/modules/catalog/queries";

export const metadata: Metadata = { title: "Categorías" };

export default async function CategoriasDelCatalogo() {
  const items = await listarCategorias();
  return <PanelDeCatalogo tipo="categoria" items={items} />;
}
