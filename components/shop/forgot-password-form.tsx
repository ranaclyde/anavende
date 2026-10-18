"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { pedirRecuperacion } from "@/modules/users/actions";

/**
 * Pedido de recuperación de contraseña (RF-05).
 *
 * Pasa por `pedirRecuperacion`, en el servidor (F10.5): la respuesta es la
 * misma haya o no una cuenta con ese email (RF-06).
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // F10.5b: el token de Turnstile, uno por envío.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const turnstile = useRef<ControlDeTurnstile>(null);
  const idDelAviso = useId();
  const faltaCaptcha = TURNSTILE_ACTIVO && !captcha;

  const pedirEnlace = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const r = await pedirRecuperacion({
      email,
      captcha: captcha ?? undefined,
    });
    turnstile.current?.reiniciar();

    if (!r.ok) {
      setError(r.message);
      setEnviando(false);
      return;
    }

    setEnviado(true);
    setEnviando(false);
  };

  if (enviado) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Revisá tu email</CardTitle>
          <CardDescription>Te mandamos el enlace para cambiarla</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-body-sm text-ink-secondary">
            Si hay una cuenta con <span className="text-ink">{email}</span>, ahí
            va a estar el enlace. Si no lo ves, fijate en el correo no deseado.
          </p>
          <Button asChild variant="tertiary" size="lg">
            <Link href="/ingresar">Volver a ingresar</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recuperá tu contraseña</CardTitle>
        <CardDescription>
          Escribí tu email y te mandamos un enlace para cambiarla
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={pedirEnlace} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <FieldError>{error}</FieldError>

          <Turnstile
            accion="recuperacion"
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
            loadingLabel="Mandando el email"
            disabled={faltaCaptcha}
            aria-describedby={faltaCaptcha ? idDelAviso : undefined}
          >
            Mandame el enlace
          </Button>

          <p className="text-center text-body-sm text-ink-secondary">
            ¿Te acordaste?{" "}
            <Link
              href="/ingresar"
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
