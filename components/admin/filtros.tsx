"use client";

import { Search, X } from "lucide-react";
import { useId, useRef } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * El campo de búsqueda de los listados del panel — DR §6.2.1.
 *
 * El texto lo gobierna quien lo usa: «Limpiar todo» de la barra también lo
 * borra.
 */
export function BuscadorDelPanel({
  etiqueta,
  marcador,
  texto,
  alEscribir,
  alBuscar,
}: {
  /** Lo que lee un lector de pantalla. Dice por qué campos busca. */
  etiqueta: string;
  /** El marcador visible. Termina en «…» porque la frase sigue al escribir. */
  marcador: string;
  texto: string;
  alEscribir: (texto: string) => void;
  /** Se llama al enviar y al limpiar (con `""`), ya recortado. */
  alBuscar: (texto: string) => void;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        alBuscar(texto.trim());
      }}
      className="relative min-w-0 flex-1 md:min-w-64"
    >
      <label htmlFor={id} className="sr-only">
        {etiqueta}
      </label>

      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-tertiary"
      />

      <Input
        id={id}
        ref={campo}
        type="search"
        value={texto}
        onChange={(e) => alEscribir(e.target.value)}
        placeholder={marcador}
        className={cn(
          "pl-9 admin:pl-9",
          texto ? "pr-10 admin:pr-10 max-md:pr-12 admin:max-md:pr-12" : "",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />

      {texto === "" ? null : (
        <button
          type="button"
          onClick={() => {
            alEscribir("");
            // El foco vuelve al campo: el botón que se acaba de tocar deja de
            // existir y el foco se caería al `<body>`.
            campo.current?.focus();
            alBuscar("");
          }}
          className={cn(
            // 44px en el teléfono.
            "absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center max-md:right-0 max-md:size-11",
            "rounded-panel-control text-ink-tertiary transition-colors duration-150",
            "hover:bg-surface-sunken hover:text-ink",
          )}
        >
          <X aria-hidden className="size-4" />
          <span className="sr-only">Limpiar la búsqueda</span>
        </button>
      )}

      {/* Envío explícito para que el lector de pantalla sepa cómo se manda. */}
      <button type="submit" className="sr-only">
        Buscar
      </button>
    </form>
  );
}

/** El rango de fechas de los listados — DR §6.2.1. */
export function RangoDeFechas({
  desde,
  hasta,
  alCambiar,
  porQueFecha,
}: {
  desde: string;
  hasta: string;
  alCambiar: (cambio: { desde: string } | { hasta: string }) => void;
  /**
   * Qué fecha se está recortando, cuando depende de la solapa: en órdenes
   * finalizadas, la de entrega y no la de carga.
   */
  porQueFecha?: string;
}) {
  const id = useId();

  return (
    // En el teléfono, las dos fechas lado a lado y no apiladas.
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-row sm:items-center">
      <Campo
        id={`${id}-desde`}
        etiqueta="Desde"
        ayuda={porQueFecha}
        valor={desde}
        alCambiar={(v) => alCambiar({ desde: v })}
      />
      <Campo
        id={`${id}-hasta`}
        etiqueta="Hasta"
        valor={hasta}
        alCambiar={(v) => alCambiar({ hasta: v })}
      />

      {porQueFecha ? (
        <p className="col-span-2 text-caption text-ink-secondary sm:ml-1">
          Por {porQueFecha}
        </p>
      ) : null}
    </div>
  );
}

function Campo({
  id,
  etiqueta,
  ayuda,
  valor,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  ayuda?: string;
  valor: string;
  alCambiar: (valor: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <label
        htmlFor={id}
        title={ayuda ? `Por ${ayuda}` : undefined}
        className="shrink-0 text-body-sm text-ink-secondary"
      >
        {etiqueta}
      </label>
      <Input
        id={id}
        type="date"
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        className="min-w-0 sm:w-40"
      />
    </div>
  );
}

/** Cuántos quedaron, anunciado — DR §6.2.1. */
export function ContadorDeResultados({
  pendiente,
  children,
}: {
  pendiente: boolean;
  /** El número ya redactado: «12 productos», «3 de 40». */
  children: React.ReactNode;
}) {
  return (
    <p
      aria-live="polite"
      // Sin `opacity` mientras busca: bajaba el contraste a 2,6:1.
      className="text-body-sm text-ink-secondary"
    >
      {pendiente ? "Buscando…" : children}
    </p>
  );
}
