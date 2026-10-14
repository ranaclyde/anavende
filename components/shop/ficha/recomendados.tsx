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
  leerRecomendados,
  POR_BLOQUE,
} from "@/modules/catalog/products/recomendados";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";

/**
 * Los recomendados de la ficha — F8.2, RF-32, DR §7.3.
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
 * **Los dos bloques se distinguen por lo que dicen y por a dónde llevan.**
 * «Productos similares» tiene salida al catálogo de la categoría —es la
 * pregunta que sigue a «¿hay algo parecido?»: «mostrame todos»—; «También te
 * puede interesar» no, porque mezcla categorías y no hay un listado que lo
 * continúe. Un bloque sin candidatos no se dibuja (RF-32).
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

  if (complementos.length === 0 && similares.length === 0) return null;

  const guardados = new Set(favoritos ?? []);

  const tarjetas = (productos: ProductoEnTarjeta[]) =>
    productos.map((producto) => (
      <li key={producto.id}>
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

  return (
    <Bloques>
      {complementos.length > 0 ? (
        <SeccionDeLaHome titulo="También te puede interesar">
          <GrillaDeLaHome>{tarjetas(complementos)}</GrillaDeLaHome>
        </SeccionDeLaHome>
      ) : null}

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

/** 64px entre las columnas y el primer bloque, y entre bloque y bloque (§7.3). */
function Bloques({ children }: { children: React.ReactNode }) {
  return <div className="mt-16 flex flex-col gap-16">{children}</div>;
}

/**
 * Mientras llegan: los dos bloques con la forma real (§8), para que lo que
 * entra no empuje el pie de página de golpe. Si al final uno no tiene
 * candidatos, se cierra ese hueco; está debajo del pliegue, donde no se ve
 * moverse nada.
 */
export function EsqueletoDeRecomendados() {
  return (
    <Bloques>
      {[0, 1].map((bloque) => (
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
