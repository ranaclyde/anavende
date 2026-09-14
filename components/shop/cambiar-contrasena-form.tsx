"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { cambiarContrasena } from "@/modules/users/actions";

type Campo = "actual" | "nueva" | "repetida";

/**
 * Cambiar la contraseña, o definirla — RF-07, RF-06. Tarea F5.2.
 *
 * Quien ya tiene una la cambia **dando la actual**: la sesión sola no alcanza,
 * porque cualquiera que encuentre la cuenta abierta en otro dispositivo podría
 * dejar a la dueña afuera. Quien entró solo por Google o Facebook no tiene
 * ninguna que dar, y la define (RF-06).
 */
export function CambiarContrasenaForm({
  email,
  tieneContrasena,
}: {
  email: string;
  tieneContrasena: boolean;
}) {
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  // El texto se fija al guardar: definirla da vuelta `tieneContrasena` —la
  // página se refresca y pasa a pedir la actual— y un mensaje calculado en
  // cada render diría «cambiamos» a quien recién la definió.
  const [listo, setListo] = useState<string | null>(null);
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");

  // La confirmación es la única que se valida mientras se escribe (§6.6).
  const noCoinciden = repetida.length > 0 && nueva !== repetida;
  const errorRepetida = noCoinciden
    ? "Las dos contraseñas tienen que ser iguales."
    : errores.campos.repetida;

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formulario = e.currentTarget;
    const datos = new FormData(formulario);
    setErrores(SIN_ERRORES);
    setListo(null);

    iniciar(async () => {
      const r = await cambiarContrasena({
        actual: tieneContrasena ? String(datos.get("actual") ?? "") : undefined,
        nueva,
        repetida,
      });

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      // Una contraseña no se deja escrita en pantalla después de guardarla.
      formulario.reset();
      setNueva("");
      setRepetida("");
      setListo(
        tieneContrasena
          ? "Listo, cambiamos tu contraseña."
          : "Listo. Ya podés entrar también con tu email.",
      );
    });
  };

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      {/* Para que el gestor de contraseñas sepa de qué cuenta es la nueva. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />

      {tieneContrasena && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="actual">Contraseña actual</Label>
          <Input
            id="actual"
            name="actual"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={!!errores.campos.actual || undefined}
          />
          {errores.campos.actual ? (
            <FieldError>{errores.campos.actual}</FieldError>
          ) : (
            <FieldHint>
              ¿No la recordás?{" "}
              <Link
                href="/recuperar"
                className="text-ink underline underline-offset-2"
              >
                Te mandamos un enlace para crear otra
              </Link>
            </FieldHint>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="nueva">
          {tieneContrasena ? "Contraseña nueva" : "Contraseña"}
        </Label>
        <Input
          id="nueva"
          name="nueva"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={!!errores.campos.nueva || undefined}
          aria-describedby="nueva-ayuda"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        {errores.campos.nueva ? (
          <FieldError id="nueva-ayuda">{errores.campos.nueva}</FieldError>
        ) : (
          <FieldHint id="nueva-ayuda">Al menos 8 caracteres.</FieldHint>
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
          aria-invalid={!!errorRepetida || undefined}
          aria-describedby={errorRepetida ? "repetida-error" : undefined}
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
        />
        <FieldError id="repetida-error">{errorRepetida}</FieldError>
      </div>

      <FieldError>{errores.general}</FieldError>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto"
          loading={guardando}
          loadingLabel="Guardando"
        >
          {tieneContrasena ? "Cambiar contraseña" : "Definir contraseña"}
        </Button>
        {listo && (
          <p role="status" className="text-body-sm text-success">
            {listo}
          </p>
        )}
      </div>
    </form>
  );
}
