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

type Campo = "fullName" | "phone";

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
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setErrores(SIN_ERRORES);

    iniciar(async () => {
      const r = await completarPerfil({
        fullName: String(datos.get("fullName") ?? ""),
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Nombre y apellido</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              defaultValue={nombreSugerido ?? ""}
              required
              aria-invalid={!!errores.campos.fullName || undefined}
            />
            <FieldError>{errores.campos.fullName}</FieldError>
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
