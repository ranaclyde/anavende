"use client";

import { type ReactNode, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { IconoGoogle } from "@/components/ui/icono-google";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProveedorSocial } from "@/modules/users/proveedores";

/**
 * Ingreso con Google y Facebook — RF-06.
 *
 * Van en las dos pantallas, registro e ingreso, porque para el proveedor
 * social son la misma operación: si la identidad no existe se crea, y si
 * existe se vincula. Supabase vincula automáticamente cuando el email
 * coincide y está verificado; si no lo está, rechaza. Es deliberado: sin esa
 * condición alguien podría registrarse con el email de otra persona y
 * quedarse con su cuenta cuando esa persona entre con Google (RF-06).
 *
 * **Solo se muestran los que están prendidos en GoTrue** (`disponibles`,
 * de `modules/users/proveedores.ts`), y sin ninguno no se muestra nada, ni el
 * «o con tu email». Hasta el 2026-10-26 salían los dos deshabilitados con el
 * motivo al lado; con Google andando y Facebook para el final, un botón que
 * nadie puede tocar es ruido justo en la pantalla donde menos conviene dudar.
 */

const NOMBRES: Record<ProveedorSocial, string> = {
  google: "Google",
  facebook: "Facebook",
};

/**
 * El logo de cada uno, en sus colores (`icono-google.tsx`). Facebook va sin
 * logo hasta que se configure: el de `iconos-de-redes.tsx` está en
 * `currentColor` para el pie, y en este botón tendría que ser el azul de la
 * marca.
 */
const LOGOS: Partial<Record<ProveedorSocial, ReactNode>> = {
  google: <IconoGoogle />,
};

export function ProveedoresSociales({
  volver,
  accion,
  disponibles,
}: {
  volver?: string;
  accion: "ingreso" | "registro";
  /** Los que GoTrue tiene prendidos, en el orden en que se muestran. */
  disponibles: readonly ProveedorSocial[];
}) {
  const [pendiente, iniciar] = useTransition();
  const [yendo, setYendo] = useState<ProveedorSocial | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (disponibles.length === 0) return null;

  const entrar = (proveedor: ProveedorSocial) => {
    setError(null);
    setYendo(proveedor);
    iniciar(async () => {
      const supabase = createClient();
      const destino = new URL("/api/auth/callback", window.location.origin);
      if (volver) destino.searchParams.set("volver", volver);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: proveedor,
        options: { redirectTo: destino.toString() },
      });

      if (error) {
        setYendo(null);
        setError("No pudimos abrir ese ingreso. Probá de nuevo en un momento.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn("grid gap-2", disponibles.length > 1 && "sm:grid-cols-2")}
      >
        {disponibles.map((id) => (
          <Button
            key={id}
            type="button"
            variant="secondary"
            size="lg"
            loading={pendiente && yendo === id}
            loadingLabel={`Abriendo ${NOMBRES[id]}`}
            onClick={() => entrar(id)}
          >
            {LOGOS[id]}
            {accion === "registro" ? "Seguir con" : "Entrar con"} {NOMBRES[id]}
          </Button>
        ))}
      </div>

      <FieldError>{error}</FieldError>

      <div
        className={cn(
          "flex items-center gap-3 text-caption text-ink-secondary",
          "before:h-px before:flex-1 before:bg-border",
          "after:h-px after:flex-1 after:bg-border",
        )}
      >
        o con tu email
      </div>
    </div>
  );
}
