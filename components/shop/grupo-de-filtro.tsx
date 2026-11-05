"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { EsperaDelFiltro } from "@/components/shop/filtrando";
import { normalizar } from "@/lib/texto";
import { TIPO_FILTRO } from "@/lib/transiciones";
import { AREA_TACTIL, cn } from "@/lib/utils";

/**
 * Cuántas opciones se ven sin abrir el grupo (decisión del 2026-11-03,
 * PROGRESO.md). Un grupo que pasa este número lleva «Ver las N» y buscador.
 *
 * Con ~20 categorías y ~20 marcas, el grupo entero no entraba: el panel
 * quedaba cortado sin ninguna señal. Ocho son dos o tres renglones de chips
 * en el drawer, y alcanzan para lo que más se busca porque las opciones
 * llegan ordenadas por cuántos productos tienen (`leerOpcionesDeFiltro`).
 */
const VISIBLES = 8;

/** Una opción ya resuelta en el servidor: a dónde lleva y si está puesta. */
export type OpcionDelGrupo = {
  slug: string;
  nombre: string;
  hex: string | null;
  href: string;
  activo: boolean;
};

/**
 * Un grupo de chips — categoría, marca y color usan el mismo.
 *
 * **Sin el número de productos al lado** (2026-11-04, pedido tuyo): con el
 * total del botón «Ver N productos» abajo, dos números distintos para lo
 * mismo confundían. El número sigue decidiendo el orden.
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
 *
 * **Es una isla porque se recorta y se busca**, nada más. Los chips siguen
 * siendo enlaces armados en el servidor (`filtros-catalogo.tsx`), y lo abierto
 * y lo buscado sobreviven al tocar un chip: React conserva el estado entre
 * navegaciones porque el grupo no cambia de lugar. Al cerrar el drawer se
 * desmonta, y al volver a abrirlo arranca recortado.
 */
export function GrupoDeFiltro({
  titulo,
  plural,
  opciones,
  navega = false,
}: {
  titulo: string;
  plural: string;
  opciones: OpcionDelGrupo[];
  /**
   * Los chips llevan a otra página en vez de filtrar: «Otras categorías» en
   * la página de una categoría (F3.11). Se ven igual, pero no se dicen igual:
   * el elegido es «estás acá» y no «quitar este filtro», que sería mentira.
   */
  navega?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const idLista = useId();

  // Sin opciones no se dibuja el título: un encabezado con nada debajo parece
  // que la pantalla falló al cargar (§8).
  if (opciones.length === 0) return null;

  const sobran = opciones.length > VISIBLES;
  const buscado = normalizar(busqueda);

  // El buscador mira la lista ENTERA, esté abierto el grupo o no: quien
  // escribe «razer» no tiene por qué saber si Razer está entre las 8.
  const visibles = !sobran
    ? opciones
    : buscado
      ? opciones.filter((o) => normalizar(o.nombre).includes(buscado))
      : abierto
        ? opciones
        : // Lo elegido se ve siempre, aunque esté entre las escondidas: un
          // filtro puesto que no se ve no se puede sacar desde acá.
          opciones.filter((o, i) => i < VISIBLES || o.activo);

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
        {titulo}
      </h3>

      {/*
        Con «Ver las N», el buscador está desde el principio (2026-11-04).
        Antes aparecía al abrir el grupo, y ese renglón nuevo empujaba los
        chips hacia abajo justo cuando se los iba a mirar.
      */}
      {sobran ? (
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          // Con el plural y no con el título: «Buscar otras categorías» no
          // dice nada que «Buscar categorías» no diga (F3.11).
          aria-label={`Buscar ${plural}`}
          placeholder={`Buscar ${plural}`}
          className={cn(
            "h-10 w-full rounded-pill border border-border bg-surface-sunken px-4",
            // 16px en teléfono: con menos, iOS Safari amplía la página al
            // enfocar el campo y no vuelve. Ver `search-box.tsx`.
            "text-body-sm text-ink max-md:text-body placeholder:text-ink-secondary",
            "focus-visible:border-border-strong focus-visible:shadow-focus focus-visible:outline-none",
          )}
        />
      ) : null}

      {visibles.length > 0 ? (
        /*
          `flex-wrap`: los chips no se recortan ni se meten a la fuerza en una
          fila. Con quince marcas en un teléfono, una fila sola esconde las
          últimas y esas dejan de poder elegirse.
        */
        <ul id={idLista} className="flex flex-wrap gap-2">
          {visibles.map((o) => (
            <li key={o.slug}>
              <Chip opcion={o} navega={navega} />
            </li>
          ))}
        </ul>
      ) : (
        <p
          id={idLista}
          role="status"
          className="text-body-sm text-ink-secondary"
        >
          Ninguna coincide con «{busqueda.trim()}».
        </p>
      )}

      {sobran && !buscado ? (
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idLista}
          onClick={() => setAbierto(!abierto)}
          className={cn(
            "relative flex w-fit items-center gap-1.5 rounded-pill py-1 text-body-sm font-medium text-brand",
            "transition-colors duration-150 hover:text-brand-hover",
            "focus-visible:shadow-focus focus-visible:outline-none",
            AREA_TACTIL,
          )}
        >
          {abierto ? "Ver menos" : `Ver las ${opciones.length} ${plural}`}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 transition-transform duration-150 motion-reduce:transition-none",
              abierto && "rotate-180",
            )}
          />
        </button>
      ) : null}
    </div>
  );
}

function Chip({
  opcion: o,
  navega,
}: {
  opcion: OpcionDelGrupo;
  navega: boolean;
}) {
  return (
    <Link
      // Volver a tocar el chip encendido lo apaga: lo resuelve `alternar`,
      // y es el gesto que la gente prueba primero.
      href={o.href}
      // Las tarjetas se reacomodan al llegar (`lib/transiciones.ts`). Ir a
      // otra categoría es cambiar de página, no filtrar: sin transición.
      transitionTypes={navega ? undefined : TIPO_FILTRO}
      // §9: el color nunca es el único portador del estado. Un lector de
      // pantalla no ve el relleno burdeos.
      aria-current={o.activo ? (navega ? "page" : "true") : undefined}
      className={cn(
        "relative flex items-center gap-2 rounded-full border py-2 pr-3 pl-3",
        "text-body-sm whitespace-nowrap transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        // §9 pide 44px de área táctil y la píldora mide 38. Se estira el
        // ÁREA y no el dibujo. Los 3px que sobresalen de cada lado caben en
        // el `gap-2` de la lista, así que dos filas de chips no se pisan el
        // blanco entre sí.
        AREA_TACTIL,
        // **Tinte con tilde, no relleno sólido** (2026-11-04, pedido tuyo).
        // Relleno burdeos con texto blanco es lo que lleva «Ver N
        // productos», y un estado con la cara del botón principal se leía
        // como una acción. El tinte es el mismo de los chips de «aplicado»
        // de arriba de la grilla, y quiere decir lo mismo: este filtro está
        // puesto. Los distingue el ícono: acá la ✓, allá la × que lo saca.
        o.activo
          ? "border-brand bg-brand-tint font-medium text-brand"
          : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink",
      )}
    >
      {o.hex ? (
        // El punto es decorativo: el nombre del color está al lado, así que
        // no necesita texto alternativo propio.
        <span
          className="size-3.5 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: o.hex }}
          aria-hidden="true"
        />
      ) : null}
      <span className="min-w-0">{o.nombre}</span>
      {o.activo ? (
        // §9: el color nunca es el único portador del estado. La tilde dice
        // «elegido» también en gris, y el texto del lector lo dice abajo.
        // Va a la derecha, donde está la × de los chips de «aplicado» de
        // arriba de la grilla: el mismo lugar para el ícono del estado.
        <Check
          aria-hidden
          className="-mr-0.5 size-3.5 shrink-0"
          strokeWidth={3}
        />
      ) : null}
      {navega ? null : (
        <span className="sr-only">
          {o.activo ? " — quitar este filtro" : " — aplicar este filtro"}
        </span>
      )}
      {navega ? null : <EsperaDelFiltro />}
    </Link>
  );
}
