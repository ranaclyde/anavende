"use client";

import { useState, useTransition } from "react";

import { useCuentaEnPausa } from "@/components/shop/cuenta-en-pausa";
import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { guardarMisDatos } from "@/modules/users/actions";

type Campo = "firstName" | "lastName" | "phone";

/**
 * «Mis datos» — RF-07. Tarea F5.2.
 *
 * Nombre, apellido y teléfono, con las mismas reglas que el alta: el teléfono
 * no puede quedar vacío (RF-05), porque es el canal por el que se coordina la
 * venta. El email no se edita y lo dibuja la página, fuera del formulario.
 */
export function MisDatosForm({
  firstName,
  lastName,
  telefono,
}: {
  firstName: string;
  lastName: string;
  /** Sin el `+549`: así lo escribe la gente, y el esquema lo vuelve a poner. */
  telefono: string;
}) {
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [guardado, setGuardado] = useState(false);
  const enPausa = useCuentaEnPausa();

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setErrores(SIN_ERRORES);
    setGuardado(false);

    iniciar(async () => {
      const r = await guardarMisDatos({
        firstName: String(datos.get("firstName") ?? ""),
        lastName: String(datos.get("lastName") ?? ""),
        phone: String(datos.get("phone") ?? ""),
      });

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      setGuardado(true);
    });
  };

  return (
    <form
      onSubmit={enviar}
      // Un «Listo» que queda a la vista mientras se sigue escribiendo dice
      // que lo nuevo ya se guardó, y no es cierto.
      onChange={() => guardado && setGuardado(false)}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* Con la baja pedida (F5.8) los datos se ven y no se cambian. */}
      <fieldset
        disabled={enPausa}
        aria-describedby={enPausa ? ID_AVISO_DE_PAUSA : undefined}
        className="contents"
      >
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="firstName">Nombre</Label>
          <Input
            id="firstName"
            name="firstName"
            autoComplete="given-name"
            defaultValue={firstName}
            required
            aria-invalid={!!errores.campos.firstName || undefined}
          />
          <FieldError>{errores.campos.firstName}</FieldError>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="lastName">Apellido</Label>
          <Input
            id="lastName"
            name="lastName"
            autoComplete="family-name"
            defaultValue={lastName}
            required
            aria-invalid={!!errores.campos.lastName || undefined}
          />
          <FieldError>{errores.campos.lastName}</FieldError>
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
          defaultValue={telefono}
          required
          aria-invalid={!!errores.campos.phone || undefined}
        />
        {errores.campos.phone ? (
          <FieldError>{errores.campos.phone}</FieldError>
        ) : (
          <FieldHint>Por acá coordinamos la entrega y el pago.</FieldHint>
        )}
      </div>

      <FieldError>{errores.general}</FieldError>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full sm:w-auto"
          loading={guardando}
          loadingLabel="Guardando"
        >
          Guardar cambios
        </Button>
        {guardado && (
          <p role="status" className="text-body-sm text-success">
            Listo, guardamos tus datos.
          </p>
        )}
      </div>
      </fieldset>
    </form>
  );
}
