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
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

/**
 * Ingreso con email y contraseña.
 *
 * PENDIENTE F1.7 / F5.1: faltan Google y Facebook (RF-06), el motivo visible
 * del bloqueo (RF-27) y el paso por Server Action con validación de Zod en el
 * servidor. Lo que hay acá es la vía de contraseña, sobre el sistema de
 * diseño; la lógica se reemplaza cuando F0.11 y F0.12 estén verificadas.
 */
export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  const ingresar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // El mensaje del proveedor no se muestra: no distingue email inexistente
      // de contraseña incorrecta a propósito, y está en inglés.
      setError("Ese email y esa contraseña no coinciden. Probá de nuevo.");
      setEnviando(false);
      return;
    }

    router.push("/mi-cuenta");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresá a tu cuenta</CardTitle>
        <CardDescription>
          Para ver tus compras, tu carrito y tus favoritos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={ingresar} className="flex flex-col gap-5" noValidate>
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
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/recuperar"
                className="rounded-pill text-caption text-ink-secondary underline underline-offset-4 hover:text-ink"
              >
                ¿La olvidaste?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <FieldError>{error}</FieldError>

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            loading={enviando}
            loadingLabel="Ingresando"
          >
            Ingresar
          </Button>

          <p className="text-center text-body-sm text-ink-secondary">
            ¿Todavía no tenés cuenta?{" "}
            <Link
              href="/registro"
              className="rounded-pill text-ink underline underline-offset-4"
            >
              Creá una
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
