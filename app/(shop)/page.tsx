import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BotonFavorito } from "@/components/shop/favorito";
import { BloquesDelHero } from "@/components/shop/home/hero";
import { HileraDePagos } from "@/components/shop/home/pagos";
import {
  GrillaDeLaHome,
  SeccionDeLaHome,
} from "@/components/shop/home/seccion";
import { SearchBox } from "@/components/shop/search-box";
import { TarjetaProducto } from "@/components/shop/tarjeta-producto";
import { Button } from "@/components/ui/button";
import { getIdentity } from "@/lib/session";
import { urlDeTienda } from "@/modules/catalog/products/filtros-tienda";
import { leerHome } from "@/modules/catalog/products/home";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";

export const metadata: Metadata = {
  // Sin `title`: el layout pone «AnaVende» de base y le agrega « · AnaVende»
  // a todo lo demás (`app/layout.tsx`). Con uno propio acá la pestaña decía
  // «AnaVende · AnaVende».
  description:
    "Insumos informáticos nuevos, en caja: teclados, mouses, auriculares, cables y accesorios. Entrega en Viedma, Carmen de Patagones y alrededores.",
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
 * **No hay «Vistos recientemente»**: es RF-33 y se construye en F8.4. Su lugar
 * está previsto en §7.1 y hasta entonces no se dibuja.
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

  /** La tarjeta es la misma de todas las pantallas (§6.1), con su corazón. */
  const tarjetas = (productos: (typeof datos)["destacados"]) =>
    productos.map((producto) => (
      <li key={producto.slug}>
        <TarjetaProducto
          producto={producto}
          // NINGUNA va con prioridad, y eso cambió el 2026-09-22: arriba del
          // pliegue ahora están los bloques del hero, que son los que la
          // piden. Marcar además la primera fila de tarjetas sería pedirle al
          // navegador nueve imágenes urgentes, que es lo mismo que no pedirle
          // ninguna.
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
      {/* ── El hero: el catálogo, la marca y el buscador (§7.1) ────── */}
      <section className="flex flex-col items-center gap-5 pb-10 text-center">
        <BloquesDelHero conjuntos={datos.hero} />

        {/*
          La palabra de la marca, en burdeos y en minúsculas: es el único
          lugar donde se usa así (§2.3, desvío anotado el 2026-09-22). El
          texto del DOM sigue diciendo «AnaVende» —las minúsculas las hace
          CSS—, que es lo que lee un lector de pantalla y lo que se copia al
          portapapeles.
        */}
        <h1 className="text-display lowercase text-brand sm:text-marca">
          AnaVende
        </h1>

        <p className="max-w-prose text-body-lg text-ink-secondary">
          Insumos informáticos nuevos, en caja. Elegí, armá tu pedido y te lo
          llevamos.
        </p>

        <SearchBox
          principal
          placeholder="¿Qué estás buscando hoy?"
          className="w-full max-w-[560px]"
        />

        {datos.destacadas.length > 0 ? (
          <nav aria-label="Categorías destacadas" className="w-full">
            <ul className="flex flex-wrap justify-center gap-2">
              {datos.destacadas.map((categoria) => (
                <li key={categoria.id}>
                  <Link
                    href={urlDeTienda({ categoria: [categoria.id] })}
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
            <GrillaDeLaHome>{tarjetas(datos.destacados)}</GrillaDeLaHome>
          </SeccionDeLaHome>
        ) : null}

        {/* ── Una sección por categoría destacada ──────────────────── */}
        {datos.destacadas.map((categoria) =>
          categoria.productos.length === 0 ? null : (
            <SeccionDeLaHome
              key={categoria.id}
              titulo={categoria.nombre}
              enlace={{
                href: urlDeTienda({ categoria: [categoria.id] }),
                etiqueta: `Ver todo en ${categoria.nombre}`,
              }}
            >
              <GrillaDeLaHome>{tarjetas(categoria.productos)}</GrillaDeLaHome>
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
            <GrillaDeLaHome>{tarjetas(datos.ofertas)}</GrillaDeLaHome>
          </SeccionDeLaHome>
        ) : null}

        <HileraDePagos medios={datos.mediosDePago} />

        {/* ── Más categorías, con la salida apagada ────────────────── */}
        {/*
          El boceto las pide como TARJETAS con foto y nombre. Para eso hace
          falta una imagen de categoría, y `categories` no tiene ninguna: de
          dónde sale —la foto de uno de sus productos o un campo propio, con
          su migración y su subida en el panel— quedó postergado a pedido tuyo
          el 2026-09-22 y está anotado en PROGRESO.md. Hasta entonces, las
          píldoras que ya funcionaban.
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

              {/*
                RNF-08: un botón apagado explica por qué. La pantalla que
                listaría todas las categorías no existe y no tiene tarea en
                ninguna fase; el botón se enciende el día que exista, y
                mientras tanto el hueco se ve —que es lo que hace que alguien
                se acuerde de decidirlo—.
              */}
              <Button
                variant="tertiary"
                size="sm"
                disabled
                title="Todavía no hay una pantalla con todas las categorías"
              >
                Ver todas
              </Button>
            </div>

            <ul className="flex flex-wrap gap-2">
              {datos.masCategorias.map((categoria) => (
                <li key={categoria.id}>
                  <Link
                    href={urlDeTienda({ categoria: [categoria.id] })}
                    className="flex h-11 items-center rounded-pill border border-border bg-surface px-4 text-body-sm text-ink-secondary transition-colors duration-150 hover:border-brand hover:text-brand"
                  >
                    {categoria.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
