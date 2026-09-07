import type { Metadata } from "next";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";

import {
  ChipsDeFiltros,
  FiltrosDelCatalogo,
} from "@/components/shop/filtros-catalogo";
import { SelectorDeOrden } from "@/components/shop/selector-de-orden";
import { TarjetaProducto } from "@/components/shop/tarjeta-producto";
import { Button } from "@/components/ui/button";
import {
  hayFiltrosDeTienda,
  leerFiltrosDeTienda,
  POR_PAGINA,
  urlDePagina,
  urlDeTienda,
  type FiltrosDeTienda,
  type ParametrosDeBusqueda,
} from "@/modules/catalog/products/filtros-tienda";
import {
  leerOpcionesDeFiltro,
  leerPaginaDelCatalogo,
} from "@/modules/catalog/products/tienda";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Catálogo",
  description: "Teclados, mouses, auriculares y cables. Envíos por PedidosYa.",
};

/**
 * Catálogo — F3.4, RF-02, §7.2, §10.2.
 *
 * Todo el estado vive en la URL: filtros, orden y página. Eso es lo que hace
 * que el botón atrás funcione, que el enlace se pueda mandar por WhatsApp tal
 * como se está viendo, y que esta pantalla no necesite ni una línea de estado
 * de cliente para lo que muestra.
 */
export default async function Catalogo({
  searchParams,
}: {
  // En Next 16 `searchParams` es una promesa.
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  const filtros = leerFiltrosDeTienda(await searchParams);

  // Independientes: no tiene sentido esperar una para pedir la otra.
  const [pagina, opciones] = await Promise.all([
    leerPaginaDelCatalogo(filtros),
    leerOpcionesDeFiltro(),
  ]);

  const paginas = Math.max(1, Math.ceil(pagina.total / POR_PAGINA));

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 pb-8">
        <h1 className="text-title text-ink">Catálogo</h1>
        <p className="text-body text-ink-secondary">
          Periféricos y accesorios. Enviamos por PedidosYa.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
        {/*
          Columna de 260px a la izquierda en escritorio, detrás de un botón en
          móvil (§7.2). Se renderiza DOS veces, y es a propósito: intentar que
          un mismo `<details>` esté abierto en escritorio y cerrado en móvil
          necesita saber el ancho, y saberlo obliga a JavaScript. Duplicar ocho
          enlaces sale más barato que una isla de cliente que además tiene que
          hidratarse antes de que los filtros funcionen.

          §7.2 pide un panel inferior DESLIZABLE en móvil; esto es un
          disclosure. Queda anotado como pulido pendiente, no como función
          ausente: filtrar se puede.
        */}
        <aside className="lg:w-[260px] lg:shrink-0">
          {/* Móvil: detrás de un botón, sin JavaScript. */}
          <details className="rounded-card bg-surface p-4 shadow-md lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-body-sm font-medium text-ink">
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              Filtros
            </summary>
            <div className="pt-6">
              <FiltrosDelCatalogo filtros={filtros} {...opciones} />
            </div>
          </details>

          {/* Escritorio: a la vista, en su columna. */}
          <div className="hidden lg:block">
            <FiltrosDelCatalogo filtros={filtros} {...opciones} />
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p
                className="text-body-sm text-ink-secondary"
                // El conteo cambia al filtrar sin que se mueva el foco: sin
                // esto, quien usa lector de pantalla no se entera de que la
                // lista cambió.
                aria-live="polite"
              >
                {pagina.total === 1
                  ? "1 producto"
                  : `${pagina.total} productos`}
              </p>
              <SelectorDeOrden filtros={filtros} />
            </div>

            <ChipsDeFiltros filtros={filtros} {...opciones} />
          </div>

          {/*
            §8 pide tres pantallas distintas, y confundirlas es el error que se
            ve todo el tiempo: «no hay nada» y «no encontramos nada para esto»
            dicen cosas opuestas sobre el negocio.
          */}
          {pagina.productos.length > 0 ? (
            <>
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {pagina.productos.map((producto, i) => (
                  <li key={producto.slug}>
                    <TarjetaProducto
                      producto={producto}
                      // La primera fila está arriba del pliegue: diferirla
                      // penaliza el LCP. Cuatro es el ancho de la grilla.
                      prioridad={i < 4}
                    />
                  </li>
                ))}
              </ul>

              <Paginacion
                filtros={filtros}
                pagina={filtros.pagina}
                paginas={paginas}
              />
            </>
          ) : pagina.totalSinFiltros === 0 ? (
            <Vacio
              titulo="Todavía no hay productos"
              detalle="Estamos cargando el catálogo. Volvé en un rato."
            />
          ) : pagina.total > 0 ? (
            /*
             * Hay resultados, pero no en ESTA página: alguien editó `?pagina`
             * a mano o volvió a un enlace viejo de cuando el catálogo era más
             * grande. Sin este caso caía en «no hay productos con estos
             * filtros» ofreciendo «Limpiar todo» sin ningún filtro puesto —
             * una instrucción imposible de obedecer, que es exactamente el
             * callejón sin salida que el panel ya tuvo una vez.
             */
            <Vacio
              titulo="Esa página no existe"
              detalle={`El catálogo llega hasta la página ${paginas}.`}
              accion={{
                texto: `Ir a la página ${paginas}`,
                href: urlDePagina(filtros, paginas),
              }}
            />
          ) : (
            <Vacio
              titulo={
                filtros.q
                  ? `No encontramos nada para «${filtros.q}»`
                  : "No hay productos con estos filtros"
              }
              detalle="Probá con menos filtros o buscando otra cosa."
              // Sin filtros puestos no se ofrece limpiarlos: un botón que no
              // puede cambiar nada es peor que ningún botón (§8).
              accion={
                hayFiltrosDeTienda(filtros)
                  ? {
                      texto: "Limpiar todo",
                      href: urlDeTienda({ orden: filtros.orden }),
                    }
                  : undefined
              }
            />
          )}
        </main>
      </div>
    </div>
  );
}

/**
 * §8: un estado vacío explica qué falta **y ofrece la acción**. Nunca un
 * espacio en blanco, y nunca «Sin registros».
 */
function Vacio({
  titulo,
  detalle,
  accion,
}: {
  titulo: string;
  detalle: string;
  accion?: { texto: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-20 text-center shadow-md">
      <h2 className="text-heading text-ink">{titulo}</h2>
      <p className="max-w-prose text-body text-ink-secondary">{detalle}</p>
      {accion ? (
        <Button asChild variant="brand" size="lg" className="mt-2">
          <Link href={accion.href}>{accion.texto}</Link>
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Paginación por enlaces — §10.2.
 *
 * Enlaces y no botones: cada página tiene su propia dirección, así que se
 * comparte, se abre en otra pestaña y el atrás vuelve a la anterior. Con
 * botones habría que reimplementar las tres cosas.
 */
function Paginacion({
  filtros,
  pagina,
  paginas,
}: {
  filtros: FiltrosDeTienda;
  pagina: number;
  paginas: number;
}) {
  if (paginas <= 1) return null;

  const numeros = Array.from({ length: paginas }, (_, i) => i + 1);

  return (
    <nav aria-label="Paginación" className="flex justify-center pt-10">
      <ul className="flex flex-wrap items-center gap-1.5">
        {numeros.map((n) => (
          <li key={n}>
            <Button
              asChild
              // `size="icon"` ya son los 44px de área táctil de §9: en un
              // teléfono, números de 28px uno al lado del otro se tocan mal y
              // se erra de página.
              size="icon"
              variant={n === pagina ? "brand" : "tertiary"}
              className={cn(
                "tabular-nums",
                n === pagina ? "font-medium" : "hover:bg-surface-sunken",
              )}
            >
              <Link
                href={urlDePagina(filtros, n)}
                aria-current={n === pagina ? "page" : undefined}
              >
                {n}
                <span className="sr-only">
                  {n === pagina ? " (página actual)" : ` Ir a la página ${n}`}
                </span>
              </Link>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
