import Link from "next/link";
import { Check, SlidersHorizontal, X } from "lucide-react";

import {
  contarFiltrosDeTienda,
  hayFiltrosDeTienda,
  urlCambiando,
  urlDeTienda,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import type {
  OpcionDeColor,
  OpcionDeFiltro,
} from "@/modules/catalog/products/tienda";
import { cn } from "@/lib/utils";

/**
 * Filtros del catálogo — F3.8, RF-02, §7.2.
 *
 * **Todo son enlaces, no controles.** Un filtro que es un `<a>` se puede abrir
 * en otra pestaña, se precarga al pasar por encima, funciona sin JavaScript y
 * —lo que más importa— deja el botón atrás haciendo exactamente lo que la
 * persona espera. Con casillas y estado de cliente habría que reimplementar
 * las cuatro cosas, y la cuarta nunca queda bien.
 *
 * **Y el panel tampoco es una isla de cliente.** Abre y cierra con un
 * `<details>` nativo: sin JavaScript, con teclado, y con el foco donde debe
 * estar. No lleva `open` a propósito — así el navegador conserva el estado
 * entre navegaciones y el panel no se cierra solo cada vez que se toca un
 * chip, que es lo que pasaría si React se lo reescribiera en cada render.
 */

type Props = {
  filtros: FiltrosDeTienda;
  categorias: OpcionDeFiltro[];
  marcas: OpcionDeFiltro[];
  colores: OpcionDeColor[];
};

export function PanelDeFiltros({
  filtros,
  categorias,
  marcas,
  colores,
}: Props) {
  const puestos = contarFiltrosDeTienda(filtros);

  return (
    <details className="group">
      <summary
        className={cn(
          // `list-none` + el pseudo de WebKit: el triangulito nativo no entra
          // en el sistema, y la píldora ya dice que esto se abre.
          "flex h-12 cursor-pointer list-none items-center gap-2 rounded-pill",
          "border border-border bg-surface px-5 text-body text-ink shadow-sm",
          "transition-colors duration-150 hover:border-border-strong",
          "focus-visible:shadow-focus focus-visible:outline-none",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <SlidersHorizontal className="size-4 shrink-0" aria-hidden="true" />
        Filtros
        {puestos > 0 ? (
          <span
            className="grid size-5 shrink-0 place-items-center rounded-full bg-brand text-caption font-medium text-ink-inverse tabular-nums"
            // Un «2» suelto no dice nada leído en voz alta. El número visible
            // queda oculto al lector y el texto de al lado dice qué son.
            aria-hidden="true"
          >
            {puestos}
          </span>
        ) : null}
        <span className="sr-only">
          {puestos === 0
            ? "Ninguno aplicado"
            : puestos === 1
              ? "1 filtro aplicado"
              : `${puestos} filtros aplicados`}
        </span>
      </summary>

      {/*
        Se posiciona contra la BARRA, no contra el `<details>`: el ancestro
        posicionado es la fila entera, así que `inset-x-0 top-full` lo estira
        de lado a lado por debajo de los tres controles. Dentro del `<details>`
        el panel saldría del ancho del botón.

        `max-h` con scroll propio porque la lista de marcas crece con el
        catálogo: sin tope, en un teléfono el panel tapa la pantalla entera y
        no se llega ni a los colores ni a «Limpiar».
      */}
      <div
        className={cn(
          "absolute inset-x-0 top-full z-20 mt-3 flex flex-col gap-6",
          "max-h-[min(70vh,32rem)] overflow-y-auto overscroll-contain",
          "rounded-card bg-surface p-5 shadow-lg sm:p-6",
        )}
      >
        <GrupoDeChips
          titulo="Categoría"
          opciones={categorias}
          seleccionado={filtros.categoria}
          urlDe={(id) => urlCambiando(filtros, { categoria: id })}
        />
        <GrupoDeChips
          titulo="Marca"
          opciones={marcas}
          seleccionado={filtros.marca}
          urlDe={(id) => urlCambiando(filtros, { marca: id })}
        />
        <GrupoDeChips
          titulo="Color"
          opciones={colores}
          seleccionado={filtros.color}
          urlDe={(id) => urlCambiando(filtros, { color: id })}
        />

        <div className="flex flex-col gap-2.5">
          <h3 className="text-body-sm font-semibold text-ink">Ofertas</h3>
          <Casilla
            href={urlCambiando(filtros, { oferta: !filtros.oferta })}
            activa={filtros.oferta}
            etiqueta="Solo con descuento"
          />
        </div>

        {hayFiltrosDeTienda(filtros) ? (
          <div className="flex justify-end border-t border-border pt-4">
            <Link
              href={urlDeTienda({ orden: filtros.orden })}
              className="rounded-pill px-3 py-1.5 text-body-sm font-medium text-ink-secondary underline underline-offset-2 transition-colors duration-150 hover:text-brand focus-visible:shadow-focus focus-visible:outline-none"
            >
              Limpiar filtros
            </Link>
          </div>
        ) : null}
      </div>
    </details>
  );
}

/**
 * Un grupo de chips con su conteo — categoría, marca y color usan el mismo.
 *
 * Los tres son de selección única, que es lo que la consulta sabe hacer hoy.
 * RF-02 los pide multiselección; queda anotado como pendiente y no como
 * función ausente: filtrar por los tres a la vez ya se puede, lo que no se
 * puede es elegir dos marcas.
 */
function GrupoDeChips({
  titulo,
  opciones,
  seleccionado,
  urlDe,
}: {
  titulo: string;
  opciones: (OpcionDeFiltro | OpcionDeColor)[];
  seleccionado: string;
  urlDe: (id: string) => string;
}) {
  // Sin opciones no se dibuja el título: un encabezado con nada debajo parece
  // que la pantalla falló al cargar (§8).
  if (opciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-body-sm font-semibold text-ink">{titulo}</h3>
      {/*
        `flex-wrap`: los chips no se recortan ni se meten a la fuerza en una
        fila. Con quince marcas en un teléfono, una fila sola esconde las
        últimas y esas dejan de poder elegirse.
      */}
      <ul className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = seleccionado === o.id;
          const hex = "hex" in o ? o.hex : null;

          return (
            <li key={o.id}>
              <Link
                // Volver a tocar el chip vigente lo quita: es el gesto que la
                // gente prueba, y si no hace nada parece que se colgó.
                href={urlDe(activo ? "" : o.id)}
                // §9: el color nunca es el único portador del estado. Un
                // lector de pantalla no ve el relleno burdeos.
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-2 pr-3 pl-3",
                  "text-body-sm whitespace-nowrap transition-colors duration-150",
                  "focus-visible:shadow-focus focus-visible:outline-none",
                  activo
                    ? "border-brand-tint-border bg-brand-tint font-medium text-brand"
                    : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink",
                )}
              >
                {hex ? (
                  // El punto es decorativo: el nombre del color está al lado,
                  // así que no necesita texto alternativo propio.
                  <span
                    className="size-3.5 shrink-0 rounded-full border border-border"
                    style={{ backgroundColor: hex }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="min-w-0">{o.nombre}</span>
                <span
                  className={cn(
                    "shrink-0 text-caption tabular-nums",
                    activo ? "text-brand/70" : "text-ink-tertiary",
                  )}
                >
                  {o.cuantos}
                </span>
                <span className="sr-only">
                  {activo ? " — quitar este filtro" : " — aplicar este filtro"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * El descuento se ve como casilla porque no es una opción entre varias: es
 * sí o no. Un chip suelto en una fila de uno parecería un grupo al que le
 * faltan los demás.
 *
 * Sigue siendo un enlace por el mismo motivo que todo lo demás de este
 * archivo. La casilla es dibujada, no un `<input>`: un input real necesitaría
 * JavaScript para navegar, y perdería el atrás.
 */
function Casilla({
  href,
  activa,
  etiqueta,
}: {
  href: string;
  activa: boolean;
  etiqueta: string;
}) {
  return (
    <Link
      href={href}
      aria-current={activa ? "true" : undefined}
      className={cn(
        "flex w-fit items-center gap-2.5 rounded-pill py-1.5 pr-3 pl-1.5",
        "text-body-sm transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        activa
          ? "font-medium text-brand"
          : "text-ink-secondary hover:text-ink",
      )}
    >
      <span
        className={cn(
          "grid size-5 shrink-0 place-items-center rounded-md border transition-colors duration-150",
          activa
            ? "border-brand bg-brand text-ink-inverse"
            : "border-border-strong bg-surface",
        )}
        aria-hidden="true"
      >
        {activa ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
      {etiqueta}
      <span className="sr-only">
        {activa ? " — quitar este filtro" : " — aplicar este filtro"}
      </span>
    </Link>
  );
}

/**
 * Los filtros aplicados, como chips removibles arriba de la grilla (§7.2).
 *
 * Existe porque los filtros viven detrás de un botón: sin los chips, la
 * persona ve nueve resultados y **no tiene forma de saber por qué** son
 * nueve. El chip dice qué está puesto y lo saca de un toque.
 */
export function ChipsDeFiltros({
  filtros,
  categorias,
  marcas,
  colores,
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

  const color = colores.find((c) => c.id === filtros.color);
  if (color) {
    puestos.push({
      clave: "color",
      etiqueta: color.nombre,
      href: urlCambiando(filtros, { color: "" }),
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
    // `flex-wrap`: con cinco filtros puestos en un teléfono, una fila sola
    // recortaría los últimos y esos valores dejarían de poder quitarse.
    <ul className="flex flex-wrap items-center gap-2">
      {puestos.map((p) => (
        <li key={p.clave}>
          <Link
            href={p.href}
            className="flex items-center gap-1.5 rounded-full bg-surface py-1.5 pr-2 pl-3 text-caption font-medium whitespace-nowrap text-ink shadow-sm transition-colors duration-150 hover:text-brand focus-visible:shadow-focus focus-visible:outline-none"
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
