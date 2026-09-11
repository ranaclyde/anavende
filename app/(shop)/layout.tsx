import Link from "next/link";
import { Suspense } from "react";

import { SiteFooter } from "@/components/shop/site-footer";
import { SiteHeader } from "@/components/shop/site-header";
import { getSession } from "@/lib/session";
import { estaEnMantenimiento } from "@/modules/settings/mantenimiento";

/**
 * Layout de la tienda — DESIGN-REFERENCE §5.1.
 * Encabezado fijo, contenido sobre el canvas y pie oscuro.
 *
 * El carrito y el nombre de quien está adentro se leen en F5.5 y F1.7c: acá
 * el encabezado ya recibe los dos, para que sumarlos sea pasar datos y no
 * rehacer el layout.
 */
export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guardia de página: paso 1 de §13.3, más el perfil para el nombre. No es
  // control de acceso —eso lo hace cada página y cada acción—, es el saludo
  // del encabezado.
  const sesion = await getSession();

  // Lo barato primero: el rol ya está en la sesión, y el interruptor solo se
  // pregunta si quien mira es administradora. Es la misma memoria que usa el
  // proxy, así que el aviso y el bloqueo dicen siempre lo mismo.
  const cerradaParaElResto =
    sesion?.role === "admin" && (await estaEnMantenimiento());

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      {cerradaParaElResto ? <AvisoDeTiendaCerrada /> : null}

      {/* El buscador lee la URL, así que el encabezado necesita el límite
          de Suspense que Next exige alrededor de useSearchParams. */}
      <Suspense fallback={<div className="h-14 bg-surface" />}>
        <SiteHeader userName={sesion?.profile.fullName ?? null} />
      </Suspense>

      <main className="flex-1">{children}</main>

      <SiteFooter />
    </div>
  );
}

/**
 * Lo que ve la administradora mientras la tienda está cerrada (F2.7b).
 *
 * Sin esto es fácil olvidarse de reabrirla: la tienda se ve perfecta desde
 * su sesión, y el síntoma de haberla dejado cerrada es que no entre ninguna
 * venta, sin un solo error a la vista.
 *
 * En tinta y no en color: §2.1 reserva el burdeos para la acción y la
 * identidad, y §11 no quiere fondos de color en contenedores de interfaz. La
 * franja oscura se nota igual —es lo único oscuro arriba de una tienda
 * clara— y repite el pie del sitio en vez de sumar un tono.
 */
function AvisoDeTiendaCerrada() {
  return (
    <div
      role="status"
      className="bg-ink px-4 py-2 text-center text-body-sm text-ink-inverse"
    >
      La tienda está cerrada al público: solo vos la ves así.{" "}
      <Link
        href="/admin/configuracion"
        className="rounded-pill font-medium underline underline-offset-4"
      >
        Abrirla
      </Link>
    </div>
  );
}
