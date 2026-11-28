"use client";

import { useId } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Un radio de verdad, y la tarjeta es la etiqueta. El `id` va al radio: es lo
 * que se enfoca cuando el servidor rechaza el grupo.
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
        // Lo elegido es pizarra y no burdeos, como la casilla marcada.
        "has-checked:border-accent has-checked:bg-accent-tint",
        "has-focus-visible:shadow-focus",
      )}
    >
      <input
        id={id}
        type="radio"
        name={nombre}
        checked={elegida}
        onChange={alElegir}
        className="mt-0.5 size-4 shrink-0 accent-accent"
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
 * El `id` se puede imponer desde afuera para llevar el foco al primer campo
 * que falló. `aria-describedby` apunta al error cuando lo hay, y a la ayuda
 * cuando no: la ayuda se esconde con error.
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
        <p id={`${idCampo}-ayuda`} className="text-caption text-ink-secondary">
          {ayuda}
        </p>
      ) : null}
      <FieldError id={`${idCampo}-error`}>{error}</FieldError>
    </div>
  );
}

/** Las secciones de un formulario del panel — DR §3.4.1. */
export function Secciones({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col divide-y divide-border *:py-6 *:first:pt-0 *:last:pb-0",
        className,
      )}
      {...props}
    />
  );
}

export function Seccion({
  titulo,
  descripcion,
  accion,
  children,
  ...props
}: {
  titulo?: string;
  descripcion?: React.ReactNode;
  /** Un botón a la derecha del título, como «Elegir». */
  accion?: React.ReactNode;
} & React.ComponentProps<"section">) {
  const idTitulo = useId();

  return (
    <section
      aria-labelledby={titulo ? idTitulo : undefined}
      className="flex flex-col gap-5"
      {...props}
    >
      {titulo ? (
        <div className="-mb-1 flex flex-col gap-1">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <h3 id={idTitulo} className="text-body-sm font-semibold text-ink">
              {titulo}
            </h3>
            {accion}
          </div>
          {descripcion ? (
            <p className="text-caption text-ink-secondary">{descripcion}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
