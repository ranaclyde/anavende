import { Carrusel } from "@/components/shop/carrusel";
import {
  GrillaDeLaHome,
  SeccionDeLaHome,
} from "@/components/shop/home/seccion";
import { Tarjetas } from "@/components/shop/recomendados";
import { BorrarVistos } from "@/components/shop/vistos-cliente";
import { getIdentity } from "@/lib/session";
import { POR_BLOQUE } from "@/modules/catalog/products/recomendados";
import { leerVistos } from "@/modules/catalog/products/vistos";
import { idsDeFavoritos } from "@/modules/users/favoritos/queries";

/**
 * «Vistos recientemente» — F8.4, RF-33, DR §7.1 y §7.3.
 *
 * En la home va entre «En oferta» y la hilera de medios de pago (§7.1); en la
 * ficha, debajo de los recomendados, sin el producto que se está viendo. Las
 * dos pantallas lo envuelven en `<Suspense>` **sin esqueleto**: la mayoría de
 * las visitas no tiene historial, y un esqueleto que aparece para desaparecer
 * es peor que un bloque que llega un instante después, debajo del pliegue.
 *
 * Hasta diez, así que **con más de cuatro se desliza**, como los
 * complementos. Arriba a la derecha, en vez de «Ver todo», «Borrar
 * historial».
 */
export async function VistosRecientemente({
  excluir = null,
  ruta,
  className,
}: {
  /** En la ficha, el producto que se está viendo (RF-33). */
  excluir?: string | null;
  /** A dónde vuelve quien toca un corazón sin sesión. */
  ruta: string;
  /** El aire de arriba, que pone cada pantalla y solo si hay bloque. */
  className?: string;
}) {
  // Quién mira sale de `getIdentity`, que está en `cache()`: la página ya la
  // pidió y acá no cuesta otra verificación.
  const [productos, favoritos] = await Promise.all([
    leerVistos(excluir),
    getIdentity().then((i) => (i ? idsDeFavoritos(i.userId) : null)),
  ]);

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
    <div className={className}>
      <SeccionDeLaHome titulo="Vistos recientemente" accion={<BorrarVistos />}>
        {enCarrusel ? (
          <Carrusel>{tarjetas}</Carrusel>
        ) : (
          <GrillaDeLaHome>{tarjetas}</GrillaDeLaHome>
        )}
      </SeccionDeLaHome>
    </div>
  );
}
