import type { Metadata } from "next";

import { EditorDeMarcaDeAgua } from "@/components/admin/marca-de-agua/editor";
import { leerLaMarcaDeAgua } from "@/modules/marca-de-agua/queries";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Marca de agua" };

/**
 * La marca de agua de las fotos de productos — RF-39, F2.16.
 *
 * Pantalla propia y no una tarjeta más de Configuración: lleva una vista
 * previa al lado de los controles, y en el formulario angosto de la
 * configuración no entraba. Configuración la enlaza con su estado.
 */
export default async function MarcaDeAgua() {
  await exigirAdmin();
  const marca = await leerLaMarcaDeAgua();

  // El encabezado lo pinta el editor: lleva el interruptor, que tiene que
  // saber si hay cambios sin guardar.
  return <EditorDeMarcaDeAgua marca={marca} />;
}
