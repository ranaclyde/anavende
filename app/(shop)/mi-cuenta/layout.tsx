import { BotonSalir } from "@/components/shop/boton-salir";
import { MenuDeLaCuenta } from "@/components/shop/menu-de-la-cuenta";
import type { Metadata } from "next";

import { Avatar } from "@/components/ui/avatar";
import { caraDe } from "@/modules/users/avatar";
import { getSession } from "@/lib/session";
import { FUERA_DEL_INDICE } from "@/lib/seo";

// En el layout alcanza: los metadatos se heredan campo por campo y las
// páginas siguen poniendo su título.
export const metadata: Metadata = { robots: FUERA_DEL_INDICE };

/**
 * **No es la guardia.** Sin sesión deja pasar la página, que redirige al
 * ingreso con su propio `volver` (el layout no sabe en qué ruta está). Tampoco
 * alcanzaría: un layout no se vuelve a ejecutar al navegar entre sus páginas.
 */
export default async function LayoutDeLaCuenta({
  children,
}: {
  children: React.ReactNode;
}) {
  const sesion = await getSession();
  if (!sesion) return children;

  return (
    <div className="mx-auto flex max-w-shop flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* En todas las secciones, no solo en «Mis datos». */}
        <div className="flex min-w-0 items-center gap-3">
          <Avatar src={caraDe(sesion.profile)} tamano={40} arriba />
          <h1 className="text-title text-ink">
            Hola, {sesion.profile.fullName}
          </h1>
        </div>
        <div>
          <BotonSalir />
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-8">
        <MenuDeLaCuenta />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
