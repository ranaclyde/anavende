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
    <div className="relative w-full overflow-auto">
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
        "data-[clickable=true]:cursor-pointer",
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
