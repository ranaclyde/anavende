import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { DatosEstructurados } from "@/components/seo/datos-estructurados";
import { BotonFavorito } from "@/components/shop/favorito";
import { HeroDeLaHome } from "@/components/shop/home/hero";
import { HileraDePagos } from "@/components/shop/home/pagos";
import {
  GrillaDeLaHome,
  SeccionDeLaHome,
} from "@/components/shop/home/seccion";
import { SearchBox } from "@/components/shop/search-box";
import { TarjetaCuadradaDeCategoria } from "@/components/shop/tarjeta-de-categoria";
import { TarjetaProducto } from "@/components/shop/tarjeta-producto";
import { VistosRecientemente } from "@/components/shop/vistos";
import { Button } from "@/components/ui/button";
import { organizacion, sitio } from "@/lib/datos-estructurados";
import { NOMBRE_DEL_SITIO, OPEN_GRAPH_BASE } from "@/lib/seo";
import { getIdentity } from "@/lib/session";
import { urlDeTienda } from "@/modules/catalog/products/filtros-tienda";
import { leerHome } from "@/modules/catalog/products/home";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";

const DESCRIPCION =
  "Insumos informáticos nuevos, en caja: teclados, mouses, auriculares, cables y accesorios. Entrega en Viedma, Carmen de Patagones y alrededores.";

export const metadata: Metadata = {
  // Sin `title`: el layout pone «AnaVende» de base y le agrega « · AnaVende»
  // a todo lo demás (`app/layout.tsx`). Con uno propio acá la pestaña decía
  // «AnaVende · AnaVende».
  description: DESCRIPCION,
  // F3.9: la home es la única página del sitio que puede ser «/» y también
  // «/?algo», porque es a donde llega cualquier enlace con parámetros de
  // campaña pegados. El canónico las junta a todas en una.
  alternates: { canonical: "/" },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: "/",
    title: NOMBRE_DEL_SITIO,
    description: DESCRIPCION,
  },
};

/**
 * Home — RF-01, §7.1. Tarea F3.7.
 *
 * **Lo que la pantalla contesta es «¿qué hay acá?»**, y por eso las categorías
 * aparecen tres veces y hacen tres cosas distintas: en el hero son producto a
 * la vista, arriba son chips —un atajo para quien ya sabe qué busca— y en el
 * medio son secciones con producto adentro, para quien no. La de abajo es la
 * cuarta cara: el resto del catálogo, donde lo que importa no es cada producto
 * sino que existan.
 *
 * **Cada bloque desaparece solo si no tiene qué mostrar**, y eso no es un
 * adorno defensivo: es lo que protege a esta pantalla del riesgo P1 del plan.
 * Hoy se mira contra un catálogo sembrado y mañana contra el de Ana, que va a
 * tener otra forma —otras categorías, otra cantidad, quizá ninguna oferta—.
 * Una home que se cae a pedazos cuando cambia el catálogo habría que
 * rehacerla; ésta se acomoda.
 *
 * **«Vistos recientemente»** (F8.4, RF-33) va entre «En oferta» y los medios
 * de pago, donde lo prevé §7.1. Llega por `<Suspense>`: es del visitante y no
 * del catálogo, y la home no lo espera.
 */
export default async function Home() {
  // Independientes: los favoritos son del visitante y el catálogo no es de
  // nadie. Encadenarlas sumaría un viaje a la pantalla de entrada, que es la
  // que más caro paga cada milisegundo (RNF-03).
  const [datos, favoritos] = await Promise.all([
    leerHome(),
    getIdentity().then((i) => (i ? idsDeFavoritos(i.userId) : null)),
  ]);

  const guardados = new Set(favoritos ?? []);

  /**
   * La primera sección que se dibuja: «Destacados» si tiene algo, si no la
   * primera categoría con productos, y si tampoco, las ofertas. Su primera
   * fila es la única que se carga sin diferir (abajo).
   */
  const primeraSeccion =
    datos.destacados.length > 0
      ? "destacados"
      : (datos.destacadas.find((c) => c.productos.length > 0)?.id ?? "ofertas");

  /** La tarjeta es la misma de todas las pantallas (§6.1), con su corazón. */
  const tarjetas = (productos: (typeof datos)["destacados"], seccion: string) =>
    productos.map((producto, i) => (
      <li key={producto.slug}>
        <TarjetaProducto
          producto={producto}
          // La primera fila no puede ir DIFERIDA (2026-10-05): en tableta y
          // escritorio sus tarjetas miden 205–248px de lado, más que
          // cualquier pieza del hero, así que el LCP es una de ellas, y diferida
          // llegaba tarde. Va sin diferir y sin prioridad alta (F10.4: ver
          // `inmediata`). Cuatro es el ancho de la grilla.
          inmediata={seccion === primeraSeccion && i < 4}
          accionFavorito={
            <BotonFavorito
              forma="corazon"
              productId={producto.id}
              nombre={producto.nombre}
              marcado={guardados.has(producto.id)}
              conSesion={favoritos !== null}
              volver="/"
            />
          }
        />
      </li>
    ));

  return (
    <div className="mx-auto w-full max-w-shop px-4 py-8 sm:px-6 lg:px-8">
      {/*
        F3.9 — quién vende y dónde se busca. Van en la home y no en el layout
        a propósito: son la declaración del sitio, y repetirla en cada pantalla
        sería decir trescientas veces lo mismo.
      */}
      <DatosEstructurados datos={[organizacion(), sitio()]} />

      {/* ── El hero: la marca y el eslogan, el catálogo alrededor y el
          buscador (§7.1) ─────────────────────────────────────────── */}
      <section className="flex flex-col items-center gap-5 pb-10 text-center">
        <HeroDeLaHome categorias={datos.destacadas.map((c) => c.nombre)}>
          <SearchBox
            principal
            placeholder="¿Qué estás buscando hoy?"
            // Aire arriba: pegado al eslogan se leía como parte del título.
            className="mt-4 w-full max-w-[560px] sm:mt-6"
          />

          {/* Debajo del buscador y chica a propósito: es la aclaración, no el
              mensaje. */}
          <p className="max-w-prose text-caption font-normal text-balance text-ink-secondary sm:text-body-sm">
            Productos nuevos, cerrados y en su empaque original. Elegí y armá tu
            pedido.
          </p>
        </HeroDeLaHome>

        {datos.destacadas.length > 0 ? (
          <nav aria-label="Categorías destacadas" className="w-full">
            <ul className="flex flex-wrap justify-center gap-2">
              {datos.destacadas.map((categoria) => (
                <li key={categoria.id}>
                  <Link
                    href={urlDeTienda({ categoria: [categoria.slug] })}
                    className="flex h-11 items-center gap-2 rounded-pill border border-border bg-surface px-4 text-body-sm font-medium text-ink shadow-sm transition-colors duration-150 hover:border-brand hover:text-brand sm:pl-2 sm:pr-4"
                  >
                    {/*
                      La inicial es del boceto y es decoración: el nombre está
                      al lado, así que un lector de pantalla no tiene por qué
                      escuchar «T, Teclados».

                      Y va en gris, no en burdeos: siete discos de marca en
                      fila son siete cosas en burdeos que no son la acción de
                      la pantalla, y ésa es la regla de una sola voz (§3.1).
                      El burdeos del hero es el botón del buscador, y uno solo.
                    */}
                    <span
                      aria-hidden
                      // Desde `sm`: a 390px los siete chips con disco pasan
                      // de dos renglones a cuatro, y cuatro renglones de
                      // atajos ya no son un atajo. Sin el disco entran tres
                      // por renglón.
                      className="hidden size-7 place-items-center rounded-full bg-canvas text-caption text-ink-secondary sm:grid"
                    >
                      {categoria.nombre.slice(0, 1)}
                    </span>
                    {categoria.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        {/* ── El aviso de zona (RN-10) ─────────────────────────────── */}
        {/*
          Va ACÁ ARRIBA, pegado a los chips: hasta dónde llevamos es lo primero
          que alguien de Viedma necesita saber para decidir si esta tienda le
          sirve. El pie del sitio lo repite en todas las pantallas y por eso
          acá se dice en una línea —la versión larga, con el retiro en el punto
          de entrega, la sigue diciendo el pie—.
        */}
        <p className="flex w-full items-center justify-center gap-2.5 rounded-card bg-surface p-4 text-left text-body-sm text-ink-secondary shadow-sm">
          {/* El ícono va en gris por la misma regla: es un ícono general, no
              una acción (§3.1). Lo que pesa en este renglón es la zona, y ésa
              está en tinta plena. */}
          <Truck aria-hidden className="size-5 shrink-0 text-ink-secondary" />
          <span>
            <span className="font-medium text-ink">
              Envíos a Viedma, Carmen de Patagones y alrededores
            </span>{" "}
            — coordinamos día y horario por WhatsApp.
          </span>
        </p>
      </section>

      <div className="flex flex-col gap-16 pb-4 sm:gap-20">
        {/* ── Destacados: lo que la vendedora quiere empujar hoy ───── */}
        {datos.destacados.length > 0 ? (
          <SeccionDeLaHome titulo="Destacados">
            <GrillaDeLaHome>
              {tarjetas(datos.destacados, "destacados")}
            </GrillaDeLaHome>
          </SeccionDeLaHome>
        ) : null}

        {/* ── Los medios de pago, justo después de lo primero que se
            mira (2026-10-19, pedido tuyo): cómo se paga es una duda de
            entrada, y al fondo de la página no llegaba casi nadie. ─────── */}
        <HileraDePagos medios={datos.mediosDePago} />

        {/* ── Una sección por categoría destacada ──────────────────── */}
        {datos.destacadas.map((categoria) =>
          categoria.productos.length === 0 ? null : (
            <SeccionDeLaHome
              key={categoria.id}
              titulo={categoria.nombre}
              enlace={{
                href: urlDeTienda({ categoria: [categoria.slug] }),
                etiqueta: `Ver todo en ${categoria.nombre}`,
              }}
            >
              <GrillaDeLaHome>
                {tarjetas(categoria.productos, categoria.id)}
              </GrillaDeLaHome>
            </SeccionDeLaHome>
          ),
        )}

        {datos.ofertas.length > 0 ? (
          <SeccionDeLaHome
            titulo="En oferta"
            enlace={{
              href: urlDeTienda({ oferta: true }),
              etiqueta: "Ver todo lo que está en oferta",
            }}
          >
            <GrillaDeLaHome>
              {tarjetas(datos.ofertas, "ofertas")}
            </GrillaDeLaHome>
          </SeccionDeLaHome>
        ) : null}

        <Suspense fallback={null}>
          <VistosRecientemente ruta="/" />
        </Suspense>

        {/* ── Más categorías, con la salida apagada ────────────────── */}
        {/*
          TARJETAS con imagen y nombre, como pide el boceto. La imagen es un
          campo propio de la categoría (FA-21), cargado en el panel, y es
          opcional: las que no tienen muestran su inicial en el mismo recuadro,
          así que la fila no se desarma con categorías sin imagen mezcladas.
        */}
        {datos.masCategorias.length > 0 ? (
          <section
            aria-labelledby="mas-categorias"
            className="flex flex-col gap-5"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 id="mas-categorias" className="text-heading text-ink">
                Más categorías
              </h2>

              {/* Desde F3.10 lleva a la página con todas (§7.6). En `md` y
                  no en `sm`: apagado no importaba, pero encendido es algo que
                  se toca, y `sm` mide 32px contra los 44 de §9. */}
              <Button asChild variant="tertiary">
                <Link href="/categorias">Ver todas</Link>
              </Button>
            </div>

            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {datos.masCategorias.map((categoria) => (
                <li key={categoria.id}>
                  <TarjetaCuadradaDeCategoria
                    categoria={categoria}
                    imagenUrl={categoria.imagenUrl}
                    sizes="(min-width: 1024px) 12vw, (min-width: 640px) 25vw, 33vw"
                  />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
