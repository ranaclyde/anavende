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
import {
  ANCHO_EN_FILA_DE_CATEGORIAS,
  FilaDeCategorias,
  TarjetaCuadradaDeCategoria,
} from "@/components/shop/tarjeta-de-categoria";
import { TarjetaProducto } from "@/components/shop/tarjeta-producto";
import { VistosRecientemente } from "@/components/shop/vistos";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";
import { SITE_NAME, OPEN_GRAPH_BASE } from "@/lib/seo";
import { getIdentity } from "@/lib/session";
import {
  urlDeCategoria,
  urlDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import { leerHome } from "@/modules/catalog/products/home";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";

const DESCRIPCION =
  "Insumos informáticos nuevos, en caja: teclados, mouses, auriculares, cables y accesorios. Entrega en Viedma, Carmen de Patagones y alrededores.";

export const metadata: Metadata = {
  // Sin `title`: con uno propio el `template` del layout raíz haría
  // «AnaVende · AnaVende».
  description: DESCRIPCION,
  // Los enlaces con parámetros de campaña llegan acá: el canónico junta
  // todas las «/?algo» en una.
  alternates: { canonical: "/" },
  openGraph: {
    ...OPEN_GRAPH_BASE,
    url: "/",
    title: SITE_NAME,
    description: DESCRIPCION,
  },
};

/**
 * Cada bloque desaparece solo si no tiene qué mostrar: no es un adorno
 * defensivo, es lo que deja que la home se acomode a cualquier catálogo.
 * «Vistos recientemente» llega por `<Suspense>`: es del visitante y la home no
 * lo espera.
 */
export default async function Home() {
  const [datos, favoritos] = await Promise.all([
    leerHome(),
    getIdentity().then((i) => (i ? idsDeFavoritos(i.userId) : null)),
  ]);

  const guardados = new Set(favoritos ?? []);

  // Su primera fila es la única que se carga sin diferir.
  const primeraSeccion =
    datos.destacados.length > 0
      ? "destacados"
      : (datos.destacadas.find((c) => c.productos.length > 0)?.id ?? "ofertas");

  const tarjetas = (productos: (typeof datos)["destacados"], seccion: string) =>
    productos.map((producto, i) => (
      <li key={producto.slug}>
        <TarjetaProducto
          producto={producto}
          // La primera fila no puede ir diferida: en tableta y escritorio el
          // LCP es una de sus tarjetas. Cuatro es el ancho de la grilla.
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
    <>
      {/* A todo el ancho y fuera del contenedor. */}
      <HeroDeLaHome
        chips={
          datos.destacadas.length > 0 ? (
            <nav aria-label="Categorías destacadas" className="w-full">
              <ul className="flex flex-wrap gap-2">
                {datos.destacadas.map((categoria) => (
                  <li key={categoria.id}>
                    <Link
                      href={urlDeCategoria(categoria.slug)}
                      className="flex h-11 items-center gap-2 rounded-pill border border-border bg-surface px-4 text-body-sm font-medium text-ink shadow-sm transition-colors duration-150 hover:border-brand hover:text-brand sm:pl-2 sm:pr-4"
                    >
                      {/*
                    Decoración: el lector de pantalla no tiene por qué escuchar
                    «T, Teclados». En gris y no en burdeos: una sola voz (§3.1).
                  */}
                      <span
                        aria-hidden
                        // Desde `sm`: a 390px, con disco, los chips pasan de
                        // dos renglones a cuatro.
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
          ) : null
        }
        categorias={datos.delHero.map((c) => ({
          nombre: c.nombre,
          href: urlDeCategoria(c.slug),
          imagenUrl: c.imagenUrl,
          cantidad: c.cantidad,
        }))}
      >
        <SearchBox
          principal
          placeholder="¿Qué estás buscando hoy?"
          className="w-full max-w-[520px]"
        />
        {/* Chica a propósito: es la aclaración, no el mensaje. */}
        <p className="text-caption font-normal text-ink-secondary sm:text-body-sm">
          Productos nuevos, cerrados y en su empaque original. Elegí y armá tu
          pedido.
        </p>
      </HeroDeLaHome>
      <div className="mx-auto w-full max-w-shop px-4 py-8 sm:px-6 lg:px-8">
        {/* En la home y no en el layout: es la declaración del sitio, una vez. */}
        <DatosEstructurados datos={[organizationJsonLd(), websiteJsonLd()]} />

        {/* El aviso de zona. */}
        <section className="flex flex-col items-center gap-5 pb-10 text-center">
          {/* RN-10. */}
          {/* Arriba: hasta dónde llevamos decide si la tienda sirve. La versión
              larga está en el pie. */}
          <p className="flex w-full items-start justify-center gap-2.5 rounded-card bg-surface p-4 text-left text-body-sm text-ink-secondary shadow-sm">
            {/* En gris: es un ícono general, no una acción (§3.1). */}
            {/* Arriba y no al medio: en el teléfono el texto va en tres renglones. */}
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
          {/* Destacados. */}
          {datos.destacados.length > 0 ? (
            <SeccionDeLaHome titulo="Destacados">
              <GrillaDeLaHome>
                {tarjetas(datos.destacados, "destacados")}
              </GrillaDeLaHome>
            </SeccionDeLaHome>
          ) : null}

          {/* Cómo se paga es una duda de entrada: al fondo no llegaba casi nadie. */}
          <HileraDePagos medios={datos.mediosDePago} />

          {/* Una sección por categoría destacada. */}
          {datos.destacadas.map((categoria) =>
            categoria.productos.length === 0 ? null : (
              <SeccionDeLaHome
                key={categoria.id}
                titulo={categoria.nombre}
                enlace={{
                  href: urlDeCategoria(categoria.slug),
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

          {/* Más categorías. */}
          {/* Sin imagen, la inicial en el mismo recuadro: la fila no se desarma. */}
          {datos.masCategorias.length > 0 ? (
            <SeccionDeLaHome
              titulo="Más categorías"
              enlace={{
                href: "/categorias",
                etiqueta: "Ver todas las categorías",
                texto: "Ver todas",
              }}
            >
              <FilaDeCategorias grilla="sm:grid-cols-4 lg:grid-cols-8">
                {datos.masCategorias.map((categoria) => (
                  <li
                    key={categoria.id}
                    className={ANCHO_EN_FILA_DE_CATEGORIAS}
                  >
                    <TarjetaCuadradaDeCategoria
                      categoria={categoria}
                      imagenUrl={categoria.imagenUrl}
                      sizes="(min-width: 1024px) 12vw, (min-width: 640px) 25vw, 40vw"
                    />
                  </li>
                ))}
              </FilaDeCategorias>
            </SeccionDeLaHome>
          ) : null}
        </div>
      </div>
    </>
  );
}
