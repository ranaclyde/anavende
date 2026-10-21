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
  mensajeDeCategoriaSinProductos,
  mensajeDeConsultaGeneral,
} from "@/lib/whatsapp";
import {
  repartirCategorias,
  type CategoriaDeLaPagina,
} from "@/modules/catalog/products/categorias";

/**
 * El buscador y las tres secciones de la página de categorías — RF-35,
 * DR §7.6. Tarea F3.10.
 *
 * **Filtra en el navegador**: son decenas de categorías y ya vinieron todas
 * con la página, así que cada letra no tiene por qué ir a la base.
 *
 * **La búsqueda va a la dirección con `history.replaceState`** y no con el
 * router: así el enlace se comparte con el filtro puesto, el atrás no tiene
 * que deshacer letra por letra, y escribir no le pide al servidor que vuelva
 * a pintar la página (Next sincroniza `useSearchParams` con la API nativa).
 */
export function ListadoDeCategorias({
  categorias,
  topeDeDestacadas,
  whatsapp,
  busquedaInicial,
}: {
  categorias: CategoriaDeLaPagina[];
  topeDeDestacadas: number;
  /** El número de la configuración (RF-20), o `null` si no hay. */
  whatsapp: string | null;
  /** El `?q=` con que se llegó: la primera pintura ya viene filtrada. */
  busquedaInicial: string;
}) {
  const [busqueda, setBusqueda] = useState(busquedaInicial);
  const id = useId();
  const { destacadas, conProductos, sinProductos, total, buscando } =
    repartirCategorias(categorias, busqueda, topeDeDestacadas);

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
            {/* La píldora de §6.2 sin el botón de enviar: acá no hay nada
                que enviar, filtra mientras se escribe. La lupa a la
                izquierda es lo que dice que es un buscador. */}
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
                  // La cruz del navegador se retira: la limpieza es un
                  // botón propio y accesible, como en el de productos.
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
            {/* Se anuncia al escribir: quien no ve la lista se entera de
                cuántas quedaron sin tener que recorrerla. */}
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

          {sinProductos.length > 0 ? (
            <Seccion titulo="Todavía sin productos">
              <ListaEnFila>
                {sinProductos.map((c) => (
                  <li key={c.id}>
                    <TarjetaEnFilaDeCategoria
                      categoria={c}
                      miniaturaUrl={c.miniaturaUrl}
                      cantidad={0}
                      accion={
                        whatsapp ? (
                          <Button
                            asChild
                            variant="secondary"
                            className="shrink-0"
                          >
                            <a
                              href={enlaceDeWhatsApp(
                                whatsapp,
                                mensajeDeCategoriaSinProductos(c.nombre),
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <IconoWhatsApp />
                              Consultar
                              <span className="sr-only">
                                por {c.nombre} en WhatsApp
                              </span>
                            </a>
                          </Button>
                        ) : null
                      }
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

/** Una por fila en el teléfono, dos en tableta, tres en escritorio (§7.6). */
function ListaEnFila({ children }: { children: React.ReactNode }) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </ul>
  );
}

/**
 * El cierre de §7.6: siempre al final, y **con una búsqueda que no encontró
 * nada, es el estado vacío** —el «no está» termina en una conversación y no
 * en una pantalla en blanco—, con lo que se escribió en el mensaje.
 *
 * Sin número configurado no se dibuja ningún botón de WhatsApp (RF-04): un
 * `wa.me/` sin destino abre WhatsApp en la nada. Queda el enlace a Contacto.
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
