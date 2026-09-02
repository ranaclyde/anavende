"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ProveedoresSociales } from "@/components/shop/proveedores-sociales";
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
import { registrar } from "@/modules/users/actions";

type Campo = "fullName" | "email" | "phone" | "password";

/**
 * Alta de cuenta — RF-05, TECHNICAL-SPEC §13.4.
 *
 * El envío va a una Server Action, no al `signUp` del cliente: el perfil con
 * teléfono es obligatorio y el alta tiene que poder compensarse si falla a
 * mitad. La validación se repite en el servidor aunque acá ya haya pasado.
 */
export function SignUpForm({ volver }: { volver?: string }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setErrores(SIN_ERRORES);

    iniciar(async () => {
      const r = await registrar({
        fullName: String(datos.get("fullName") ?? ""),
        email: String(datos.get("email") ?? ""),
        phone: String(datos.get("phone") ?? ""),
        password: String(datos.get("password") ?? ""),
      });

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      const destino = new URLSearchParams({ email: r.data.email });
      if (volver) destino.set("volver", volver);
      router.push(`/registro/verificar?${destino}`);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creá tu cuenta</CardTitle>
        <CardDescription>
          Te sirve para guardar el carrito y seguir tus compras
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ProveedoresSociales volver={volver} accion="registro" />

        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="fullName">Nombre y apellido</Label>
            <Input
              id="fullName"
              name="fullName"
              autoComplete="name"
              required
              aria-invalid={!!errores.campos.fullName || undefined}
              aria-describedby={errores.campos.fullName ? "e-fullName" : undefined}
            />
            <FieldError id="e-fullName">{errores.campos.fullName}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={!!errores.campos.email || undefined}
              aria-describedby={errores.campos.email ? "e-email" : undefined}
            />
            <FieldError id="e-email">{errores.campos.email}</FieldError>
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
              aria-describedby={errores.campos.phone ? "e-phone" : "ayuda-phone"}
            />
            {errores.campos.phone ? (
              <FieldError id="e-phone">{errores.campos.phone}</FieldError>
            ) : (
              // RF-05: el teléfono es obligatorio porque es el canal por el
              // que se coordina la venta. Decir para qué sirve evita que
              // parezca un dato que pedimos porque sí.
              <FieldHint id="ayuda-phone">
                Por acá coordinamos la entrega y el pago.
              </FieldHint>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              aria-invalid={!!errores.campos.password || undefined}
              aria-describedby={
                errores.campos.password ? "e-password" : "ayuda-password"
              }
            />
            {errores.campos.password ? (
              <FieldError id="e-password">{errores.campos.password}</FieldError>
            ) : (
              <FieldHint id="ayuda-password">Al menos 8 caracteres.</FieldHint>
            )}
          </div>

          <FieldError>{errores.general}</FieldError>

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            loading={enviando}
            loadingLabel="Creando la cuenta"
          >
            Crear cuenta
          </Button>

          <p className="text-center text-body-sm text-ink-secondary">
            ¿Ya tenés cuenta?{" "}
            <Link
              href={volver ? `/ingresar?volver=${encodeURIComponent(volver)}` : "/ingresar"}
              className="rounded-pill text-ink underline underline-offset-4"
            >
              Ingresá
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
