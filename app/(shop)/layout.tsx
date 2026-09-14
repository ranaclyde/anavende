import Link from "next/link";
import { Suspense } from "react";

import { ProveedorDeCuentaEnPausa } from "@/components/shop/cuenta-en-pausa";
import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
import { RetomarFavorito } from "@/components/shop/favorito";
import { SiteFooter } from "@/components/shop/site-footer";
import { SiteHeader } from "@/components/shop/site-header";
import { getSession } from "@/lib/session";
import { contarUnidades } from "@/modules/cart/queries";
import { estaEnMantenimiento } from "@/modules/settings/mantenimiento";
import { hayFavoritoPendiente } from "@/modules/users/favoritos/pendiente";

/**
 * Layout de la tienda — DESIGN-REFERENCE §5.1.
 * Encabezado fijo, contenido sobre el canvas y pie oscuro.
 *
 * El encabezado recibe el nombre de quien está adentro (F1.7c) y las unidades
 * de su carrito (F5.5). Sin sesión no hay carrito (RF-08), así que la píldora
 * dice cero sin preguntarle nada a la base.
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

  // Pidió la baja (F5.8): la cuenta es de solo lectura hasta que la
  // administradora la ejecute o el comprador la retire.
  const enPausa = sesion?.profile.closureRequestedAt != null;

  // Las dos dependen de la sesión y no entre sí: en paralelo.
  //
  // Lo barato primero: el rol ya está en la sesión, y el interruptor solo se
  // pregunta si quien mira es administradora. Es la misma memoria que usa el
  // proxy, así que el aviso y el bloqueo dicen siempre lo mismo.
  //
  // El favorito pendiente (F5.4, RF-05) se mira acá y no en cada página: el
  // corazón está en el catálogo y en la ficha, y quien ingresa vuelve a la que
  // estaba. Sin sesión no hay nada que retomar y la nota sigue esperando.
  const [unidadesEnElCarrito, cerradaParaElResto, favoritoPendiente] =
    await Promise.all([
      sesion ? contarUnidades(sesion.profile.id) : 0,
      sesion?.role === "admin" ? estaEnMantenimiento() : false,
      // Con la cuenta en pausa no se retoma nada: la acción la rechazaría.
      sesion && !enPausa ? hayFavoritoPendiente() : false,
    ]);

  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      {cerradaParaElResto ? <AvisoDeTiendaCerrada /> : null}
      {enPausa ? <AvisoDeBajaPedida /> : null}
      {favoritoPendiente ? <RetomarFavorito /> : null}

      {/* El buscador lee la URL, así que el encabezado necesita el límite
          de Suspense que Next exige alrededor de useSearchParams. */}
      <Suspense fallback={<div className="h-14 bg-surface" />}>
        <SiteHeader
          userName={sesion?.profile.fullName ?? null}
          cartCount={unidadesEnElCarrito}
        />
      </Suspense>

      <main className="flex-1">
        <ProveedorDeCuentaEnPausa enPausa={enPausa}>
          {children}
        </ProveedorDeCuentaEnPausa>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Lo que ve quien pidió la baja, en toda la tienda (F5.8, RF-34).
 *
 * Arriba de todo y en cada página porque la pausa afecta a cada página: sin
 * esto, un botón apagado en la ficha no tendría a quién señalar. Dice qué
 * pasa y ofrece la salida. En el tinte de advertencia (§6.4) y no en tinta,
 * que es el aviso de la administradora: son dos mensajes para dos personas.
 */
function AvisoDeBajaPedida() {
  return (
    <div
      role="status"
      className="bg-warning-tint px-4 py-2 text-center text-body-sm text-ink"
    >
      <span id={ID_AVISO_DE_PAUSA}>
        Pediste la baja de tu cuenta: podés mirar la tienda, pero no comprar ni
        hacer cambios.
      </span>{" "}
      <Link
        href="/mi-cuenta#baja"
        className="rounded-pill font-medium underline underline-offset-4"
      >
        Retirar el pedido
      </Link>
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
