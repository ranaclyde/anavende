import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { FormularioDeTextoLegal } from "@/components/admin/legales/formulario";
import { SolapasDeLegales } from "@/components/admin/legales/solapas";
import { fechaConHora } from "@/lib/fechas";
import { leerTextoLegal } from "@/modules/content/legales";
import { paginaLegal } from "@/modules/content/paginas";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Legales" };

type Props = { params: Promise<{ slug: string }> };

/** Los textos legales, editables sin deploy (RF-29). */
export default async function EditarTextoLegal({ params }: Props) {
  await exigirAdmin();

  const { slug } = await params;
  const pagina = paginaLegal(slug);
  if (!pagina) notFound();

  const texto = await leerTextoLegal(pagina.slug);

  return (
    <div className="flex w-full max-w-admin-form flex-col gap-4">
      <EncabezadoDePanel
        titulo="Legales"
        bajada="Páginas legales de la tienda."
      />

      <SolapasDeLegales />

      <FormularioDeTextoLegal
        slug={pagina.slug}
        titulo={pagina.titulo}
        contenido={texto?.contenido ?? ""}
        actualizada={
          texto ? fechaConHora(texto.actualizada.toISOString()) : "nunca"
        }
      />
    </div>
  );
}
