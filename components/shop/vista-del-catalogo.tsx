import Link from "next/link";
import { ViewTransition } from "react";

import {
  ChipsDeFiltros,
  PanelDeFiltros,
} from "@/components/shop/filtros-catalogo";
import { BotonFavorito } from "@/components/shop/favorito";
import { GrillaQueEspera } from "@/components/shop/filtrando";
import { Paginacion } from "@/components/shop/paginacion";
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
 * Lo que necesita la vista del catálogo, en tres lecturas paralelas.
 *
 * Es una función aparte y no algo que haga `VistaDelCatalogo` adentro porque
 * el encabezado de `/productos` también usa las opciones: con una categoría
 * elegida, el título la nombra.
 *
 * Los favoritos van con la identidad y no con la sesión entera (F5.4): son
 * una lectura de datos propios, que se filtra por el id del token sin ir a
 * buscar el perfil (§13.3). `null` es que no hay nadie adentro.
 */
export async function leerElCatalogo(filtros: FiltrosDeTienda) {
  const [pagina, opciones, favoritos] = await Promise.all([
    leerPaginaDelCatalogo(filtros),
    leerOpcionesDeFiltro(filtros.seccion),
    getIdentity().then((i) => (i ? idsDeFavoritos(i.userId) : null)),
  ]);
  return { pagina, opciones, favoritos };
}

export type DatosDelCatalogo = Awaited<ReturnType<typeof leerElCatalogo>>;

/**
 * El catálogo debajo del encabezado — F3.4, F3.8, F3.11, RF-02, §7.2, §10.2.
 *
 * Lo comparten `/productos` y la página de cada categoría, que es el mismo
 * catálogo con la categoría fija (`filtros.seccion`). Cada página pone su
 * encabezado; desde la barra de búsqueda para abajo es esto, y por eso las
 * dos no se pueden separar sin que se note.
 *
 * Todo el estado vive en la URL: filtros, orden y página. Eso es lo que hace
 * que el botón atrás funcione, que el enlace se pueda mandar por WhatsApp tal
 * como se está viendo, y que esta pantalla no necesite ni una línea de estado
 * de cliente para lo que muestra.
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
  /**
   * La pantalla de «todavía no hay productos»: en la tienda y en una
   * categoría no se dice lo mismo, ni se ofrece la misma salida.
   */
  vacio: {
    titulo: string;
    detalle: string;
    accion?: { texto: string; href: string };
  };
}) {
  const guardados = new Set(favoritos ?? []);
  // El corazón de un visitante lleva a ingresar y vuelve acá, con los mismos
  // filtros y en la misma página (RF-10: «sin perder la navegación»).
  const volver = urlDePagina(filtros, filtros.pagina);

  const paginas = Math.max(1, Math.ceil(pagina.total / POR_PAGINA));

  return (
    <>
      {/*
        `relative` acá y no en el `<details>`: el panel se posiciona contra
        ESTA fila, y así se estira de lado a lado por debajo de los tres
        controles en vez de quedar del ancho del botón que lo abre.
      */}
      <div className="relative flex flex-wrap items-center gap-3">
        {/*
          `conservarFiltros`: buscar teniendo puesta una marca no puede
          borrarla — el chip está a la vista y se espera que siga valiendo.
          `seccion`: buscar en una categoría busca en esa categoría.
        */}
        {/*
          `principal`: mientras este buscador se ve, el del encabezado no se
          dibuja (§5.1). Vuelve solo al scrollear más abajo.
        */}
        <SearchBox
          className="min-w-60 flex-1"
          conservarFiltros
          seccion={filtros.seccion}
          principal
          placeholder={placeholder}
        />
        {/*
          `total` es para el botón «Ver N productos» del pie del panel: dice
          cuántos quedan con los filtros que se están tocando, antes de
          cerrarlo.
        */}
        <PanelDeFiltros filtros={filtros} {...opciones} total={pagina.total} />
        <SelectorDeOrden filtros={filtros} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 pt-5 pb-6">
        <ChipsDeFiltros filtros={filtros} {...opciones} />
        <p
          className="ml-auto text-body-sm text-ink-secondary"
          // El conteo cambia al filtrar sin que se mueva el foco: sin esto,
          // quien usa lector de pantalla no se entera de que la lista cambió.
          //
          // `role="status"` además de `aria-live`, y `aria-atomic` para que se
          // lea «9 productos» entero y no el número suelto: un «9» sin sustantivo
          // no dice qué cambió, y es exactamente lo que se anuncia cuando el
          // lector reporta solo el nodo de texto que se modificó.
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {pagina.total === 1 ? "1 producto" : `${pagina.total} productos`}
        </p>
      </div>

      {/*
        `<section>` y no `<main>`: el layout de la tienda ya abre uno, y dos
        landmarks `main` anidados son HTML inválido — un lector de pantalla
        ofrece «saltar al contenido principal» y hay dos destinos.
      */}
      <section id="resultados" aria-label="Resultados">
        {/*
          §8 pide tres pantallas distintas, y confundirlas es el error que se
          ve todo el tiempo: «no hay nada» y «no encontramos nada para esto»
          dicen cosas opuestas sobre el negocio.
        */}
        {pagina.productos.length > 0 ? (
          <>
            {/*
              Al filtrar, ordenar o buscar (2026-10-20), las tarjetas que
              siguen en el resultado se deslizan a su lugar nuevo, las que se
              van se apagan y las nuevas aparecen (`globals.css`, `.tarjeta`).
              Solo con el tipo `filtro` (`lib/transiciones.ts`): la página 2
              cambia todas las tarjetas y además scrollea, y al tocar una la
              que vuela es la foto (`foto-viajera.tsx`), que una transición de
              React acá cortaría. Mientras espera, la grilla se atenúa.
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
                      // La primera fila está arriba del pliegue: diferirla
                      // penaliza el LCP. Cuatro es el ancho de la grilla.
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
                ? { texto: "Limpiar todo", href: urlSinFiltros(filtros) }
                : undefined
            }
          />
        )}
      </section>
    </>
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
