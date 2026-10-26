import { BotonSalir } from "@/components/shop/boton-salir";
import { MenuDeLaCuenta } from "@/components/shop/menu-de-la-cuenta";
import type { Metadata } from "next";

import { Avatar } from "@/components/ui/avatar";
import { caraDe } from "@/modules/users/avatar";
import { getSession } from "@/lib/session";
import { FUERA_DEL_INDICE } from "@/lib/seo";

/**
 * Ninguna de estas pantallas va al índice de un buscador (F3.9). Va en el
 * layout y no en cada página: los metadatos se heredan campo por campo, así
 * que alcanza con declararlo una vez y las páginas siguen poniendo su título.
 */
export const metadata: Metadata = { robots: FUERA_DEL_INDICE };

/**
 * «Mi cuenta»: el saludo, «Cerrar sesión» y el menú de secciones, compartidos
 * por todas — RF-07. Nace con F5.3 (2026-09-13).
 *
 * **No es la guardia.** Sin sesión deja pasar la página tal cual, y la
 * página redirige al ingreso con SU `volver`: el layout no sabe en qué
 * ruta está, y quien pidió «Direcciones» tiene que volver a «Direcciones», no
 * a «Mis datos». Tampoco sería suficiente: un layout no se vuelve a ejecutar
 * al navegar entre sus páginas.
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
        {/* La cara al lado del saludo (F5.9): en todas las secciones, y no
            solo en «Mis datos», que es donde se cambia. */}
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
