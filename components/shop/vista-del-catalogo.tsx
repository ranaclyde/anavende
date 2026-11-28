import Link from "next/link";
import { ViewTransition } from "react";

import {
  ChipsDeFiltros,
  PanelDeFiltros,
} from "@/components/shop/filtros-catalogo";
import { BotonFavorito } from "@/components/shop/favorito";
import { GrillaQueEspera } from "@/components/shop/filtrando";
import { Paginacion } from "@/components/ui/paginacion";
import { SearchBox } from "@/components/shop/search-box";
import { SelectorDeOrden } from "@/components/shop/selector-de-orden";
import { TarjetaProducto } from "@/components/shop/tarjeta-producto";
import { Button } from "@/components/ui/button";
import {
  hayFiltrosDeTienda,
  POR_PAGINA,
  urlDePagina,
  urlSinFiltros,
  type FiltrosDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import {
  leerOpcionesDeFiltro,
  leerPaginaDelCatalogo,
} from "@/modules/catalog/products/tienda";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";
import { getIdentity } from "@/lib/session";

/**
 * Lo que necesita la vista del catálogo. Aparte porque el encabezado de
 * `/productos` también usa las opciones. `favoritos` es `null` sin sesión.
 */
export async function leerElCatalogo(filtros: FiltrosDeTienda) {
  const [pagina, opciones, favoritos] = await Promise.all([
    leerPaginaDelCatalogo(filtros),
    leerOpcionesDeFiltro(filtros),
    getIdentity().then((i) => (i ? idsDeFavoritos(i.userId) : null)),
  ]);
  return { pagina, opciones, favoritos };
}

export type DatosDelCatalogo = Awaited<ReturnType<typeof leerElCatalogo>>;

/**
 * El catálogo debajo del encabezado, compartido por `/productos` y la página
 * de cada categoría. Todo el estado vive en la URL.
 */
export function VistaDelCatalogo({
  filtros,
  datos: { pagina, opciones, favoritos },
  placeholder,
  vacio,
}: {
  filtros: FiltrosDeTienda;
  datos: DatosDelCatalogo;
  placeholder: string;
  /** La pantalla de «todavía no hay productos», distinta en cada página. */
  vacio: {
    titulo: string;
    detalle: string;
    accion?: { texto: string; href: string };
  };
}) {
  const guardados = new Set(favoritos ?? []);
  const volver = urlDePagina(filtros, filtros.pagina);

  const paginas = Math.max(1, Math.ceil(pagina.total / POR_PAGINA));

  return (
    <>
      {/* Búsqueda, filtros y orden. */}
      <div className="relative flex flex-wrap items-center gap-3">
        {/* `conservarFiltros`: buscar no borra los filtros que están a la vista. */}
        {/* `principal`: mientras este se ve, el del encabezado se oculta. */}
        <SearchBox
          className="min-w-60 flex-1"
          conservarFiltros
          seccion={filtros.seccion}
          principal
          placeholder={placeholder}
        />
        {/* `total`, para el «Ver N productos» del pie del panel. */}
        <PanelDeFiltros filtros={filtros} {...opciones} total={pagina.total} />
        <SelectorDeOrden filtros={filtros} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-5 pb-6">
        <ChipsDeFiltros filtros={filtros} {...opciones} />
        <p
          className="ml-auto text-body-sm text-ink-secondary"
          // `aria-atomic`: que se lea «9 productos» y no el número suelto.
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {pagina.total === 1 ? "1 producto" : `${pagina.total} productos`}
        </p>
      </div>

      {/* `<section>` y no `<main>`: el layout de la tienda ya abre uno. */}
      <section id="resultados" aria-label="Resultados">
        {/* «No hay nada» y «no encontramos nada para esto» no son lo mismo. */}
        {pagina.productos.length > 0 ? (
          <>
            {/*
              Las tarjetas se reacomodan solo con el tipo `filtro`: al tocar
              una vuela la foto, y una transición acá la cortaría.
            */}
            <GrillaQueEspera className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {pagina.productos.map((producto, i) => (
                <ViewTransition
                  key={producto.slug}
                  enter={{ filtro: "tarjeta-entra", default: "none" }}
                  exit={{ filtro: "tarjeta-sale", default: "none" }}
                  update={{ filtro: "tarjeta", default: "none" }}
                  default="none"
                >
                  <li>
                    <TarjetaProducto
                      producto={producto}
                      // La primera fila de la grilla más ancha.
                      inmediata={i < 4}
                      accionFavorito={
                        <BotonFavorito
                          forma="corazon"
                          productId={producto.id}
                          nombre={producto.nombre}
                          marcado={guardados.has(producto.id)}
                          conSesion={favoritos !== null}
                          volver={volver}
                        />
                      }
                    />
                  </li>
                </ViewTransition>
              ))}
            </GrillaQueEspera>

            <Paginacion
              pagina={filtros.pagina}
              paginas={paginas}
              href={(n) => urlDePagina(filtros, n)}
            />
          </>
        ) : pagina.totalSinFiltros === 0 ? (
          <Vacio {...vacio} />
        ) : pagina.total > 0 ? (
          // Hay resultados, pero no en esta página (`?pagina` editado o viejo).
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
            accion={
              hayFiltrosDeTienda(filtros)
                ? { texto: "Limpiar todo", href: urlSinFiltros(filtros) }
                : undefined
            }
          />
        )}
      </section>
    </>
  );
}

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
