"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AREA_TACTIL_CUADRADA, cn } from "@/lib/utils";

/**
 * «Copiado» dura el doble que en «Compartir»: el código se mira antes de
 * pegarlo. Sin contexto seguro (IP de la LAN) no hay portapapeles, y se dice.
 */
export function Sku({ sku }: { sku: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "sin-copiar">(
    "listo",
  );
  // Sin esto, el temporizador del primer toque corta el «Copiado» del segundo.
  const temporizador = useRef<number | undefined>(undefined);
  // La `key` del tilde, para que se dibuje de nuevo en cada toque.
  const [veces, setVeces] = useState(0);

  function mostrar(nuevo: "copiado" | "sin-copiar", ms: number) {
    window.clearTimeout(temporizador.current);
    setEstado(nuevo);
    temporizador.current = window.setTimeout(() => setEstado("listo"), ms);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(sku);
      setVeces((n) => n + 1);
      mostrar("copiado", 4000);
    } catch {
      mostrar("sin-copiar", 6000);
    }
  }

  const copiado = estado === "copiado";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1 text-body-sm text-ink-secondary">
        <p>
          SKU: <span className="font-medium text-ink tabular-nums">{sku}</span>
        </p>
        <Button
          variant="tertiary"
          size="sm"
          onClick={copiar}
          // Fijo: lo anuncia la región viva. Cambiarlo haría que el lector
          // relea el botón como si fuera otro.
          aria-label="Copiar SKU"
          className={cn(
            "relative px-2",
            AREA_TACTIL_CUADRADA,
            copiado && "text-success hover:text-success",
          )}
        >
          {copiado ? (
            <Check
              key={veces}
              aria-hidden
              className="[&_path]:animate-tilde [&_path]:[stroke-dasharray:24]"
            />
          ) : (
            <Copy aria-hidden />
          )}
          {copiado ? <span aria-hidden>Copiado</span> : null}
        </Button>
      </div>

      {estado === "sin-copiar" ? (
        <p className="text-caption text-ink-secondary">
          No pudimos copiarlo. Seleccioná el código y copialo a mano.
        </p>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {copiado ? "SKU copiado al portapapeles" : ""}
      </p>
    </div>
  );
}
