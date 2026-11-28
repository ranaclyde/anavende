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
import { definirContrasena } from "@/modules/users/actions";

type Campo = "nueva" | "repetida";

/**
 * Definición de una contraseña nueva (RF-05). También es el destino del email
 * E3, cuando la administradora crea una cuenta desde el panel (RF-30).
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [repetida, setRepetida] = useState("");
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [enviando, iniciar] = useTransition();
  const router = useRouter();

  const noCoinciden = repetida.length > 0 && password !== repetida;
  const errorRepetida = noCoinciden
    ? "Las dos contraseñas tienen que ser iguales."
    : errores.campos.repetida;

  const guardar = (e: React.FormEvent) => {
    e.preventDefault();
    setErrores(SIN_ERRORES);

    iniciar(async () => {
      const r = await definirContrasena({ nueva: password, repetida });

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      router.push("/mi-cuenta?contrasena=nueva");
      router.refresh();
    });
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
              aria-invalid={errores.campos.nueva ? true : undefined}
              aria-describedby={
                errores.campos.nueva ? "password-error" : "password-ayuda"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errores.campos.nueva ? (
              <FieldError id="password-error">
                {errores.campos.nueva}
              </FieldError>
            ) : (
              <FieldHint id="password-ayuda">Al menos 8 caracteres.</FieldHint>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="repetida">Repetila</Label>
            <Input
              id="repetida"
              name="repetida"
              type="password"
              autoComplete="new-password"
              required
              aria-invalid={errorRepetida ? true : undefined}
              aria-describedby={errorRepetida ? "repetida-error" : undefined}
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
            />
            {errorRepetida && (
              <FieldError id="repetida-error">{errorRepetida}</FieldError>
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
            Guardar contraseña
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
