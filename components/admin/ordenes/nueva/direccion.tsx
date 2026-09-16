"use client";

import { useId } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  LOCALIDADES,
  OTRA_LOCALIDAD,
  PROVINCIAS_DE_LA_ZONA,
} from "@/modules/users/direcciones/constantes";

/**
 * La dirección de una orden manual — FS RF-24, RN-10. Tarea F7.4.
 *
 * **Son los campos de la libreta menos la etiqueta**: ésta no se guarda en
 * ninguna libreta, es el snapshot de a dónde fue este pedido. La localidad es
 * la misma lista cerrada de RN-10 —la vendedora no envía al resto del país— y
 * la provincia y el código postal se deducen de ella, como en F5.3.
 *
 * **No reusa el formulario del comprador** y no es un descuido: aquél es un
 * `<form>` entero con su propio envío, su validación y su «Guardar» contra la
 * libreta. Acá estos campos son una parte de otro formulario que se envía
 * junto con todo lo demás. Lo que sí se comparte es lo que importa que no se
 * desincronice: la lista de localidades y la regla que la valida.
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
}: {
  valores: ValoresDeDireccion;
  alCambiar: (cambios: Partial<ValoresDeDireccion>) => void;
  errores: Partial<Record<string, string>>;
}) {
  const esOtra = valores.localidad === OTRA_LOCALIDAD;

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo
          etiqueta="Recibe"
          valor={valores.recipientName}
          alCambiar={(v) => alCambiar({ recipientName: v })}
          error={errores.recipientName}
        />
        <Campo
          etiqueta="Teléfono de quien recibe"
          valor={valores.phone}
          alCambiar={(v) => alCambiar({ phone: v })}
          error={errores.phone}
          inputMode="tel"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem_8rem]">
        <Campo
          etiqueta="Calle"
          valor={valores.street}
          alCambiar={(v) => alCambiar({ street: v })}
          error={errores.street}
        />
        <Campo
          etiqueta="Altura"
          valor={valores.number}
          alCambiar={(v) => alCambiar({ number: v })}
          error={errores.number}
        />
        <Campo
          etiqueta="Piso / depto."
          valor={valores.apartment}
          alCambiar={(v) => alCambiar({ apartment: v })}
          error={errores.apartment}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Elegir
          etiqueta="Localidad"
          valor={valores.localidad}
          alCambiar={(v) => alCambiar({ localidad: v })}
          error={errores.localidad}
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
            />
            <Elegir
              etiqueta="Provincia"
              valor={valores.provinciaDeOtra}
              alCambiar={(v) => alCambiar({ provinciaDeOtra: v })}
              error={errores.provinciaDeOtra}
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
      />
    </div>
  );
}

function Campo({
  etiqueta,
  valor,
  alCambiar,
  error,
  ...resto
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string;
} & React.ComponentProps<typeof Input>) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined}
        {...resto}
      />
      <FieldError>{error}</FieldError>
    </div>
  );
}

function Elegir({
  etiqueta,
  valor,
  alCambiar,
  error,
  children,
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string;
  children: React.ReactNode;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Select
        id={id}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined}
      >
        {children}
      </Select>
      <FieldError>{error}</FieldError>
    </div>
  );
}
