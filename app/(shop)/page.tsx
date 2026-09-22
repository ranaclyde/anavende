import { Truck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BotonFavorito } from "@/components/shop/favorito";
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
    "Teclados, mouses, auriculares, cables y accesorios. Entrega en Viedma, Carmen de Patagones y alrededores.",
};

/**
 * Home — RF-01, §7.1. Tarea F3.7.
 *
 * **Lo que la pantalla contesta es «¿qué hay acá?»**, y por eso las categorías
 * aparecen dos veces y hacen dos cosas distintas: arriba son chips —un atajo
 * para quien ya sabe qué busca— y en el medio son secciones con producto
 * adentro, para quien no. La de abajo es la tercera cara: el resto del
 * catálogo, donde lo que importa no es cada producto sino que existan.
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
  const tarjetas = (
    productos: (typeof datos)["destacados"],
    prioridad = false,
  ) =>
    productos.map((producto, i) => (
      <li key={producto.slug}>
        <TarjetaProducto
          producto={producto}
          // Sólo la primera fila de la primera sección: es lo único que está
          // arriba del pliegue, y marcar todo como prioritario es no marcar
          // nada.
          prioridad={prioridad && i < 4}
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
    <div className="mx-auto w-full max-w-shop px-4 py-10 sm:px-6 lg:px-8">
      {/* ── El hero, que es el buscador (§7.1) ─────────────────────── */}
      <section className="flex flex-col items-center gap-5 py-10 text-center sm:py-14">
        <h1 className="text-display text-ink">Todo para tu setup</h1>
        <p className="max-w-prose text-body-lg text-ink-secondary">
          Periféricos y accesorios, con entrega en Viedma, Carmen de Patagones y
          alrededores.
        </p>

        <SearchBox principal className="w-full max-w-[560px]" />

        {datos.destacadas.length > 0 ? (
          <nav aria-label="Categorías destacadas" className="w-full">
            <ul className="flex flex-wrap justify-center gap-2">
              {datos.destacadas.map((categoria) => (
                <li key={categoria.id}>
                  <Link
                    href={urlDeTienda({ categoria: [categoria.id] })}
                    className="flex h-11 items-center rounded-pill border border-border bg-surface px-4 text-body-sm font-medium text-ink shadow-sm transition-colors duration-150 hover:border-brand hover:text-brand"
                  >
                    {categoria.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </section>

      <div className="flex flex-col gap-16 pt-6 pb-4 sm:gap-20">
        {/* ── Una sección por categoría destacada ──────────────────── */}
        {datos.destacadas.map((categoria, i) =>
          categoria.productos.length === 0 ? null : (
            <SeccionDeLaHome
              key={categoria.id}
              titulo={categoria.nombre}
              enlace={{
                href: urlDeTienda({ categoria: [categoria.id] }),
                etiqueta: `Ver todo en ${categoria.nombre}`,
              }}
            >
              <GrillaDeLaHome>
                {tarjetas(categoria.productos, i === 0)}
              </GrillaDeLaHome>
            </SeccionDeLaHome>
          ),
        )}

        {/* ── Destacados y ofertas ─────────────────────────────────── */}
        {datos.destacados.length > 0 ? (
          <SeccionDeLaHome titulo="Destacados">
            <GrillaDeLaHome>{tarjetas(datos.destacados)}</GrillaDeLaHome>
          </SeccionDeLaHome>
        ) : null}

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

        {/* ── El aviso de zona (RN-10) ─────────────────────────────── */}
        {/*
          Va PEGADO a los medios de pago y no al final, aunque §7.1 lo dibuje
          abajo de todo: el pie de página lo repite palabra por palabra en
          todas las pantallas, y los dos párrafos uno abajo del otro se leen
          como un error de la página. Acá arriba cierra el bloque de «cómo
          funciona esto», que es de lo que los dos hablan.
        */}
        <p className="flex items-start gap-2.5 rounded-card bg-surface-sunken p-5 text-body-sm text-ink-secondary">
          <Truck aria-hidden className="mt-0.5 size-5 shrink-0 text-brand" />
          <span>
            Entregamos a domicilio en{" "}
            <span className="font-medium text-ink">
              Viedma, Carmen de Patagones y alrededores
            </span>
            , o lo retirás por nuestro punto de entrega. El envío se coordina
            por WhatsApp cuando armamos tu pedido.
          </span>
        </p>

        {/* ── Más categorías, con la salida apagada ────────────────── */}
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
