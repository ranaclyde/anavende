"use client";

import { useId } from "react";

import { Campo } from "@/components/admin/formulario";
import { FieldError } from "@/components/ui/field-error";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  LOCALIDADES,
  OTRA_LOCALIDAD,
  PROVINCIAS_DE_LA_ZONA,
} from "@/modules/users/direcciones/constantes";

/**
 * No reusa el formulario de direcciones del comprador, a propósito: aquél es
 * un `<form>` con su propio envío; esto es parte de otro formulario.
 */

export type ValoresDeDireccion = {
  recipientName: string;
  phone: string;
  street: string;
  number: string;
  apartment: string;
  localidad: string;
  otraLocalidad: string;
  provinciaDeOtra: string;
  notes: string;
};

export function CamposDeDireccion({
  valores,
  alCambiar,
  errores,
  idBase,
}: {
  valores: ValoresDeDireccion;
  alCambiar: (cambios: Partial<ValoresDeDireccion>) => void;
  errores: Partial<Record<string, string>>;
  /** Prefijo de los `id`, para que el formulario sepa a quién enfocar. */
  idBase?: string;
}) {
  const propio = useId();
  const base = idBase ?? propio;
  const esOtra = valores.localidad === OTRA_LOCALIDAD;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Recibe"
          valor={valores.recipientName}
          alCambiar={(v) => alCambiar({ recipientName: v })}
          error={errores.recipientName}
          id={`${base}-recipientName`}
        />
        <Campo
          etiqueta="Teléfono de quien recibe"
          valor={valores.phone}
          alCambiar={(v) => alCambiar({ phone: v })}
          error={errores.phone}
          id={`${base}-phone`}
          type="tel"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
        <Campo
          etiqueta="Calle"
          valor={valores.street}
          alCambiar={(v) => alCambiar({ street: v })}
          error={errores.street}
          id={`${base}-street`}
        />
        <Campo
          etiqueta="Altura"
          valor={valores.number}
          alCambiar={(v) => alCambiar({ number: v })}
          error={errores.number}
          id={`${base}-number`}
        />
        <Campo
          etiqueta="Piso / depto."
          valor={valores.apartment}
          alCambiar={(v) => alCambiar({ apartment: v })}
          error={errores.apartment}
          id={`${base}-apartment`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Elegir
          etiqueta="Localidad"
          valor={valores.localidad}
          alCambiar={(v) => alCambiar({ localidad: v })}
          error={errores.localidad}
          id={`${base}-localidad`}
        >
          {LOCALIDADES.map((l) => (
            <option key={l.nombre} value={l.nombre}>
              {l.nombre}
            </option>
          ))}
          <option value={OTRA_LOCALIDAD}>Otra localidad cercana</option>
        </Elegir>

        {esOtra ? (
          <>
            <Campo
              etiqueta="¿Cuál?"
              valor={valores.otraLocalidad}
              alCambiar={(v) => alCambiar({ otraLocalidad: v })}
              error={errores.otraLocalidad}
              id={`${base}-otraLocalidad`}
            />
            <Elegir
              etiqueta="Provincia"
              valor={valores.provinciaDeOtra}
              alCambiar={(v) => alCambiar({ provinciaDeOtra: v })}
              error={errores.provinciaDeOtra}
              id={`${base}-provinciaDeOtra`}
            >
              <option value="">Elegí una</option>
              {PROVINCIAS_DE_LA_ZONA.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Elegir>
          </>
        ) : null}
      </div>

      <Campo
        etiqueta="Referencias (opcional)"
        valor={valores.notes}
        alCambiar={(v) => alCambiar({ notes: v })}
        error={errores.notes}
        id={`${base}-notes`}
      />
    </div>
  );
}

function Elegir({
  etiqueta,
  valor,
  alCambiar,
  error,
  children,
  id,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const propio = useId();
  const idCampo = id ?? propio;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={idCampo}>{etiqueta}</Label>
      <Select
        id={idCampo}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${idCampo}-error` : undefined}
      >
        {children}
      </Select>
      <FieldError id={`${idCampo}-error`}>{error}</FieldError>
    </div>
  );
}

/** En el orden en que se leen: el formulario enfoca el primero que falló. */
export const CAMPOS_DE_DIRECCION = [
  "recipientName",
  "phone",
  "street",
  "number",
  "apartment",
  "localidad",
  "otraLocalidad",
  "provinciaDeOtra",
  "notes",
] as const;
