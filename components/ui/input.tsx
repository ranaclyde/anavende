import * as React from "react";

import { cn } from "@/lib/utils";

const CLASES_DEL_CAMPO = [
  "h-12 w-full rounded-pill border border-border bg-surface px-4 text-body text-ink",
  "transition-colors duration-150",
  "placeholder:text-ink-secondary",
  "focus:border-border-strong",
  "aria-invalid:border-danger",
  "disabled:cursor-not-allowed disabled:opacity-40",
  "file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-ink",
  "admin:h-10 admin:max-md:h-11 admin:rounded-panel-control admin:px-3 admin:text-body-sm",
];

/**
 * Campo de texto — DESIGN-REFERENCE §6.6.
 * 48px en la tienda, 40px en el panel. Píldora en la tienda, 8px en el panel.
 * El estado de error se marca con `aria-invalid`, que además lo anuncia
 * al lector de pantalla (§9).
 *
 * **Con `type="tel"` lleva la bandera y el +54 adentro, a la izquierda**
 * (2026-10-21): dice de qué país es el número sin que haya que explicarlo, y
 * deja claro que lo que falta escribir es la característica y el número.
 * Está acá y no en cada formulario para que ningún teléfono quede sin él.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  if (type === "tel") return <InputTelefono className={className} {...props} />;
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(...CLASES_DEL_CAMPO, className)}
      {...props}
    />
  );
}

/**
 * El `className` va a la caja y no al campo: quien lo pasa lo usa para el
 * ancho (`sm:max-w-64`), y el prefijo tiene que quedar adentro de ese ancho.
 *
 * El prefijo es `aria-hidden`: el lector de pantalla lee la etiqueta y lo
 * que se escribe, y «bandera de Argentina, más cincuenta y cuatro» antes de
 * cada número es ruido. Tampoco se envía: es parte del dibujo, no del valor.
 * Va escrito y no importado de `lib/telefono.ts`, que trae zod: este campo
 * está en todos los formularios.
 */
function InputTelefono({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <div className={cn("relative w-full", className)}>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-4 flex items-center gap-1.5 text-body text-ink-secondary admin:left-3 admin:text-body-sm"
      >
        <BanderaArgentina />
        +54
      </span>
      <input
        type="tel"
        inputMode="tel"
        data-slot="input"
        className={cn(...CLASES_DEL_CAMPO, "pl-20 admin:pl-[4.25rem]")}
        {...props}
      />
    </div>
  );
}

/**
 * Dibujada y no emoji: en Windows 🇦🇷 se ve como «AR» en dos letras. Las
 * franjas en celeste oficial y el sol como un punto, que a 20px es lo que
 * se distingue. El borde fino es para que la franja blanca no se pierda
 * contra el campo blanco.
 */
function BanderaArgentina() {
  return (
    <svg
      viewBox="0 0 20 14"
      className="h-3.5 w-5 shrink-0 rounded-[2px] ring-1 ring-border"
    >
      <rect width="20" height="14" fill="#fff" />
      <rect width="20" height="4.67" fill="#74acdf" />
      <rect y="9.33" width="20" height="4.67" fill="#74acdf" />
      <circle cx="10" cy="7" r="1.6" fill="#f6b40e" />
    </svg>
  );
}

/** Área de texto. Mismo contrato que Input, sin la píldora: es multilínea. */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-24 w-full rounded-image border border-border bg-surface px-4 py-3 text-body text-ink",
        "transition-colors duration-150 field-sizing-content",
        "placeholder:text-ink-secondary",
        "focus:border-border-strong",
        "aria-invalid:border-danger",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "admin:rounded-panel-control admin:px-3 admin:py-2 admin:text-body-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
