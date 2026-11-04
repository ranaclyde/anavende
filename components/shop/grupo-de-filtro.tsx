"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { EsperaDelFiltro } from "@/components/shop/filtrando";
import { normalizar } from "@/lib/texto";
import { TIPO_FILTRO } from "@/lib/transiciones";
import { AREA_TACTIL, cn } from "@/lib/utils";

/**
 * Cuántas opciones se ven sin abrir el grupo, y desde cuántas el grupo
 * abierto suma un buscador (decisión del 2026-11-03, PROGRESO.md).
 *
 * Con ~20 categorías y ~20 marcas, el grupo entero no entraba: el panel
 * quedaba cortado sin ninguna señal. Ocho son dos o tres renglones de chips
 * en el drawer, y alcanzan para lo que más se busca porque las opciones
 * llegan ordenadas por cuántos productos tienen (`leerOpcionesDeFiltro`).
 */
const VISIBLES = 8;
const CON_BUSCADOR_DESDE = 12;

/** Una opción ya resuelta en el servidor: a dónde lleva y si está puesta. */
export type OpcionDelGrupo = {
  slug: string;
  nombre: string;
  cuantos: number;
  hex: string | null;
  href: string;
  activo: boolean;
};

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
}: {
  titulo: string;
  plural: string;
  opciones: OpcionDelGrupo[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const idLista = useId();

  // Sin opciones no se dibuja el título: un encabezado con nada debajo parece
  // que la pantalla falló al cargar (§8).
  if (opciones.length === 0) return null;

  const sobran = opciones.length > VISIBLES;
  const conBuscador = abierto && opciones.length > CON_BUSCADOR_DESDE;
  const buscado = conBuscador ? normalizar(busqueda) : "";

  const visibles = !sobran
    ? opciones
    : abierto
      ? opciones.filter((o) => normalizar(o.nombre).includes(buscado))
      : // Lo elegido se ve siempre, aunque esté entre las escondidas: un
        // filtro puesto que no se ve no se puede sacar desde acá.
        opciones.filter((o, i) => i < VISIBLES || o.activo);

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
        {titulo}
      </h3>

      {conBuscador ? (
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label={`Buscar ${titulo.toLowerCase()}`}
          placeholder={`Buscar ${titulo.toLowerCase()}`}
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
              <Chip opcion={o} />
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

      {sobran ? (
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idLista}
          onClick={() => {
            setAbierto(!abierto);
            setBusqueda("");
          }}
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

function Chip({ opcion: o }: { opcion: OpcionDelGrupo }) {
  return (
    <Link
      // Volver a tocar el chip encendido lo apaga: lo resuelve `alternar`,
      // y es el gesto que la gente prueba primero.
      href={o.href}
      // Las tarjetas se reacomodan al llegar (`lib/transiciones.ts`).
      transitionTypes={TIPO_FILTRO}
      // §9: el color nunca es el único portador del estado. Un lector de
      // pantalla no ve el relleno burdeos.
      aria-current={o.activo ? "true" : undefined}
      className={cn(
        "relative flex items-center gap-2 rounded-full border py-2 pr-3 pl-3",
        "text-body-sm whitespace-nowrap transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        // §9 pide 44px de área táctil y la píldora mide 38. Se estira el
        // ÁREA y no el dibujo. Los 3px que sobresalen de cada lado caben en
        // el `gap-2` de la lista, así que dos filas de chips no se pisan el
        // blanco entre sí.
        AREA_TACTIL,
        // Relleno sólido y no tinte: el tinte claro es lo que usan los chips
        // de «filtro aplicado» de arriba de la grilla, y dos estados
        // distintos con el mismo color se confunden.
        o.activo
          ? "border-brand bg-brand font-medium text-ink-inverse"
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
      {/*
        `--ink-secondary` y no `--ink-tertiary`: §3.1 admite el terciario
        «solo texto ≥ 24px o elementos decorativos», y esto son 12px que dicen
        cuántos productos hay — información, y a 3,37:1 sobre la superficie.
      */}
      <span
        className={cn(
          "shrink-0 text-caption tabular-nums",
          o.activo ? "text-ink-inverse/70" : "text-ink-secondary",
        )}
      >
        {o.cuantos}
      </span>
      <span className="sr-only">
        {o.activo ? " — quitar este filtro" : " — aplicar este filtro"}
      </span>
      <EsperaDelFiltro />
    </Link>
  );
}
