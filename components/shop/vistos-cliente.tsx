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
 * Anota la ficha abierta en «Vistos recientemente» (RF-33). La cookie la
 * escribe el navegador y no una acción: una acción que toca una cookie hace
 * que Next vuelva a dibujar la página entera.
 */
export function RegistrarVista({ productoId }: { productoId: string }) {
  useEffect(() => {
    const actual = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${COOKIE_DE_VISTOS}=`))
      ?.slice(COOKIE_DE_VISTOS.length + 1);

    // `Lax`, para que viaje al llegar desde un enlace de afuera. Sin `Secure`
    // en desarrollo, donde no hay HTTPS y el navegador la tiraría.
    const segura = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      `${COOKIE_DE_VISTOS}=${sumarVisto(actual, productoId)}; Path=/; ` +
      `Max-Age=${VIDA_DE_VISTOS}; SameSite=Lax${segura}`;
  }, [productoId]);

  return null;
}

/** «Borrar historial», sin confirmación: no se pierde nada que costó armar. */
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
