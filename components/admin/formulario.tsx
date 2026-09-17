"use client";

import { useId } from "react";

import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Las tres piezas con las que se arma un formulario del panel — DR §6.6.
 *
 * Salieron de la orden manual (F7.4), que fue el primer formulario largo del
 * panel, y viven acá desde F7.6, que es el segundo: dos copias de «cómo se ve
 * un campo con su error» son dos copias que un día dejan de parecerse.
 */

export function Seccion({
  titulo,
  ayuda,
  children,
}: {
  titulo: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-body-sm font-medium text-ink">{titulo}</h2>
        {ayuda ? (
          <p className="text-caption text-ink-secondary">{ayuda}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

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
