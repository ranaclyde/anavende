import Link from "next/link";
import { Suspense } from "react";
// Sin esta hoja el blobatar sale quieto. Solo en la tienda: en el panel las
// caras no se mueven.
import "blobatar/motion.css";

import { CaraAnimada } from "@/components/shop/cara-animada";
import { ProveedorDeCuentaEnPausa } from "@/components/shop/cuenta-en-pausa";
import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
import { RetomarFavorito } from "@/components/shop/favorito";
import { SiteFooter } from "@/components/shop/site-footer";
import { SiteHeader } from "@/components/shop/site-header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSession } from "@/lib/session";
import { contarUnidades } from "@/modules/cart/queries";
import { todaysScene } from "@/lib/scenes";
import { estaEnMantenimiento } from "@/modules/settings/mantenimiento";
import { configuracionDeLaTienda } from "@/modules/settings/queries";
import { hayFavoritoPendiente } from "@/modules/users/favoritos/pendiente";

export default async function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // No es control de acceso (eso lo hace cada página y cada acción): es el
  // saludo del encabezado.
  const sesion = await getSession();

  // Con la baja pedida la cuenta es de solo lectura hasta que se ejecute o se
  // retire.
  const enPausa = sesion?.profile.closureRequestedAt != null;

  // El interruptor de mantenimiento lee la misma memoria que el proxy: el
  // aviso y el bloqueo dicen siempre lo mismo.
  //
  // El favorito pendiente se mira acá y no en cada página porque quien ingresa
  // vuelve a la que estaba. Sin sesión, la nota sigue esperando.
  //
  // Si la base no contesta la configuración, el pie sale sin redes y la tienda
  // sin escena, en vez de tirarla entera.
  const [unidadesEnElCarrito, cerradaParaElResto, favoritoPendiente, tienda] =
    await Promise.all([
      sesion ? contarUnidades(sesion.profile.id) : 0,
      sesion?.role === "admin" ? estaEnMantenimiento() : false,
      // Con la cuenta en pausa no se retoma nada: la acción la rechazaría.
      sesion && !enPausa ? hayFavoritoPendiente() : false,
      configuracionDeLaTienda().catch(() => undefined),
    ]);

  const escena = tienda ? todaysScene(tienda.escenas) : null;

  return (
    // Radix exige un proveedor arriba de cualquier tooltip. Va acá y no en la
    // raíz para que Floating UI no viaje al ingreso ni al panel, que no tienen
    // tooltips; si el panel los suma, lleva su propio proveedor.
    <TooltipProvider>
      <div className="flex min-h-svh flex-col bg-canvas">
        {cerradaParaElResto ? <AvisoDeTiendaCerrada /> : null}
        {enPausa ? <AvisoDeBajaPedida /> : null}
        {favoritoPendiente ? <RetomarFavorito /> : null}

        {/* El buscador lee la URL, así que el encabezado necesita el límite
          de Suspense que Next exige alrededor de useSearchParams. */}
        <Suspense fallback={<div className="h-14 bg-surface" />}>
          <SiteHeader
            userName={sesion?.profile.fullName ?? null}
            userCara={sesion ? <CaraAnimada cuenta={sesion.profile} /> : null}
            cartCount={unidadesEnElCarrito}
            escena={escena}
          />
        </Suspense>

        <main className="flex-1">
          <ProveedorDeCuentaEnPausa enPausa={enPausa}>
            {children}
          </ProveedorDeCuentaEnPausa>
        </main>

        <SiteFooter redes={tienda?.redes} />
      </div>
    </TooltipProvider>
  );
}

/**
 * En cada página: es a lo que señalan los botones apagados por la pausa. En
 * tinte de advertencia y no en tinta, que es el aviso de la administradora.
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
 * Sin esto es fácil olvidarse de reabrirla: desde su sesión la tienda se ve
 * perfecta. En tinta y no en burdeos, que §2.1 reserva para la acción.
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
