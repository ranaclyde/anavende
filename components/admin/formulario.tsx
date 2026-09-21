"use client";

import { useId } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Mismo patrón que el checkout (F6.1): un radio de verdad, y la tarjeta es la etiqueta. */
export function Opcion({
  nombre,
  elegida,
  alElegir,
  titulo,
  detalle,
}: {
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

export function Campo({
  etiqueta,
  valor,
  alCambiar,
  error,
  ayuda,
  ...resto
}: {
  etiqueta: string;
  valor: string;
  alCambiar: (v: string) => void;
  error?: string;
  ayuda?: string;
} & React.ComponentProps<typeof Input>) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input
        id={id}
        value={valor}
        onChange={(ev) => alCambiar(ev.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={ayuda ? `${id}-ayuda` : undefined}
        {...resto}
      />
      {ayuda && !error ? (
        <p id={`${id}-ayuda`} className="text-caption text-ink-tertiary">
          {ayuda}
        </p>
      ) : null}
      <FieldError>{error}</FieldError>
    </div>
  );
}
