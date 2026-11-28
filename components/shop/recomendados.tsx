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
import {
  urlDeCategoria,
  urlDeTienda,
} from "@/modules/catalog/products/filtros-tienda";
import {
  leerCompletaTuSetup,
  leerRecomendados,
  POR_BLOQUE,
  type Complementos,
} from "@/modules/catalog/products/recomendados";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";

/**
 * Los bloques de recomendados de la ficha (RF-32). Quien los usa los envuelve
 * en `<Suspense>` con `EsqueletoDeRecomendados`, para no demorar la ficha.
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
  categoria: { slug: string; nombre: string };
  userId: string | null;
}) {
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
            href: urlDeCategoria(categoria.slug),
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
 * «Completá tu setup», del carrito. Va a lo ancho y no en la columna del
 * resumen: es `sticky`, y lo que va debajo se esconde detrás al desplazar.
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

/** Un bloque de complementos: hasta cuatro en grilla; con más, se desliza. */
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
              href:
                categorias.length === 1
                  ? urlDeCategoria(categorias[0].slug)
                  : urlDeTienda({ categoria: categorias.map((c) => c.slug) }),
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

export function Bloques({ children }: { children: React.ReactNode }) {
  return <div className="mt-16 flex flex-col gap-16">{children}</div>;
}

/** Mientras llegan: la forma real, para no empujar el pie de página de golpe. */
export function EsqueletoDeRecomendados({ bloques = 2 }: { bloques?: number }) {
  return (
    <Bloques>
      {Array.from({ length: bloques }, (_, bloque) => (
        <div key={bloque} className="flex flex-col gap-5">
          <Skeleton className="h-6 w-56 max-w-full" />
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: POR_BLOQUE }, (_, i) => (
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
