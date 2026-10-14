"use client";

import { History } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { borrarVistos } from "@/modules/catalog/products/actions-vistos";
import {
  COOKIE_DE_VISTOS,
  sumarVisto,
  VIDA_DE_VISTOS,
} from "@/modules/catalog/products/vistos-cookie";

/**
 * Anota la ficha abierta en «Vistos recientemente» — F8.4, RF-33.
 *
 * **La escribe el navegador y no una acción del servidor**, y es a propósito:
 * una acción que toca una cookie hace que Next vuelva a dibujar la página
 * entera, y eso sería re-renderizar la ficha en cada visita para anotar un id.
 * Acá no hay nada que dibujar: el bloque de esta misma ficha excluye el
 * producto que se está viendo, así que la anotación recién se nota en la
 * próxima página.
 *
 * No dibuja nada. Sin JavaScript no anota, y eso está bien: el historial es
 * un atajo, no un dato del que dependa algo.
 */
export function RegistrarVista({ productoId }: { productoId: string }) {
  useEffect(() => {
    const actual = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_DE_VISTOS}=`))
      ?.slice(COOKIE_DE_VISTOS.length + 1);

    // `Lax`: viaja cuando se llega a la tienda desde un enlace de afuera
    // —un WhatsApp, un buscador—, que es justo cuando el bloque sirve. Sin
    // `Secure` en desarrollo, donde no hay HTTPS y el navegador la tiraría.
    const segura = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${COOKIE_DE_VISTOS}=${sumarVisto(actual, productoId)}; Path=/; ` +
      `Max-Age=${VIDA_DE_VISTOS}; SameSite=Lax${segura}`;
  }, [productoId]);

  return null;
}

/**
 * «Borrar historial» (RF-33: «se puede borrar desde el propio bloque»).
 *
 * Sin confirmación: no se pierde nada que costó armar —es lo que se miró, y
 * se vuelve a armar mirando—, y un diálogo pesaría más que lo que protege.
 * Tampoco hay aviso flotante: al borrar, el bloque desaparece, y eso ya dice
 * que salió. Si falla, el error queda al lado del botón.
 */
export function BorrarVistos() {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex shrink-0 items-center gap-2">
      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      <Button
        type="button"
        variant="tertiary"
        size="md"
        loading={enCurso}
        loadingLabel="Borrando el historial"
        onClick={() => {
          setError(null);
          iniciar(async () => {
            const r = await borrarVistos({});
            if (!r.ok) setError(r.message);
          });
        }}
      >
        <History aria-hidden />
        Borrar historial
      </Button>
    </div>
  );
}
