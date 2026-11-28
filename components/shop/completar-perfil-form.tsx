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
import { internalRedirectTarget } from "@/lib/redirect-target";
import { readErrors, NO_ERRORS, type FormErrors } from "@/lib/form";
import { completarPerfil } from "@/modules/users/actions";

type Campo = "firstName" | "lastName" | "phone";

/**
 * Adivina nombre y apellido del nombre que dio el proveedor. Acá está bien
 * adivinar: solo llena un formulario que la persona puede corregir.
 */
function partirNombre(sugerido: string | null) {
  const partes = (sugerido ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return { nombre: "", apellido: "" };
  return { nombre: partes[0], apellido: partes.slice(1).join(" ") };
}

/**
 * Paso que falta tras el primer ingreso con un proveedor social (RF-06):
 * ninguno entrega teléfono, y hasta completarlo no se puede operar.
 */
export function CompletarPerfilForm({
  email,
  nombreSugerido,
  separado,
  volver,
}: {
  email: string | null;
  nombreSugerido: string | null;
  /** Nombre y apellido tal como los dio el proveedor, si los dio. */
  separado?: { nombre: string; apellido: string } | null;
  volver?: string;
}) {
  const router = useRouter();
  const sugerido = separado ?? partirNombre(nombreSugerido);
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] = useState<FormErrors<Campo>>(NO_ERRORS);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setErrores(NO_ERRORS);

    iniciar(async () => {
      const r = await completarPerfil({
        firstName: String(datos.get("firstName") ?? ""),
        lastName: String(datos.get("lastName") ?? ""),
        phone: String(datos.get("phone") ?? ""),
      });

      if (!r.ok) {
        setErrores(readErrors<Campo>(r));
        return;
      }

      // `//otro.com` también empieza con `/`.
      router.push(internalRedirectTarget(volver) ?? "/");
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
                aria-invalid={!!errores.fields.firstName || undefined}
              />
              <FieldError>{errores.fields.firstName}</FieldError>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                defaultValue={sugerido.apellido}
                required
                aria-invalid={!!errores.fields.lastName || undefined}
              />
              <FieldError>{errores.fields.lastName}</FieldError>
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
              aria-invalid={!!errores.fields.phone || undefined}
            />
            {errores.fields.phone ? (
              <FieldError>{errores.fields.phone}</FieldError>
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
