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
 * «Vistos recientemente» (RF-33). Va en `<Suspense>` sin esqueleto: la
 * mayoría de las visitas no tiene historial, y el esqueleto aparecería para
 * desaparecer.
 */
export async function VistosRecientemente({
  excluir = null,
  ruta,
  className,
}: {
  /** En la ficha, el producto que se está viendo. */
  excluir?: string | null;
  /** A dónde vuelve quien toca un corazón sin sesión. */
  ruta: string;
  /** El aire de arriba, que va solo si hay bloque. */
  className?: string;
}) {
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
