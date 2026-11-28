"use client";

import { Link2 } from "lucide-react";

import { avisar, avisarConPero } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";

/**
 * Dibujarlo solo con el producto activo: uno inactivo da 404 a quien reciba el
 * enlace. Sin contexto seguro (la tienda por IP en la LAN) no hay
 * portapapeles, y el fallo se dice.
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
