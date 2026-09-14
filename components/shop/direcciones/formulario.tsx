"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input, Textarea } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { cn } from "@/lib/utils";
import {
  guardarCambiosDeDireccion,
  guardarDireccionNueva,
} from "@/modules/users/direcciones/actions";
import {
  PROVINCIAS,
  type Provincia,
} from "@/modules/users/direcciones/constantes";

type Campo =
  | "label"
  | "recipientName"
  | "phone"
  | "street"
  | "number"
  | "apartment"
  | "city"
  | "province"
  | "postalCode"
  | "notes";

export type ValoresDeDireccion = Record<Campo, string>;

/**
 * Cargar o editar una dirección — RF-09. Tarea F5.3.
 *
 * El mismo formulario para las dos cosas, y el que va a usar el checkout
 * cuando se cargue una dirección nueva desde ahí (RF-11, F6.1).
 *
 * Lo opcional se marca «(opcional)» y lo obligatorio no lleva nada (§6.6).
 * Cada campo lleva su `autoComplete`: el navegador ya sabe la dirección de
 * la persona, y escribirla de nuevo en un teléfono es lo que hace abandonar
 * un formulario.
 */
export function FormularioDeDireccion({
  id,
  inicial,
}: {
  /** Con id, edita esa dirección; sin id, carga una nueva. */
  id?: string;
  inicial: ValoresDeDireccion;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formulario = new FormData(e.currentTarget);
    const valor = (campo: Campo) => String(formulario.get(campo) ?? "");
    setErrores(SIN_ERRORES);

    const datos = {
      label: valor("label"),
      recipientName: valor("recipientName"),
      phone: valor("phone"),
      street: valor("street"),
      number: valor("number"),
      apartment: valor("apartment"),
      city: valor("city"),
      // El servidor la vuelve a validar contra la lista (§6.2): esto solo
      // le dice al compilador qué forma tiene.
      province: valor("province") as Provincia,
      postalCode: valor("postalCode"),
      notes: valor("notes"),
    };

    iniciar(async () => {
      const r = id
        ? await guardarCambiosDeDireccion({ id, ...datos })
        : await guardarDireccionNueva(datos);

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      router.push("/mi-cuenta/direcciones");
    });
  };

  const e = errores.campos;

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
      <CampoDeTexto
        nombre="label"
        etiqueta="Nombre de la dirección"
        valor={inicial.label}
        error={e.label}
        ayuda="Para reconocerla cuando elijas a dónde enviar: Casa, Trabajo…"
        placeholder="Casa"
      />

      <Fila>
        <CampoDeTexto
          nombre="recipientName"
          etiqueta="Quién la recibe"
          valor={inicial.recipientName}
          error={e.recipientName}
          autoComplete="name"
        />
        <CampoDeTexto
          nombre="phone"
          etiqueta="Teléfono"
          valor={inicial.phone}
          error={e.phone}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
        />
      </Fila>

      <Fila>
        <CampoDeTexto
          nombre="street"
          etiqueta="Calle"
          valor={inicial.street}
          error={e.street}
          autoComplete="address-line1"
        />
        <CampoDeTexto
          nombre="number"
          etiqueta="Altura"
          valor={inicial.number}
          error={e.number}
          className="sm:max-w-32"
          inputMode="numeric"
        />
      </Fila>

      <CampoDeTexto
        nombre="apartment"
        etiqueta="Piso o departamento (opcional)"
        valor={inicial.apartment}
        error={e.apartment}
        autoComplete="address-line2"
        placeholder="3° B"
      />

      <Fila>
        <CampoDeTexto
          nombre="city"
          etiqueta="Ciudad o localidad"
          valor={inicial.city}
          error={e.city}
          autoComplete="address-level2"
        />
        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="province">Provincia</Label>
          <Select
            id="province"
            name="province"
            autoComplete="address-level1"
            defaultValue={inicial.province}
            aria-invalid={!!e.province || undefined}
          >
            <option value="" disabled>
              Elegí la provincia
            </option>
            {PROVINCIAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <FieldError>{e.province}</FieldError>
        </div>
      </Fila>

      <CampoDeTexto
        nombre="postalCode"
        etiqueta="Código postal"
        valor={inicial.postalCode}
        error={e.postalCode}
        autoComplete="postal-code"
        className="sm:max-w-40"
        placeholder="8500"
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Referencias (opcional)</Label>
        <Textarea
          id="notes"
          name="notes"
          defaultValue={inicial.notes}
          maxLength={200}
          aria-invalid={!!e.notes || undefined}
        />
        {e.notes ? (
          <FieldError>{e.notes}</FieldError>
        ) : (
          <FieldHint>Entre qué calles, cómo es la casa, qué timbre tocar.</FieldHint>
        )}
      </div>

      <FieldError>{errores.general}</FieldError>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <Button
          type="submit"
          variant="brand"
          size="lg"
          className="w-full sm:w-auto"
          loading={guardando}
          loadingLabel="Guardando"
        >
          Guardar dirección
        </Button>
        <Button asChild variant="tertiary" size="lg">
          <Link href="/mi-cuenta/direcciones">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

/** Dos campos lado a lado desde `sm`; uno debajo del otro en el teléfono. */
function Fila({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">{children}</div>
  );
}

function CampoDeTexto({
  nombre,
  etiqueta,
  valor,
  error,
  ayuda,
  className,
  ...props
}: {
  nombre: Campo;
  etiqueta: string;
  valor: string;
  error?: string;
  ayuda?: string;
  className?: string;
} & Omit<React.ComponentProps<"input">, "name" | "defaultValue" | "id">) {
  return (
    <div className={cn("flex flex-1 flex-col gap-2", className)}>
      <Label htmlFor={nombre}>{etiqueta}</Label>
      <Input
        id={nombre}
        name={nombre}
        defaultValue={valor}
        aria-invalid={!!error || undefined}
        {...props}
      />
      {error ? (
        <FieldError>{error}</FieldError>
      ) : ayuda ? (
        <FieldHint>{ayuda}</FieldHint>
      ) : null}
    </div>
  );
}
