import { redirect } from "next/navigation";

/** El catálogo abre por marcas; cada listado tiene su propia dirección. */
export default function CatalogoInicio() {
  redirect("/admin/catalogo/marcas");
}
