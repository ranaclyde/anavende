import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Tabla del panel (DR §6.9), solo la variante de escritorio: en el teléfono
 * cada pantalla la pasa a tarjetas.
 */
function Table({
  className,
  conTope = true,
  deslizable,
  ...props
}: React.ComponentProps<"table"> & {
  /**
   * `false` en una tabla corta que no es el listado de la pantalla: con el
   * tope tendría su propia barra de scroll dentro de una página que scrollea.
   */
  conTope?: boolean;
  /**
   * Nombre de una tabla que puede quedar más ancha que la pantalla y no tiene
   * nada que tome el foco: sin esto no se desliza con el teclado (WCAG 2.1.1).
   */
  deslizable?: string;
}) {
  return (
    // Este div tiene que scrollear, con tope de alto: `sticky` se fija al
    // ancestro que scrollea, y si no es este la cabecera se va con la página.
    // Las `20rem` están medidas contra el peor caso (DR §6.9).
    <div
      className={cn(
        "relative w-full overflow-auto",
        conTope && "max-h-[calc(100svh-20rem)]",
      )}
      {...(deslizable
        ? { role: "region", "aria-label": deslizable, tabIndex: 0 }
        : {})}
    >
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
      // Opaca y por encima: las filas pasan por debajo.
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
