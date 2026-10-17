import { redirect } from "next/navigation";

import { exigirAdmin } from "@/lib/session";

/** El catálogo abre por marcas; cada listado tiene su propia dirección. */
export default async function CatalogoInicio() {
  await exigirAdmin();

  redirect("/admin/catalogo/marcas");
}
