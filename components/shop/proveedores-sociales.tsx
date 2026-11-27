"use client";

import { type ReactNode, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { IconoGoogle } from "@/components/ui/icono-google";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ProveedorSocial } from "@/modules/users/proveedores";

/**
 * Ingreso con proveedores sociales (RF-06), en registro e ingreso: para el
 * proveedor son la misma operación. Supabase vincula por email solo si está
 * verificado. Sin ninguno prendido en GoTrue no se muestra nada.
 */

const NOMBRES: Record<ProveedorSocial, string> = {
  google: "Google",
  facebook: "Facebook",
};

/**
 * En sus colores. Facebook va sin logo: el de `iconos-de-redes.tsx` está en
 * `currentColor`, y acá tendría que ser el azul de la marca.
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
  /** Los que GoTrue tiene prendidos, en orden. */
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
