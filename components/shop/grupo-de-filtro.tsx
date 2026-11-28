"use client";

import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { EsperaDelFiltro } from "@/components/shop/filtrando";
import { normalizar } from "@/lib/texto";
import { TIPO_FILTRO } from "@/lib/transiciones";
import { AREA_TACTIL, cn } from "@/lib/utils";

/**
 * Cuántas opciones se ven sin abrir el grupo; pasado este número lleva «Ver
 * las N» y buscador. Alcanza porque llegan ordenadas por cantidad de productos.
 */
const VISIBLES = 8;

/** Una opción ya resuelta en el servidor. */
export type OpcionDelGrupo = {
  slug: string;
  nombre: string;
  hex: string | null;
  href: string;
  activo: boolean;
};

/**
 * Un grupo de chips multiselección (RF-02): dentro del grupo las opciones se
 * suman y entre grupos se cruzan. Es isla solo para recortar y buscar; lo
 * abierto y lo buscado sobreviven a la navegación porque el grupo no cambia de
 * lugar en el árbol.
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

  if (opciones.length === 0) return null;

  const sobran = opciones.length > VISIBLES;
  const buscado = normalizar(busqueda);

  // El buscador mira la lista entera, esté abierto el grupo o no.
  const visibles = !sobran
    ? opciones
    : buscado
      ? opciones.filter((o) => normalizar(o.nombre).includes(buscado))
      : abierto
        ? opciones
        : // Lo elegido se ve siempre: si no, no se podría sacar desde acá.
          opciones.filter((o, i) => i < VISIBLES || o.activo);

  return (
    <div className="flex flex-col gap-2.5">
      <h3 className="text-caption font-medium tracking-wide text-ink-secondary uppercase">
        {titulo}
      </h3>

      {/* Desde el principio: aparecer al abrir empujaba los chips. */}
      {sobran ? (
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          aria-label={`Buscar ${plural}`}
          placeholder={`Buscar ${plural}`}
          className={cn(
            "h-10 w-full rounded-pill border border-border bg-surface-sunken px-4",
            // 16px en teléfono: con menos, iOS Safari amplía la página al enfocar.
            "text-body-sm text-ink max-md:text-body placeholder:text-ink-secondary",
            "focus-visible:border-border-strong focus-visible:shadow-focus focus-visible:outline-none",
          )}
        />
      ) : null}

      {visibles.length > 0 ? (
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

function Chip({ opcion: o }: { opcion: OpcionDelGrupo }) {
  return (
    <Link
      href={o.href}
      transitionTypes={TIPO_FILTRO}
      aria-current={o.activo ? "true" : undefined}
      className={cn(
        "relative flex items-center gap-2 rounded-full border py-2 pr-3 pl-3",
        "text-body-sm whitespace-nowrap transition-colors duration-150",
        "focus-visible:shadow-focus focus-visible:outline-none",
        // Los 3px que el área táctil sobresale caben en el `gap-2` de la lista.
        AREA_TACTIL,
        // Tinte y no relleno sólido: con la cara del botón principal se leía
        // como una acción.
        o.activo
          ? "border-brand bg-brand-tint font-medium text-brand"
          : "border-border bg-surface text-ink-secondary hover:border-border-strong hover:text-ink",
      )}
    >
      {o.hex ? (
        <span
          className="size-3.5 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: o.hex }}
          aria-hidden="true"
        />
      ) : null}
      <span className="min-w-0">{o.nombre}</span>
      {o.activo ? (
        // El color no puede ser el único portador del estado.
        <Check
          aria-hidden
          className="-mr-0.5 size-3.5 shrink-0"
          strokeWidth={3}
        />
      ) : null}
      <span className="sr-only">
        {o.activo ? " — quitar este filtro" : " — aplicar este filtro"}
      </span>
      <EsperaDelFiltro />
    </Link>
  );
}
