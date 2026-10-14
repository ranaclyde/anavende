import { ANCHO_EN_CARRUSEL, Carrusel } from "@/components/shop/carrusel";
import { BotonFavorito } from "@/components/shop/favorito";
import {
  GrillaDeLaHome,
  SeccionDeLaHome,
} from "@/components/shop/home/seccion";
import {
  TarjetaProducto,
  type ProductoEnTarjeta,
} from "@/components/shop/tarjeta-producto";
import { Skeleton } from "@/components/ui/skeleton";
import { urlDeTienda } from "@/modules/catalog/products/filtros-tienda";
import {
  leerCompletaTuSetup,
  leerRecomendados,
  POR_BLOQUE,
  type Complementos,
} from "@/modules/catalog/products/recomendados";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";

/**
 * Los bloques de recomendados — RF-32: los dos de la ficha (F8.2, DR §7.3) y
 * «Completá tu setup» del carrito (F8.3, DR §7.4). Las dos pantallas los
 * envuelven en `<Suspense>` con `EsqueletoDeRecomendados`.
 *
 * Los de la ficha:
 *
 * Van a lo ancho, debajo de las dos columnas, y **llegan después**: la página
 * los envuelve en `<Suspense>`, así que la ficha se dibuja sin esperarlos y
 * estos entran por el mismo flujo cuando su consulta termina. Es el criterio
 * «no degradan el tiempo de carga de la ficha» de RF-32 resuelto por
 * construcción: lo que está arriba del pliegue nunca espera a lo que está
 * abajo.
 *
 * **La pieza es la de la home**: título, «Ver todo» y la grilla de cuatro. Una
 * sección de tarjetas es la misma en toda la tienda (§6.1).
 *
 * **Cada bloque lleva a su listado.** «Productos similares», al catálogo de
 * la categoría —la pregunta que sigue a «¿hay algo parecido?» es «mostrame
 * todos»—; «También te puede interesar», al catálogo con TODAS las
 * relacionadas filtradas a la vez, que el filtro suma (RF-02). Un bloque sin
 * candidatos no se dibuja (RF-32).
 */
export async function Recomendados({
  productoId,
  ruta,
  categoria,
  userId,
}: {
  productoId: string;
  /** A dónde vuelve quien toca un corazón sin sesión. */
  ruta: string;
  categoria: { id: string; nombre: string };
  userId: string | null;
}) {
  // Independientes: los favoritos son de quien mira y los recomendados no.
  const [{ complementos, similares }, favoritos] = await Promise.all([
    leerRecomendados(productoId),
    userId ? idsDeFavoritos(userId) : null,
  ]);

  if (complementos.productos.length === 0 && similares.length === 0) {
    return null;
  }

  const tarjetas = (productos: ProductoEnTarjeta[]) => (
    <Tarjetas productos={productos} favoritos={favoritos} ruta={ruta} />
  );

  return (
    <Bloques>
      <BloqueDeComplementos
        titulo="También te puede interesar"
        complementos={complementos}
        favoritos={favoritos}
        ruta={ruta}
      />

      {similares.length > 0 ? (
        <SeccionDeLaHome
          titulo="Productos similares"
          enlace={{
            href: urlDeTienda({ categoria: [categoria.id] }),
            etiqueta: `Ver todo en ${categoria.nombre}`,
          }}
        >
          <GrillaDeLaHome>{tarjetas(similares)}</GrillaDeLaHome>
        </SeccionDeLaHome>
      ) : null}
    </Bloques>
  );
}

/**
 * «Completá tu setup» — F8.3, RF-32, DR §7.4.
 *
 * **Va a lo ancho debajo del carrito, no en la columna del resumen.** §7.4 lo
 * pone «debajo del resumen», y en el teléfono es literal: el resumen es lo
 * último de la lista y el bloque sigue. En escritorio la columna mide 352px y
 * es `sticky`: cuatro tarjetas ahí serían dos columnas de 160px, y algo
 * debajo de una columna pegada se esconde detrás de ella al desplazar. Es la
 * misma decisión que la ficha: los recomendados son otra pantalla dentro de la
 * página.
 *
 * Es un bloque de complementos, como «También te puede interesar»: uno de
 * cada relacionada, deslizable si son más de cuatro, y «Ver todo» con las
 * relacionadas filtradas.
 */
export async function CompletaTuSetup({
  variantes,
  userId,
}: {
  /** Todas las del carrito, también las que ya no se venden. */
  variantes: string[];
  userId: string;
}) {
  const [complementos, favoritos] = await Promise.all([
    leerCompletaTuSetup(variantes),
    idsDeFavoritos(userId),
  ]);

  if (complementos.productos.length === 0) return null;

  return (
    <Bloques>
      <BloqueDeComplementos
        titulo="Completá tu setup"
        complementos={complementos}
        favoritos={favoritos}
        ruta="/carrito"
      />
    </Bloques>
  );
}

/** «Mouses, Micrófonos y Teclados». */
function enumerar(nombres: string[]): string {
  return nombres.length > 1
    ? `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`
    : (nombres[0] ?? "");
}

/**
 * Un bloque de complementos, en la ficha o en el carrito.
 *
 * **Hasta cuatro, la grilla de siempre; con más, la fila se desliza.** Más de
 * cuatro solo pasa cuando hay más de cuatro relacionadas —una tarjeta por
 * cada una, hasta ocho—, y dos filas de grilla empujarían «Productos
 * similares» y el pie de página una pantalla más abajo por algo que es una
 * sugerencia.
 */
function BloqueDeComplementos({
  titulo,
  complementos: { productos, categorias },
  favoritos,
  ruta,
}: {
  titulo: string;
  complementos: Complementos;
  favoritos: string[] | null;
  ruta: string;
}) {
  if (productos.length === 0) return null;

  const enCarrusel = productos.length > POR_BLOQUE;
  const tarjetas = (
    <Tarjetas
      productos={productos}
      favoritos={favoritos}
      ruta={ruta}
      enCarrusel={enCarrusel}
    />
  );

  return (
    <SeccionDeLaHome
      titulo={titulo}
      enlace={
        categorias.length > 0
          ? {
              href: urlDeTienda({ categoria: categorias.map((c) => c.id) }),
              etiqueta: `Ver todo en ${enumerar(categorias.map((c) => c.nombre))}`,
            }
          : undefined
      }
    >
      {enCarrusel ? (
        <Carrusel>{tarjetas}</Carrusel>
      ) : (
        <GrillaDeLaHome>{tarjetas}</GrillaDeLaHome>
      )}
    </SeccionDeLaHome>
  );
}

/**
 * Las tarjetas de un bloque, con su corazón. `favoritos` es `null` sin
 * sesión, y entonces el corazón manda a ingresar y vuelve a `ruta`.
 */
export function Tarjetas({
  productos,
  favoritos,
  ruta,
  enCarrusel = false,
}: {
  productos: ProductoEnTarjeta[];
  favoritos: string[] | null;
  ruta: string;
  enCarrusel?: boolean;
}) {
  const guardados = new Set(favoritos ?? []);

  return productos.map((producto) => (
    <li
      key={producto.id}
      className={enCarrusel ? ANCHO_EN_CARRUSEL : undefined}
    >
      <TarjetaProducto
        producto={producto}
        accionFavorito={
          <BotonFavorito
            forma="corazon"
            productId={producto.id}
            nombre={producto.nombre}
            marcado={guardados.has(producto.id)}
            conSesion={favoritos !== null}
            volver={ruta}
          />
        }
      />
    </li>
  ));
}

/** 64px entre lo de arriba y el primer bloque, y entre bloque y bloque (§7.3). */
export function Bloques({ children }: { children: React.ReactNode }) {
  return <div className="mt-16 flex flex-col gap-16">{children}</div>;
}

/**
 * Mientras llegan: los bloques con la forma real (§8), para que lo que entra
 * no empuje el pie de página de golpe. Si al final uno no tiene candidatos,
 * se cierra ese hueco; está debajo del pliegue, donde no se ve moverse nada.
 */
export function EsqueletoDeRecomendados({ bloques = 2 }: { bloques?: number }) {
  return (
    <Bloques>
      {Array.from({ length: bloques }, (_, bloque) => (
        <div key={bloque} className="flex flex-col gap-5">
          <Skeleton className="h-6 w-56 max-w-full" />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: POR_BLOQUE }, (_, i) => (
              // Las mismas columnas que la grilla de verdad: en tableta son
              // tres, y la cuarta baja a una segunda fila.
              <li
                key={i}
                className="flex flex-col gap-3 rounded-card bg-surface p-3 shadow-md"
              >
                <Skeleton className="aspect-square w-full rounded-image" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-5 w-24" />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </Bloques>
  );
}
