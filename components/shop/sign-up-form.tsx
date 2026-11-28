"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { ProveedoresSociales } from "@/components/shop/proveedores-sociales";
import {
  Turnstile,
  TURNSTILE_ACTIVO,
  type ControlDeTurnstile,
} from "@/components/shop/turnstile";
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
import { readErrors, NO_ERRORS, type FormErrors } from "@/lib/form";
import { registrar } from "@/modules/users/actions";
import type { ProveedorSocial } from "@/modules/users/proveedores";

type Campo = "firstName" | "lastName" | "email" | "phone" | "password";

/**
 * Alta de cuenta (RF-05). Va a una Server Action y no al `signUp` del
 * cliente: el alta tiene que poder compensarse si falla a mitad (TS §13.4).
 */
export function SignUpForm({
  volver,
  proveedores,
}: {
  volver?: string;
  proveedores: readonly ProveedorSocial[];
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] = useState<FormErrors<Campo>>(NO_ERRORS);

  // El token de Turnstile, uno por envío.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const turnstile = useRef<ControlDeTurnstile>(null);
  const idDelAviso = useId();
  const faltaCaptcha = TURNSTILE_ACTIVO && !captcha;

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setErrores(NO_ERRORS);

    iniciar(async () => {
      const r = await registrar({
        firstName: String(datos.get("firstName") ?? ""),
        lastName: String(datos.get("lastName") ?? ""),
        email: String(datos.get("email") ?? ""),
        phone: String(datos.get("phone") ?? ""),
        password: String(datos.get("password") ?? ""),
        // Para que el enlace del email devuelva a la ficha y no a «Mi cuenta».
        volver,
        captcha: captcha ?? undefined,
      });
      turnstile.current?.reiniciar();

      if (!r.ok) {
        setErrores(readErrors<Campo>(r));
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
        <ProveedoresSociales
          volver={volver}
          accion="registro"
          disponibles={proveedores}
        />

        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          {/* Dos campos: hace falta el nombre de pila para saludar en los emails. */}
          <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="firstName">Nombre</Label>
              <Input
                id="firstName"
                name="firstName"
                autoComplete="given-name"
                required
                aria-invalid={!!errores.fields.firstName || undefined}
                aria-describedby={
                  errores.fields.firstName ? "e-firstName" : undefined
                }
              />
              <FieldError id="e-firstName">
                {errores.fields.firstName}
              </FieldError>
            </div>

            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="lastName">Apellido</Label>
              <Input
                id="lastName"
                name="lastName"
                autoComplete="family-name"
                required
                aria-invalid={!!errores.fields.lastName || undefined}
                aria-describedby={
                  errores.fields.lastName ? "e-lastName" : undefined
                }
              />
              <FieldError id="e-lastName">{errores.fields.lastName}</FieldError>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={!!errores.fields.email || undefined}
              aria-describedby={errores.fields.email ? "e-email" : undefined}
            />
            <FieldError id="e-email">{errores.fields.email}</FieldError>
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
              aria-describedby={
                errores.fields.phone ? "e-phone" : "ayuda-phone"
              }
            />
            {errores.fields.phone ? (
              <FieldError id="e-phone">{errores.fields.phone}</FieldError>
            ) : (
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
              aria-invalid={!!errores.fields.password || undefined}
              aria-describedby={
                errores.fields.password ? "e-password" : "ayuda-password"
              }
            />
            {errores.fields.password ? (
              <FieldError id="e-password">{errores.fields.password}</FieldError>
            ) : (
              <FieldHint id="ayuda-password">Al menos 8 caracteres.</FieldHint>
            )}
          </div>

          <FieldError>{errores.general}</FieldError>

          <Turnstile
            accion="alta"
            ref={turnstile}
            onToken={setCaptcha}
            idDelAviso={idDelAviso}
          />

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            loading={enviando}
            loadingLabel="Creando la cuenta"
            disabled={faltaCaptcha}
            aria-describedby={faltaCaptcha ? idDelAviso : undefined}
          >
            Crear cuenta
          </Button>

          <p className="text-center text-body-sm text-ink-secondary">
            ¿Ya tenés cuenta?{" "}
            <Link
              href={
                volver
                  ? `/ingresar?volver=${encodeURIComponent(volver)}`
                  : "/ingresar"
              }
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
