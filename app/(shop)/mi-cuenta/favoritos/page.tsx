import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { BotonFavorito } from "@/components/shop/favorito";
import { BotonDeVista } from "@/components/shop/favoritos/boton-de-vista";
import { RenglonDeFavorito } from "@/components/shop/favoritos/renglon";
import { Paginacion } from "@/components/shop/paginacion";
import { TarjetaProducto } from "@/components/shop/tarjeta-producto";
import { Button } from "@/components/ui/button";
import { getIdentity, getSession } from "@/lib/session";
import { POR_PAGINA } from "@/modules/catalog/products/filtros-tienda";
import { leerFavoritos, type Favorito } from "@/modules/users/favoritos/queries";
import { leerVista } from "@/modules/users/favoritos/vista";

export const metadata: Metadata = { title: "Favoritos" };

const RUTA = "/mi-cuenta/favoritos";

/**
 * Favoritos — RF-10. Tarea F5.4.
 *
 * **Lista o tarjetas**, a elección, con la lista por omisión y la elección
 * recordada en una cookie (pedido del 2026-09-14). Las tarjetas son las del
 * catálogo (§6.1); el renglón dice lo mismo en menos alto.
 *
 * **Paginada de a 24**, con la misma paginación por enlaces que el catálogo:
 * no hay tope de favoritos, y sin paginar una lista larga cargaba todo.
 *
 * **Desde acá no se agrega al carrito** (decisión del 2026-09-14): el
 * favorito es del producto y no del color, así que tocarlo lleva a la ficha,
 * donde se elige color y cantidad. RF-10 quedó corregido.
 *
 * **Quitar no saca el favorito en el acto**: el corazón se vacía y el
 * producto se queda hasta la próxima visita. Quien lo quitó sin querer lo
 * vuelve a tocar y listo; si desapareciera, tendría que ir a buscarlo al
 * catálogo.
 */

type Props = {
  searchParams: Promise<{ pagina?: string | string[] }>;
};

function urlDePagina(n: number): string {
  return n === 1 ? RUTA : `${RUTA}?pagina=${n}`;
}

/** Lo que no es un entero positivo vale 1: un `?pagina=x` no es un error. */
function leerPagina(valor: string | string[] | undefined): number {
  const n = Number.parseInt(Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? ""), 10);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default async function Favoritos({ searchParams }: Props) {
  // Independientes entre sí: la sesión, la página pedida y la vista.
  const [sesion, consulta, vista] = await Promise.all([
    getSession(),
    searchParams,
    leerVista(),
  ]);

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect(`/ingresar?volver=${RUTA}`);
  }

  const pagina = leerPagina(consulta.pagina);
  const { favoritos, total } = await leerFavoritos(sesion.profile.id, { pagina });
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Una página que ya no existe —se quitaron favoritos, o un enlace viejo—
  // lleva a la última que sí. Acá no hay filtros que explicar, como en el
  // catálogo: solo hay menos favoritos que antes.
  if (pagina > paginas) redirect(urlDePagina(paginas));

  const corazon = (f: Favorito) => (
    <BotonFavorito
      forma="corazon"
      productId={f.id}
      nombre={f.nombre}
      marcado
      conSesion
      volver={urlDePagina(pagina)}
    />
  );

  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="titulo" className="text-heading text-ink">
            Favoritos
          </h2>
          {total > 0 ? (
            <p className="text-body text-ink-secondary">
              Tocá uno para elegir el color y agregarlo al carrito.
            </p>
          ) : null}
        </div>
        {total > 0 ? <BotonDeVista vista={vista} /> : null}
      </header>

      {total === 0 ? (
        <SinFavoritos />
      ) : vista === "lista" ? (
        <ul className="flex flex-col gap-3">
          {favoritos.map((f) => (
            <li key={f.id}>
              <RenglonDeFavorito favorito={f} accionFavorito={corazon(f)} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {favoritos.map((f, i) => (
            <li key={f.id}>
              <TarjetaProducto
                producto={f}
                noDisponible={!f.activo}
                prioridad={i < 3}
                accionFavorito={corazon(f)}
              />
            </li>
          ))}
        </ul>
      )}

      <Paginacion pagina={pagina} paginas={paginas} href={urlDePagina} />
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
