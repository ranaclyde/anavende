import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BotonFavorito } from "@/components/shop/favorito";
import { TarjetaProducto } from "@/components/shop/tarjeta-producto";
import { Button } from "@/components/ui/button";
import { getIdentity, getSession } from "@/lib/session";
import { leerFavoritos } from "@/modules/users/favoritos/queries";

export const metadata: Metadata = { title: "Favoritos" };

/**
 * Favoritos — RF-10. Tarea F5.4.
 *
 * **La misma tarjeta que el catálogo** (§6.1), con precio y stock vigentes.
 * **Desde acá no se agrega al carrito** (decisión del 2026-09-14): el
 * favorito es del producto y no del color, así que tocar la tarjeta lleva a
 * la ficha, donde se elige color y cantidad. RF-10 quedó corregido.
 *
 * **Quitar no saca la tarjeta en el acto**: el corazón se vacía y la tarjeta
 * se queda hasta la próxima visita. Quien lo quitó sin querer lo vuelve a
 * tocar y listo; si desapareciera, tendría que ir a buscarlo al catálogo.
 */
export default async function Favoritos() {
  const sesion = await getSession();

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/mi-cuenta/favoritos");
  }

  const favoritos = await leerFavoritos(sesion.profile.id);

  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 id="titulo" className="text-heading text-ink">
          Favoritos
        </h2>
        {favoritos.length > 0 ? (
          <p className="text-body text-ink-secondary">
            Tocá uno para elegir el color y agregarlo al carrito.
          </p>
        ) : null}
      </header>

      {favoritos.length === 0 ? (
        <SinFavoritos />
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {favoritos.map((f, i) => (
            <li key={f.id}>
              <TarjetaProducto
                producto={f}
                noDisponible={!f.activo}
                prioridad={i < 3}
                accionFavorito={
                  <BotonFavorito
                    forma="corazon"
                    productId={f.id}
                    nombre={f.nombre}
                    marcado
                    conSesion
                    volver="/mi-cuenta/favoritos"
                  />
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** §8: «Todavía no tenés favoritos» + «Explorar el catálogo». */
function SinFavoritos() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-16 text-center shadow-md">
      <h3 className="text-heading text-ink">Todavía no tenés favoritos</h3>
      <p className="max-w-prose text-body text-ink-secondary">
        Tocá el corazón de un producto para guardarlo acá.
      </p>
      <Button asChild variant="brand" size="lg" className="mt-2">
        <Link href="/productos">Explorar el catálogo</Link>
      </Button>
    </div>
  );
}
