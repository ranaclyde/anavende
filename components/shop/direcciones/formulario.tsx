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
  LOCALIDADES,
  OTRA_LOCALIDAD,
  PROVINCIAS_DE_LA_ZONA,
} from "@/modules/users/direcciones/constantes";

type Campo =
  | "label"
  | "recipientName"
  | "phone"
  | "street"
  | "number"
  | "apartment"
  | "localidad"
  | "otraLocalidad"
  | "provinciaDeOtra"
  | "notes";

export type ValoresDeDireccion = Record<Campo, string>;

/**
 * Cargar o editar una dirección — RF-09. Tarea F5.3.
 *
 * El mismo formulario para las dos cosas, y el que va a usar el checkout
 * cuando se cargue una dirección nueva desde ahí (RF-11, F6.1).
 *
 * **La localidad es una lista, y no hay provincia ni código postal**
 * (2026-09-13): se entrega en Viedma, Carmen de Patagones y alrededores
 * (RN-10), y los dos datos se deducen de la localidad. Solo «Otra localidad
 * cercana» pide nombre y provincia.
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
  // Controlada solo para mostrar u ocultar los campos de «Otra».
  const [localidad, setLocalidad] = useState(inicial.localidad);
  const esOtra = localidad === OTRA_LOCALIDAD;

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
      localidad,
      otraLocalidad: esOtra ? valor("otraLocalidad") : "",
      provinciaDeOtra: esOtra ? valor("provinciaDeOtra") : "",
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

      <div className="flex flex-col gap-2">
        <Label htmlFor="localidad">Localidad</Label>
        <Select
          id="localidad"
          name="localidad"
          value={localidad}
          onChange={(ev) => setLocalidad(ev.target.value)}
          aria-invalid={!!e.localidad || undefined}
        >
          <option value="" disabled>
            Elegí la localidad
          </option>
          {LOCALIDADES.map((l) => (
            <option key={l.nombre} value={l.nombre}>
              {l.nombre}
            </option>
          ))}
          <option value={OTRA_LOCALIDAD}>Otra localidad cercana</option>
        </Select>
        {e.localidad ? (
          <FieldError>{e.localidad}</FieldError>
        ) : (
          <FieldHint>Entregamos en Viedma, Carmen de Patagones y alrededores.</FieldHint>
        )}
      </div>

      {esOtra ? (
        <Fila>
          <CampoDeTexto
            nombre="otraLocalidad"
            etiqueta="Nombre de la localidad"
            valor={inicial.otraLocalidad}
            error={e.otraLocalidad}
            ayuda="La entrega se coordina con la vendedora por WhatsApp."
            autoComplete="address-level2"
          />
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="provinciaDeOtra">Provincia</Label>
            <Select
              id="provinciaDeOtra"
              name="provinciaDeOtra"
              defaultValue={inicial.provinciaDeOtra}
              aria-invalid={!!e.provinciaDeOtra || undefined}
            >
              <option value="" disabled>
                Elegí la provincia
              </option>
              {PROVINCIAS_DE_LA_ZONA.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <FieldError>{e.provinciaDeOtra}</FieldError>
          </div>
        </Fila>
      ) : null}

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
