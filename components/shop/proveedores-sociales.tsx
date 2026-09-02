"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

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
 * Los botones se muestran DESHABILITADOS cuando el proveedor no está
 * configurado, con el motivo al lado. Un botón apagado sin explicación es un
 * callejón sin salida (DESIGN-REFERENCE §6.3, RNF-08).
 */

const PROVEEDORES = [
  { id: "google", nombre: "Google" },
  { id: "facebook", nombre: "Facebook" },
] as const;

type Proveedor = (typeof PROVEEDORES)[number]["id"];

export function ProveedoresSociales({
  volver,
  accion,
  disponibles,
}: {
  volver?: string;
  accion: "ingreso" | "registro";
  /**
   * Qué proveedores tienen credenciales cargadas. Mientras no las haya
   * (F1.7, pendiente de las consolas de Google y Meta) llega vacío.
   */
  disponibles?: readonly Proveedor[];
}) {
  const [pendiente, iniciar] = useTransition();
  const [yendo, setYendo] = useState<Proveedor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activos = disponibles ?? [];

  const entrar = (proveedor: Proveedor) => {
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
      <div className="grid gap-2 sm:grid-cols-2">
        {PROVEEDORES.map(({ id, nombre }) => {
          const habilitado = activos.includes(id);
          return (
            <Button
              key={id}
              type="button"
              variant="secondary"
              size="lg"
              disabled={!habilitado}
              loading={pendiente && yendo === id}
              loadingLabel={`Abriendo ${nombre}`}
              onClick={() => entrar(id)}
              title={habilitado ? undefined : `${nombre} todavía no está configurado`}
            >
              {accion === "registro" ? "Seguir con" : "Entrar con"} {nombre}
            </Button>
          );
        })}
      </div>

      {activos.length === 0 && (
        <p className="text-caption text-ink-secondary">
          Google y Facebook todavía no están disponibles. Por ahora usá tu
          email.
        </p>
      )}

      <FieldError>{error}</FieldError>

      <div
        className={cn(
          "flex items-center gap-3 text-caption text-ink-tertiary",
          "before:h-px before:flex-1 before:bg-border",
          "after:h-px after:flex-1 after:bg-border",
        )}
      >
        o con tu email
      </div>
    </div>
  );
}
