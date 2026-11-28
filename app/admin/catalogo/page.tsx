import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/session";

/** El catálogo abre por marcas; cada listado tiene su propia dirección. */
export default async function CatalogoInicio() {
  await requireAdmin();

  redirect("/admin/catalogo/marcas");
}
