"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * «Descargar fotos»: todas las del producto en un zip, en JPG y tal como
 * están, con la marca de agua si la tienen — F2.18.
 *
 * Con `fetch` y no con un enlace: armar el zip tarda unos segundos (cada
 * foto se convierte), y así el botón muestra que está trabajando y, si
 * falla, el error se dice en la sección en vez de bajarse un archivo roto.
 * El error lo pinta quien lo usa, donde ya pinta los de los colores.
 */
export function DescargarFotos({
  productId,
  alFallar,
}: {
  productId: string;
  /** `null` = se limpia el error anterior al reintentar. */
  alFallar: (mensaje: string | null) => void;
}) {
  const [bajando, setBajando] = useState(false);

  const descargar = async () => {
    setBajando(true);
    alFallar(null);
    try {
      const respuesta = await fetch(`/api/admin/productos/${productId}/fotos`);
      if (!respuesta.ok) {
        const cuerpo = (await respuesta.json().catch(() => null)) as {
          message?: string;
        } | null;
        alFallar(cuerpo?.message ?? "No pudimos armar el zip. Probá de nuevo.");
        return;
      }
      const nombre =
        /filename="([^"]+)"/.exec(
          respuesta.headers.get("Content-Disposition") ?? "",
        )?.[1] ?? "fotos.zip";
      const url = URL.createObjectURL(await respuesta.blob());
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre;
      enlace.click();
      // Después del clic: revocarla antes cortaría la descarga en Safari.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      alFallar("No pudimos armar el zip. Revisá la conexión y probá de nuevo.");
    } finally {
      setBajando(false);
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={descargar}
      loading={bajando}
      loadingLabel="Armando el zip con las fotos"
    >
      <Download aria-hidden />
      Descargar fotos
    </Button>
  );
}
