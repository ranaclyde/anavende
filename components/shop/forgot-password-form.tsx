"use client";

import Link from "next/link";
import { useState } from "react";

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
import { createClient } from "@/lib/supabase/client";

/**
 * Pedido de recuperación de contraseña (RF-05).
 *
 * PENDIENTE F1.7 / F5.1: paso por Server Action con Zod. Depende de F0.11:
 * sin Resend como SMTP, el email no llega.
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const pedirEnlace = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/confirmar?next=/recuperar/nueva-contrasena`,
    });

    if (error) {
      setError("No pudimos mandar el email. Probá de nuevo en un momento.");
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

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            loading={enviando}
            loadingLabel="Mandando el email"
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
