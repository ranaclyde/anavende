"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { completarPerfil } from "@/modules/users/actions";

type Campo = "firstName" | "lastName" | "phone";

/**
 * Parte el nombre que entregó el proveedor social en nombre y apellido.
 *
 * ES UNA ADIVINANZA, y acá está bien que lo sea: Google y Facebook entregan
 * un solo campo, y esto solo llena los valores por omisión de un formulario
 * que la persona tiene delante y puede corregir. Es lo contrario de adivinar
 * en el servidor, callado, al guardar — que es lo que se sacó del alta el
 * 2026-09-10.
 *
 * Se declara fuera del componente para no rearmarla en cada render.
 */
function partirNombre(sugerido: string | null) {
  const partes = (sugerido ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: "", apellido: "" };
  return { nombre: partes[0], apellido: partes.slice(1).join(" ") };
}

/**
 * Paso que falta tras el primer ingreso por Google o Facebook (RF-06, §13.4).
 * Ningún proveedor social entrega teléfono, y sin teléfono no se coordina una
 * venta: hasta completarlo se puede navegar, pero no operar.
 */
export function CompletarPerfilForm({
  email,
  nombreSugerido,
  volver,
}: {
  email: string | null;
  nombreSugerido: string | null;
  volver?: string;
}) {
  const router = useRouter();
  const sugerido = partirNombre(nombreSugerido);
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setErrores(SIN_ERRORES);

    iniciar(async () => {
      const r = await completarPerfil({
        firstName: String(datos.get("firstName") ?? ""),
        lastName: String(datos.get("lastName") ?? ""),
        phone: String(datos.get("phone") ?? ""),
      });

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      router.push(volver && volver.startsWith("/") ? volver : "/mi-cuenta");
      router.refresh();
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Falta un dato</CardTitle>
        <CardDescription>
          {email
            ? `Entraste como ${email}. Necesitamos tu teléfono para coordinar la entrega.`
            : "Necesitamos tu teléfono para coordinar la entrega."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                defaultValue={sugerido.nombre}
                required
                aria-invalid={!!errores.campos.firstName || undefined}
              />
              <FieldError>{errores.campos.firstName}</FieldError>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                defaultValue={sugerido.apellido}
                required
                aria-invalid={!!errores.campos.lastName || undefined}
              />
              <FieldError>{errores.campos.lastName}</FieldError>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Teléfono</Label>
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="11 5555 5555"
              required
              aria-invalid={!!errores.campos.phone || undefined}
            />
            {errores.campos.phone ? (
              <FieldError>{errores.campos.phone}</FieldError>
            ) : (
              <FieldHint>Por acá coordinamos la entrega y el pago.</FieldHint>
            )}
          </div>

          <FieldError>{errores.general}</FieldError>

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            loading={enviando}
            loadingLabel="Guardando"
          >
            Guardar y seguir
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
