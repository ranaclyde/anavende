"use client";

import { useId } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Mismo patrón que el checkout (F6.1): un radio de verdad, y la tarjeta es la
 * etiqueta.
 *
 * **El `id` va al radio y no a la tarjeta**, por el mismo motivo que en
 * `Campo`: cuando el envío falla el foco tiene que poder aterrizar en la
 * primera opción del grupo que el servidor rechazó, y lo que se enfoca es el
 * control, no el envoltorio.
 */
export function Opcion({
  id,
  nombre,
  elegida,
  alElegir,
  titulo,
  detalle,
}: {
  id?: string;
  nombre: string;
  elegida: boolean;
  alElegir: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-2.5 rounded-panel-control border border-border bg-surface p-3",
        "transition-colors duration-150",
        "has-checked:border-brand has-checked:bg-brand-tint",
        "has-focus-visible:shadow-focus",
      )}
    >
      <input
        id={id}
        type="radio"
        name={nombre}
        checked={elegida}
        onChange={alElegir}
        className="mt-0.5 size-4 shrink-0 accent-brand"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body-sm font-medium text-ink">{titulo}</span>
        <span className="text-caption text-ink-secondary">{detalle}</span>
      </span>
    </label>
  );
}

/**
 * Un campo con su etiqueta, su ayuda y su error.
 *
 * **El `id` se puede imponer desde afuera** y no es un capricho: quien arma
 * el formulario necesita poder llevar el foco al primer campo que falló, y
 * para eso tiene que saber cómo se llama antes de que el campo exista. Sin
 * `id`, se genera uno y el campo funciona igual.
 *
 * **`aria-describedby` apunta al error cuando lo hay**, y a la ayuda cuando
 * no. Hasta hoy apuntaba siempre a la ayuda, así que el lector de pantalla
 * leía la sugerencia de cómo escribir el teléfono y no el motivo por el que
 * ese teléfono fue rechazado: la ayuda se esconde cuando hay error, y la
 * descripción seguía nombrándola.
 */
export function Campo({
  etiqueta,
  valor,
  alCambiar,
  error,
  ayuda,
  id,
  ...resto
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string;
  ayuda?: string;
} & React.ComponentProps<typeof Input>) {
  const propio = useId();
  const idCampo = id ?? propio;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={idCampo}>{etiqueta}</Label>
      <Input
        id={idCampo}
        value={valor}
        onChange={(ev) => alCambiar(ev.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error ? `${idCampo}-error` : ayuda ? `${idCampo}-ayuda` : undefined
        }
        {...resto}
      />
      {ayuda && !error ? (
        <p id={`${idCampo}-ayuda`} className="text-caption text-ink-tertiary">
          {ayuda}
        </p>
      ) : null}
      <FieldError id={`${idCampo}-error`}>{error}</FieldError>
    </div>
  );
}
