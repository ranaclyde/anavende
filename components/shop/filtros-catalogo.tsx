import Link from "next/link";
import { Check, SlidersHorizontal, X } from "lucide-react";

import { BotonVerResultados } from "@/components/shop/boton-ver-resultados";
import { Button } from "@/components/ui/button";

import {
  alternar,
  contarFiltrosDeTienda,
  hayFiltrosDeTienda,
  urlCambiando,
  urlDeTienda,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import { formatMoney } from "@/lib/money";
import type {
  OpcionDeColor,
  OpcionDeFiltro,
} from "@/modules/catalog/products/tienda";
import { AREA_TACTIL, cn } from "@/lib/utils";

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
  total,
}: Props & { total: number }) {
  const puestos = contarFiltrosDeTienda(filtros);

  return (
    <details className="group">
      <summary
        className={cn(
          // `list-none` + el pseudo de WebKit: el triangulito nativo no entra
          // en el sistema, y la píldora ya dice que esto se abre.
          "flex h-12 cursor-pointer list-none items-center gap-2 rounded-pill",
          "border px-5 text-body shadow-sm",
          "transition-colors duration-150",
          "focus-visible:shadow-focus focus-visible:outline-none",
          "[&::-webkit-details-marker]:hidden",
          // Con filtros puestos el botón se tiñe. Antes solo cambiaba el
          // circulito del contador, y en una barra de tres controles blancos
          // ese punto pasa desapercibido: la persona no ve que la lista que
          // está mirando está recortada.
          puestos > 0
            ? "border-brand-tint-border bg-brand-tint font-medium text-brand"
            : "border-border bg-surface text-ink hover:border-border-strong",
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
        {/*
          Los tres grupos en columnas, no apilados. Apilados, el panel medía
          más de 500px de alto y «Color» quedaba abajo de todo: se elegía
          categoría, se elegía marca y nadie llegaba a ver que había colores.
          En un teléfono vuelven a una sola columna, que ahí es lo correcto.
        */}
        <div className="grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          <GrupoDeChips
            titulo="Categoría"
            opciones={categorias}
            seleccionados={filtros.categoria}
            urlDe={(id) =>
              urlCambiando(filtros, {
                categoria: alternar(filtros.categoria, id),
              })
            }
          />
          <GrupoDeChips
            titulo="Marca"
            opciones={marcas}
            seleccionados={filtros.marca}
            urlDe={(id) =>
              urlCambiando(filtros, { marca: alternar(filtros.marca, id) })
            }
          />
          <GrupoDeChips
            titulo="Color"
            opciones={colores}
            seleccionados={filtros.color}
            urlDe={(id) =>
              urlCambiando(filtros, { color: alternar(filtros.color, id) })
            }
          />
        </div>

        <div className="flex flex-wrap items-end gap-x-8 gap-y-5">
          <RangoDePrecio filtros={filtros} />
          <Casilla
            href={urlCambiando(filtros, { oferta: !filtros.oferta })}
            activa={filtros.oferta}
            etiqueta="Solo con descuento"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          {/*
            «Limpiar» solo si hay algo que limpiar, pero el hueco se conserva
            con el `justify-between`: sin esto «Ver productos» salta de la
            derecha al centro según haya filtros o no.
          */}
          {hayFiltrosDeTienda(filtros) ? (
            <Link
              href={urlDeTienda({ orden: filtros.orden })}
              className={cn(
                "relative rounded-pill px-1 py-1.5 text-body-sm text-ink-secondary underline underline-offset-2",
                "transition-colors duration-150 hover:text-brand",
                "focus-visible:shadow-focus focus-visible:outline-none",
                AREA_TACTIL,
              )}
            >
              Limpiar filtros
            </Link>
          ) : (
            <span />
          )}

          <BotonVerResultados
            etiqueta={total === 1 ? "Ver 1 producto" : `Ver ${total} productos`}
          />
        </div>
      </div>
    </details>
  );
}

/**
 * Un grupo de chips con su conteo — categoría, marca y color usan el mismo.
 *
 * **Los tres son multiselección desde el 2026-09-08** (RF-02). Dentro del
 * grupo las opciones se suman y entre grupos se cruzan: «(Teclados o Mouses) y
 * Logitech». Cruzarlas dentro del grupo daría cero siempre, porque ningún
 * producto es de dos categorías a la vez.
 *
 * No hay señal visual nueva para «podés elegir varios»: se descubre eligiendo
 * el segundo, y hasta ahí el chip se comporta igual que antes. Un rótulo
 * «elegí uno o más» arriba de cada grupo sería texto en tres lugares para algo
 * que se aprende en un clic.
 */
function GrupoDeChips({
  titulo,
  opciones,
  seleccionados,
  urlDe,
}: {
  titulo: string;
  opciones: (OpcionDeFiltro | OpcionDeColor)[];
  seleccionados: readonly string[];
  urlDe: (id: string) => string;
}) {
  // Sin opciones no se dibuja el título: un encabezado con nada debajo parece
  // que la pantalla falló al cargar (§8).
  if (opciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
        {titulo}
      </h3>
      {/*
        `flex-wrap`: los chips no se recortan ni se meten a la fuerza en una
        fila. Con quince marcas en un teléfono, una fila sola esconde las
        últimas y esas dejan de poder elegirse.
      */}
      <ul className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = seleccionados.includes(o.id);
          const hex = "hex" in o ? o.hex : null;

          return (
            <li key={o.id}>
              <Link
                // Volver a tocar el chip encendido lo apaga: lo resuelve
                // `alternar`, y es el gesto que la gente prueba primero.
                href={urlDe(o.id)}
                // §9: el color nunca es el único portador del estado. Un
                // lector de pantalla no ve el relleno burdeos.
                aria-current={activo ? "true" : undefined}
                className={cn(
                  "relative flex items-center gap-2 rounded-full border py-2 pr-3 pl-3",
                  "text-body-sm whitespace-nowrap transition-colors duration-150",
                  "focus-visible:shadow-focus focus-visible:outline-none",
                  // §9 pide 44px de área táctil y la píldora mide 38. Se
                  // estira el ÁREA y no el dibujo: agrandar el chip cambiaría
                  // la composición de §7.2, y lo que está chico no es el chip
                  // sino el blanco. Los 3px que sobresalen de cada lado caben
                  // en el `gap-2` de la lista, así que dos filas de chips no
                  // se pisan el blanco entre sí.
                  AREA_TACTIL,
                  // Relleno sólido y no tinte: el tinte claro es lo que usan
                  // los chips de «filtro aplicado» de abajo, y dos estados
                  // distintos con el mismo color se confunden.
                  activo
                    ? "border-brand bg-brand font-medium text-ink-inverse"
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
                {/*
                  `--ink-secondary` y no `--ink-tertiary`: §3.1 admite el
                  terciario «solo texto ≥ 24px o elementos decorativos», y esto
                  son 12px que dicen cuántos productos hay — información, y a
                  3,37:1 sobre la superficie. Medido, no estimado.
                */}
                <span
                  className={cn(
                    "shrink-0 text-caption tabular-nums",
                    activo ? "text-ink-inverse/70" : "text-ink-secondary",
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
 * El rango de precio (RF-02) — el único control de verdad de todo el panel.
 *
 * **Es un formulario GET y no un enlace**, porque el valor no sale de una lista
 * cerrada: hasta que no se escribe no existe la dirección a la que ir. Sigue
 * sin JavaScript, sigue dejando el atrás funcionando y sigue siendo
 * compartible — que es todo lo que los enlaces daban.
 *
 * **Los demás filtros viajan como campos ocultos.** Sin eso, poner un precio
 * borraría la marca elegida, que es la trampa clásica del formulario dentro de
 * un panel de filtros. `pagina` es la excepción y se omite a propósito: cambiar
 * el precio vuelve a la página 1, igual que cualquier otro filtro.
 *
 * **Una fea a propósito:** un campo vacío se envía igual —así funcionan los
 * formularios—, así que poner solo el mínimo deja `&precioMax=` colgando en la
 * dirección. No filtra de más ni de menos, y el próximo clic en cualquier chip
 * reescribe la URL limpia. Sacarlo pedía JavaScript, y no vale una isla de
 * cliente.
 */
function RangoDePrecio({ filtros }: { filtros: FiltrosDeTienda }) {
  return (
    <div className="flex flex-col gap-2.5">
      <h3
        id="filtro-precio"
        className="text-caption font-medium tracking-wide text-ink-secondary uppercase"
      >
        Precio
      </h3>

      {/*
        `aria-labelledby` y no un `<fieldset>` con `<legend>`: el legend sería
        el marcado más correcto para agrupar dos campos, pero dejaría a este
        grupo fuera del recorrido por encabezados mientras los otros tres son
        `h3`. Así se queda con las dos cosas — el encabezado navegable y el
        formulario con nombre.
      */}
      <form
        method="get"
        action="/productos"
        aria-labelledby="filtro-precio"
        className="flex flex-wrap items-center gap-2"
      >
        <Conservados filtros={filtros} />
        <CampoDePrecio nombre="precioMin" etiqueta="Desde" valor={filtros.precioMin} />
        <CampoDePrecio nombre="precioMax" etiqueta="Hasta" valor={filtros.precioMax} />
        <Button type="submit" variant="secondary" size="md" className="h-11">
          Aplicar
        </Button>
      </form>
    </div>
  );
}

/**
 * Los filtros vigentes como campos ocultos, para que el formulario del precio
 * no se los lleve puestos. Los multivalor van repetidos, que es exactamente la
 * forma que `leerFiltrosDeTienda` sabe leer.
 */
function Conservados({ filtros }: { filtros: FiltrosDeTienda }) {
  return (
    <>
      {filtros.q ? <input type="hidden" name="q" value={filtros.q} /> : null}
      {filtros.categoria.map((id) => (
        <input key={id} type="hidden" name="categoria" value={id} />
      ))}
      {filtros.marca.map((id) => (
        <input key={id} type="hidden" name="marca" value={id} />
      ))}
      {filtros.color.map((id) => (
        <input key={id} type="hidden" name="color" value={id} />
      ))}
      {filtros.oferta ? (
        <input type="hidden" name="oferta" value="1" />
      ) : null}
      {filtros.orden !== "relevancia" ? (
        <input type="hidden" name="orden" value={filtros.orden} />
      ) : null}
    </>
  );
}

/**
 * Etiqueta VISIBLE y no un marcador de posición (§8): «Desde» y «Hasta» son la
 * única diferencia entre los dos campos, y un marcador desaparece justo cuando
 * se está escribiendo, que es cuando hace falta saber en cuál se está.
 *
 * `defaultValue` y no `value`: es un campo no controlado a propósito. Con
 * `value` y sin `onChange` React lo deja de solo lectura, y este archivo es
 * servidor entero.
 */
function CampoDePrecio({
  nombre,
  etiqueta,
  valor,
}: {
  nombre: string;
  etiqueta: string;
  valor: number | null;
}) {
  return (
    <label className="flex items-center gap-2 text-body-sm text-ink-secondary">
      {etiqueta}
      <span className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-body-sm text-ink-secondary"
        >
          $
        </span>
        <input
          type="number"
          name={nombre}
          min={0}
          step={1}
          inputMode="numeric"
          defaultValue={valor ?? ""}
          className={cn(
            // 44px, que es el mínimo táctil de §9. Con los 40 que trae
            // `h-10` los dos campos y el botón quedaban justo por debajo.
            "h-11 w-28 rounded-pill border border-border bg-surface",
            // 16px en teléfono: con menos, iOS Safari amplía la página al
            // enfocar el campo y no vuelve. Ver `search-box.tsx`.
            "pr-3 pl-7 text-body-sm max-md:text-body text-ink tabular-nums",
            "focus-visible:shadow-focus focus-visible:outline-none",
            // Las flechitas nativas de `number` no entran en el sistema y
            // encima empujan el texto contra el borde.
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
          )}
        />
      </span>
    </label>
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
        "relative flex w-fit items-center gap-2.5 rounded-pill py-1.5 pr-3 pl-1.5",
        "text-body-sm transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        AREA_TACTIL,
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

  /*
   * Un chip por VALOR, no por grupo: con dos marcas puestas hay dos chips y
   * cada uno saca la suya. Un chip «2 marcas» diría cuántas hay y obligaría a
   * abrir el panel para saber cuáles, que es justo lo que los chips existen
   * para evitar.
   *
   * Si un identificador no está en las opciones no se dibuja chip, y eso pasa
   * de verdad: una categoría cuyo último producto se desactivó desaparece de
   * la lista. La salida no se pierde —«Limpiar todo» está siempre al final de
   * esta misma fila—, pero el filtro invisible es el motivo por el que ese
   * enlace no es opcional.
   */
  const grupos = [
    { clave: "categoria", ids: filtros.categoria, opciones: categorias },
    { clave: "marca", ids: filtros.marca, opciones: marcas },
    { clave: "color", ids: filtros.color, opciones: colores },
  ] as const;

  for (const grupo of grupos) {
    for (const id of grupo.ids) {
      const opcion = grupo.opciones.find((o) => o.id === id);
      if (!opcion) continue;
      puestos.push({
        clave: `${grupo.clave}-${id}`,
        etiqueta: opcion.nombre,
        href: urlCambiando(filtros, {
          [grupo.clave]: alternar(grupo.ids, id),
        }),
      });
    }
  }

  if (filtros.precioMin !== null || filtros.precioMax !== null) {
    puestos.push({
      clave: "precio",
      etiqueta: etiquetaDePrecio(filtros),
      // Los dos bordes se van juntos: es UN filtro, y su chip es uno.
      href: urlCambiando(filtros, { precioMin: null, precioMax: null }),
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
    // `gap-y-4` y no `gap-2`: estos chips miden 30px de alto, así que su área
    // táctil sobresale 7px por lado. Con 8px de separación entre filas, dos
    // filas se pisarían el blanco y se tocaría el chip de arriba queriendo
    // tocar el de abajo.
    <ul className="flex flex-wrap items-center gap-x-2 gap-y-4">
      {puestos.map((p) => (
        <li key={p.clave}>
          <Link
            href={p.href}
            // Tinte de marca y no blanco: sobre el canvas gris, un chip
            // blanco es una superficie más entre otras y no se lee como «esto
            // está aplicado». El tinte lo dice sin sumar un color al sistema.
            className={cn(
              "relative flex items-center gap-1.5 rounded-full border border-brand-tint-border bg-brand-tint",
              "py-1.5 pr-2 pl-3 text-caption font-medium whitespace-nowrap text-brand",
              "transition-colors duration-150 hover:border-brand hover:bg-brand hover:text-ink-inverse",
              "focus-visible:shadow-focus focus-visible:outline-none",
              AREA_TACTIL,
            )}
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
          className={cn(
            "relative rounded-full px-2 py-1.5 text-caption font-medium text-ink-secondary underline underline-offset-2",
            "transition-colors duration-150 hover:text-brand",
            "focus-visible:shadow-focus focus-visible:outline-none",
            AREA_TACTIL,
          )}
        >
          Limpiar todo
        </Link>
      </li>
    </ul>
  );
}

/**
 * «$ 5.000,00 – $ 20.000,00», «Desde $ 5.000,00» o «Hasta $ 20.000,00».
 *
 * Con `formatMoney` y no con el número pelado: RN-02 pide que todo precio de
 * la tienda se vea igual, y un chip que dice «5000» al lado de tarjetas que
 * dicen «$ 5.000,00» se lee como si fuera otra cosa.
 */
function etiquetaDePrecio(f: FiltrosDeTienda): string {
  const min = f.precioMin !== null ? formatMoney(String(f.precioMin)) : null;
  const max = f.precioMax !== null ? formatMoney(String(f.precioMax)) : null;

  if (min !== null && max !== null) return `${min} – ${max}`;
  if (min !== null) return `Desde ${min}`;
  return `Hasta ${max}`;
}
