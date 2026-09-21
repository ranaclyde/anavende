import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tabla del panel — DESIGN-REFERENCE §6.9.
 * Fila de 44px, cabecera fija en versalitas sobre `--surface-sunken`,
 * separador de 1px, números tabulares a la derecha.
 *
 * En móvil las tablas se vuelven TARJETAS, no scroll horizontal: una tabla
 * de siete columnas en un teléfono es inoperable. Ese cambio lo decide cada
 * pantalla (F7.1), no este componente; acá solo se define la variante de
 * escritorio.
 */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    // **Este div es el que scrollea, y por eso existe el tope de alto.**
    // `sticky` se fija dentro del ancestro que scrollea, y hasta el
    // 2026-09-21 ése era este mismo div, que no scrolleaba nunca: la página
    // se deslizaba por debajo y se llevaba la cabecera puesta. Medido en
    // `/admin/productos` con 26 filas: al scrollear 600px la cabecera
    // terminaba en y=−398. En órdenes y usuarios *parecía* andar, pero sólo
    // porque con diez filas la página apenas scrollea 163px.
    //
    // El tope deja la tabla del alto de lo que queda de ventana, así que el
    // encabezado, los filtros y la paginación no se van nunca de la pantalla
    // y la página deja de medir 1760px. Cuando la tabla es corta no muerde.
    //
    // **Las `20rem` están medidas contra el peor caso**, que es órdenes o
    // usuarios —encabezado, solapas, barra de filtros, contador y paginación
    // a la vez— en una ventana de 700px. Ahí 19rem dejaban la página
    // scrolleando 11px, que es justo lo que este tope viene a evitar; con 20
    // sobran 5. Cuesta una fila: siete en vez de ocho a 700px, doce a 900.
    <div className="relative max-h-[calc(100svh-20rem)] w-full overflow-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom border-collapse", className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      // Opaca y por encima de las filas, que es lo que la hace legible
      // mientras el resto pasa por debajo.
      className={cn("sticky top-0 z-10 bg-surface-sunken", className)}
      {...props}
    />
  );
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return <tbody data-slot="table-body" className={className} {...props} />;
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "h-11 border-b border-border transition-colors duration-150",
        "hover:bg-surface-sunken",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-9 px-3 text-left align-middle",
        "text-caption font-medium tracking-wide text-ink-secondary uppercase",
        // Los números van a la derecha y tabulares (§6.9).
        "data-[align=right]:text-right data-[align=right]:tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2 align-middle text-body-sm text-ink",
        "data-[align=right]:text-right data-[align=right]:tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 text-caption text-ink-secondary", className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
