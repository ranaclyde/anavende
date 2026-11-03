"use client";

import { Link2 } from "lucide-react";

import { avisar, avisarConPero } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";

/**
 * Copia la dirección pública del producto, para no tener que buscarlo en la
 * tienda. La página solo lo dibuja si el producto está activo: uno inactivo
 * da 404 a quien reciba el enlace.
 *
 * El portapapeles no existe sin contexto seguro —la tienda abierta por IP en
 * la LAN, por ejemplo—, y ahí el fallo se dice en vez de no hacer nada.
 */
export function CopiarEnlace({ url }: { url: string }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      avisar("Copiaste el enlace del producto.");
    } catch {
      avisarConPero("No pudimos copiarlo. El enlace es: " + url);
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => void copiar()}
    >
      <Link2 aria-hidden />
      Copiar enlace
    </Button>
  );
}
