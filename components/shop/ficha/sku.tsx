"use client";

import { useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AREA_TACTIL_CUADRADA, cn } from "@/lib/utils";

/**
 * El SKU de la ficha, con el botón para copiarlo (2026-11-05).
 *
 * Va entre el nombre y el precio. El código se copia para pegarlo en un
 * mensaje o compararlo con otra tienda, y de memoria se escribe mal.
 *
 * **El ícono solo, y «Copiado» en verde al tocarlo**, con el tilde que se
 * dibuja (`animate-tilde`). Es el verde de estado (`success`) y no el de
 * WhatsApp: dice que algo salió bien, no que abre WhatsApp. Dura 4 segundos,
 * el doble que «Compartir»: el código se mira antes de pegarlo. Si el
 * portapapeles no existe —la tienda abierta por IP de la LAN, sin contexto
 * seguro—, lo dice en vez de no hacer nada.
 */
export function Sku({ sku }: { sku: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "sin-copiar">(
    "listo",
  );
  // Tocar de nuevo reinicia la cuenta: sin esto, el temporizador del primer
  // toque cortaba el «Copiado» del segundo antes de tiempo.
  const temporizador = useRef<number | undefined>(undefined);
  // Cuántas veces se copió: es la `key` del tilde, para que se dibuje de
  // nuevo en cada toque aunque ya estuviera a la vista.
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
          // El nombre no cambia al copiar: lo anuncia la región viva de abajo,
          // igual que en «Compartir». Cambiarlo hace que el lector relea el
          // botón como si fuera otro.
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
