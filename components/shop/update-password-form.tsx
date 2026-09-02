"use client";

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
 * Definición de una contraseña nueva (RF-05).
 * También es el destino del email E3, cuando la administradora crea una
 * cuenta desde el panel (RF-30, F9.4).
 *
 * PENDIENTE F1.7 / F5.1: paso por Server Action con Zod.
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const router = useRouter();

  const noCoinciden = repetida.length > 0 && password !== repetida;

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== repetida) {
      setError("Las dos contraseñas tienen que ser iguales.");
      return;
    }

    setEnviando(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError("No pudimos guardar la contraseña. Probá de nuevo.");
      setEnviando(false);
      return;
    }

    router.push("/mi-cuenta");
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Definí tu contraseña</CardTitle>
        <CardDescription>
          Elegí una nueva y quedás dentro de tu cuenta
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={guardar} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña nueva</Label>
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
            <Label htmlFor="repetida">Repetila</Label>
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
            loadingLabel="Guardando"
          >
            Guardar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
