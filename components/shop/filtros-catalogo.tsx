import Link from "next/link";
import { X } from "lucide-react";

import {
  hayFiltrosDeTienda,
  urlCambiando,
  urlDeTienda,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import type { OpcionDeFiltro } from "@/modules/catalog/products/tienda";
import { cn } from "@/lib/utils";

/**
 * Filtros del catálogo — F3.4, §7.2.
 *
 * **Todo son enlaces, no controles.** Un filtro que es un `<a>` se puede abrir
 * en otra pestaña, se precarga al pasar por encima, funciona sin JavaScript y
 * —lo que más importa— deja el botón atrás haciendo exactamente lo que la
 * persona espera. Con casillas y estado de cliente habría que reimplementar
 * las cuatro cosas, y la cuarta nunca queda bien.
 */

type Props = {
  filtros: FiltrosDeTienda;
  categorias: OpcionDeFiltro[];
  marcas: OpcionDeFiltro[];
};

export function FiltrosDelCatalogo({ filtros, categorias, marcas }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <Grupo
        titulo="Categoría"
        opciones={categorias}
        seleccionado={filtros.categoria}
        urlDe={(id) => urlCambiando(filtros, { categoria: id })}
      />
      <Grupo
        titulo="Marca"
        opciones={marcas}
        seleccionado={filtros.marca}
        urlDe={(id) => urlCambiando(filtros, { marca: id })}
      />

      <div className="flex flex-col gap-2">
        <h3 className="text-body-sm font-semibold text-ink">Ofertas</h3>
        <Opcion
          href={urlCambiando(filtros, { oferta: !filtros.oferta })}
          activa={filtros.oferta}
          etiqueta="Solo con descuento"
        />
      </div>
    </div>
  );
}

function Grupo({
  titulo,
  opciones,
  seleccionado,
  urlDe,
}: {
  titulo: string;
  opciones: OpcionDeFiltro[];
  seleccionado: string;
  urlDe: (id: string) => string;
}) {
  if (opciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-body-sm font-semibold text-ink">{titulo}</h3>
      <ul className="flex flex-col gap-0.5">
        <li>
          <Opcion href={urlDe("")} activa={seleccionado === ""} etiqueta="Todas" />
        </li>
        {opciones.map((o) => (
          <li key={o.id}>
            <Opcion
              // Volver a tocar la opción vigente la quita: es el gesto que la
              // gente prueba, y si no hace nada parece que la pantalla se colgó.
              href={urlDe(seleccionado === o.id ? "" : o.id)}
              activa={seleccionado === o.id}
              etiqueta={o.nombre}
              cuantos={o.cuantos}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Opcion({
  href,
  activa,
  etiqueta,
  cuantos,
}: {
  href: string;
  activa: boolean;
  etiqueta: string;
  cuantos?: number;
}) {
  return (
    <Link
      href={href}
      // `aria-current` y no solo el color: §9 pide que el color nunca sea el
      // único portador de información, y un lector de pantalla no ve burdeos.
      aria-current={activa ? "true" : undefined}
      className={cn(
        "flex items-center justify-between gap-3 rounded-panel px-2 py-1.5",
        "text-body-sm transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        activa
          ? "bg-brand-tint font-medium text-brand"
          : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
      )}
    >
      <span className="min-w-0 truncate">{etiqueta}</span>
      {cuantos === undefined ? null : (
        <span className="shrink-0 text-caption text-ink-tertiary tabular-nums">
          {cuantos}
        </span>
      )}
    </Link>
  );
}

/**
 * Los filtros aplicados, como chips removibles arriba de la grilla (§7.2).
 *
 * Existe porque en móvil los filtros viven detrás de un botón: sin los chips,
 * la persona ve nueve resultados y **no tiene forma de saber por qué** son
 * nueve. El chip dice qué está puesto y lo saca de un toque.
 */
export function ChipsDeFiltros({
  filtros,
  categorias,
  marcas,
}: Props) {
  if (!hayFiltrosDeTienda(filtros)) return null;

  const puestos: { clave: string; etiqueta: string; href: string }[] = [];

  if (filtros.q) {
    puestos.push({
      clave: "q",
      etiqueta: `«${filtros.q}»`,
      href: urlCambiando(filtros, { q: "" }),
    });
  }

  const categoria = categorias.find((c) => c.id === filtros.categoria);
  if (categoria) {
    puestos.push({
      clave: "categoria",
      etiqueta: categoria.nombre,
      href: urlCambiando(filtros, { categoria: "" }),
    });
  }

  const marca = marcas.find((m) => m.id === filtros.marca);
  if (marca) {
    puestos.push({
      clave: "marca",
      etiqueta: marca.nombre,
      href: urlCambiando(filtros, { marca: "" }),
    });
  }

  if (filtros.oferta) {
    puestos.push({
      clave: "oferta",
      etiqueta: "Con descuento",
      href: urlCambiando(filtros, { oferta: false }),
    });
  }

  return (
    // `flex-wrap`: con cuatro filtros puestos en un teléfono, una fila sola
    // recortaría los últimos y esos valores dejarían de poder quitarse.
    <ul className="flex flex-wrap items-center gap-2">
      {puestos.map((p) => (
        <li key={p.clave}>
          <Link
            href={p.href}
            className="flex items-center gap-1.5 rounded-full bg-surface py-1.5 pr-2 pl-3 text-caption font-medium whitespace-nowrap text-ink shadow-md transition-colors duration-150 hover:text-brand focus-visible:shadow-focus focus-visible:outline-none"
          >
            {p.etiqueta}
            <X className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">Quitar este filtro</span>
          </Link>
        </li>
      ))}

      <li>
        <Link
          href={urlDeTienda({ orden: filtros.orden })}
          className="rounded-full px-2 py-1.5 text-caption font-medium text-ink-secondary underline underline-offset-2 transition-colors duration-150 hover:text-brand focus-visible:shadow-focus focus-visible:outline-none"
        >
          Limpiar todo
        </Link>
      </li>
    </ul>
  );
}
