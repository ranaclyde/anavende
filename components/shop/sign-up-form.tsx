"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { FieldHint, Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Alta de cuenta con email y contraseña.
 *
 * PENDIENTE F1.7b / F1.9 / F5.1: falta el teléfono obligatorio (RF-05), la
 * creación compensada del perfil, Google y Facebook, y el paso por Server
 * Action con Zod. Sin F0.11 (Resend como SMTP) el email de verificación no
 * llega, así que esta pantalla no se puede dar por probada.
 */
export function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  const noCoinciden = repetida.length > 0 && password !== repetida;

  const registrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== repetida) {
      setError("Las dos contraseñas tienen que ser iguales.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/confirmar?next=/mi-cuenta`,
      },
    });

    if (error) {
      setError("No pudimos crear la cuenta. Probá de nuevo en un momento.");
      setEnviando(false);
      return;
    }

    router.push("/registro/verificar");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Creá tu cuenta</CardTitle>
        <CardDescription>
          Te sirve para guardar el carrito y seguir tus compras
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={registrar} className="flex flex-col gap-5" noValidate>
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              aria-describedby="password-ayuda"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <FieldHint id="password-ayuda">Al menos 8 caracteres.</FieldHint>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="repetida">Repetí la contraseña</Label>
            <Input
              id="repetida"
              name="repetida"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={noCoinciden || undefined}
              aria-describedby={noCoinciden ? "repetida-error" : undefined}
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
            {/* La confirmación de contraseña es la única excepción a validar
                al salir del campo y no mientras se escribe (§6.6). */}
            {noCoinciden && (
              <FieldError id="repetida-error">
                Las dos contraseñas tienen que ser iguales.
              </FieldError>
            )}
          </div>

          <FieldError>{error}</FieldError>

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
