"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useId, useState } from "react";

import {
  ANCHO_EN_FILA_DE_CATEGORIAS,
  FilaDeCategorias,
  TarjetaCuadradaDeCategoria,
  TarjetaEnFilaDeCategoria,
} from "@/components/shop/tarjeta-de-categoria";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { cn } from "@/lib/utils";
import {
  enlaceDeWhatsApp,
  mensajeDeBusquedaSinResultados,
  mensajeDeConsultaGeneral,
} from "@/lib/whatsapp";
import {
  repartirCategorias,
  type CategoriaDeLaPagina,
} from "@/modules/catalog/products/categorias";

/**
 * El buscador y las secciones de la página de categorías (RF-35). Filtra en el
 * navegador: ya vinieron todas con la página.
 *
 * La búsqueda va a la dirección con `history.replaceState` y no con el
 * router, para que escribir no le pida al servidor que vuelva a pintar (Next
 * sincroniza `useSearchParams` con la API nativa).
 */
export function ListadoDeCategorias({
  categorias,
  topeDeDestacadas,
  whatsapp,
  busquedaInicial,
}: {
  categorias: CategoriaDeLaPagina[];
  topeDeDestacadas: number;
  /** El número de la configuración, o `null` si no hay. */
  whatsapp: string | null;
  /** El `?q=` con que se llegó: la primera pintura ya viene filtrada. */
  busquedaInicial: string;
}) {
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const id = useId();
  const { destacadas, conProductos, total, buscando } = repartirCategorias(
    categorias,
    busqueda,
    topeDeDestacadas,
  );

  function buscar(valor: string) {
    setBusqueda(valor);
    const url = new URL(window.location.href);
    if (valor.trim()) url.searchParams.set("q", valor);
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }

  const sinNinguna = categorias.length === 0;
  const sinResultados = buscando && total === 0;

  return (
    <div className="flex flex-col gap-16 sm:gap-20">
      {sinNinguna ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body text-ink-secondary">
            Todavía no hay categorías.
          </p>
          <Button asChild variant="secondary">
            <Link href="/productos">Ver el catálogo</Link>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-3">
            <label htmlFor={id} className="sr-only">
              Buscar una categoría
            </label>
            {/* Sin botón de enviar: filtra mientras se escribe. */}
            <div className="relative w-full max-w-140">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-5 size-5 -translate-y-1/2 text-ink-tertiary"
              />
              <input
                id={id}
                type="search"
                value={busqueda}
                onChange={(e) => buscar(e.target.value)}
                placeholder="Buscá una categoría…"
                autoComplete="off"
                enterKeyHint="search"
                className={cn(
                  "h-12 w-full rounded-pill border border-border bg-surface pl-13 text-body text-ink",
                  "transition-colors duration-150 placeholder:text-ink-secondary focus:border-border-strong",
                  busqueda ? "pr-12" : "pr-5",
                  // La cruz nativa se cambia por un botón accesible.
                  "[&::-webkit-search-cancel-button]:appearance-none",
                )}
              />
              {busqueda ? (
                <button
                  type="button"
                  onClick={() => buscar("")}
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-pill text-ink-tertiary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
                >
                  <X aria-hidden className="size-4" />
                  <span className="sr-only">Limpiar la búsqueda</span>
                </button>
              ) : null}
            </div>
            {/* Se anuncia al escribir cuántas quedaron. */}
            <p aria-live="polite" className="text-body-sm text-ink-secondary">
              {total === 1 ? "1 categoría" : `${total} categorías`}
            </p>
          </div>

          {destacadas.length > 0 ? (
            <Seccion titulo="Destacadas">
              <FilaDeCategorias grilla="sm:grid-cols-4 lg:grid-cols-7">
                {destacadas.map((c) => (
                  <li key={c.id} className={ANCHO_EN_FILA_DE_CATEGORIAS}>
                    <TarjetaCuadradaDeCategoria
                      categoria={c}
                      imagenUrl={c.imagenUrl}
                      cantidad={c.cantidad}
                      sizes="(min-width: 1024px) 15vw, (min-width: 640px) 25vw, 40vw"
                    />
                  </li>
                ))}
              </FilaDeCategorias>
            </Seccion>
          ) : null}

          {conProductos.length > 0 ? (
            <Seccion titulo={buscando ? "Resultados" : "Todas, de la A a la Z"}>
              <ListaEnFila>
                {conProductos.map((c) => (
                  <li key={c.id}>
                    <TarjetaEnFilaDeCategoria
                      categoria={c}
                      miniaturaUrl={c.miniaturaUrl}
                      cantidad={c.cantidad}
                    />
                  </li>
                ))}
              </ListaEnFila>
            </Seccion>
          ) : null}
        </div>
      )}

      <Cierre
        whatsapp={whatsapp}
        busquedaSinResultados={sinResultados ? busqueda : null}
      />
    </div>
  );
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-5">
      <h2 id={id} className="text-heading text-ink">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

function ListaEnFila({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </ul>
  );
}

/**
 * El cierre, siempre al final; con una búsqueda sin resultados hace de estado
 * vacío. Sin número configurado no hay botón de WhatsApp: un `wa.me/` sin
 * destino abre WhatsApp en la nada.
 */
function Cierre({
  whatsapp,
  busquedaSinResultados,
}: {
  whatsapp: string | null;
  busquedaSinResultados: string | null;
}) {
  const id = useId();
  const mensaje =
    busquedaSinResultados !== null
      ? mensajeDeBusquedaSinResultados(busquedaSinResultados)
      : mensajeDeConsultaGeneral();

  return (
    <section aria-labelledby={id} className="flex flex-col items-start gap-3">
      <h2 id={id} className="text-heading text-balance text-ink">
        {busquedaSinResultados !== null
          ? `No encontramos «${busquedaSinResultados.trim()}»`
          : "¿No encontrás lo que buscás?"}
      </h2>
      {whatsapp ? (
        <>
          <p className="max-w-prose text-body text-ink-secondary">
            Escribinos y te decimos si lo tenemos o si pensamos traerlo.
          </p>
          <Button asChild variant="secondary" className="mt-2">
            <a
              href={enlaceDeWhatsApp(whatsapp, mensaje)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconoWhatsApp />
              Escribinos por WhatsApp
            </a>
          </Button>
        </>
      ) : (
        <p className="max-w-prose text-body text-ink-secondary">
          <Link
            href="/contacto"
            className="font-medium text-brand underline-offset-4 hover:underline"
          >
            Escribinos
          </Link>{" "}
          y te decimos si lo tenemos o si pensamos traerlo.
        </p>
      )}
    </section>
  );
}
