import type { Metadata } from "next";

import { EditorDeMarcaDeAgua } from "@/components/admin/marca-de-agua/editor";
import { leerLaMarcaDeAgua } from "@/modules/marca-de-agua/queries";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Marca de agua" };

export default async function MarcaDeAgua() {
  await exigirAdmin();
  const marca = await leerLaMarcaDeAgua();

  // El encabezado lo pinta el editor: su interruptor tiene que saber si hay
  // cambios sin guardar.
  return <EditorDeMarcaDeAgua marca={marca} />;
}
