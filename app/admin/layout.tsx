import { notFound, redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/sidebar";
import { scriptDeTema } from "@/components/admin/theme";
import { MarcoDeEscala } from "@/components/ui/escala";
import { Toaster } from "@/components/ui/sonner";
import { getSession } from "@/lib/session";

/**
 * Layout del panel — DESIGN-REFERENCE §4, §5.2 · TECHNICAL-SPEC §13.7.
 *
 * Segunda capa de autorización (F1.12). El proxy ya redirigió a quien no
 * tiene cookie, pero eso es una redirección rápida, no seguridad: acá se lee
 * el ROL DEL PERFIL contra la base, fresco.
 *
 *   anónimo   → redirigido a /ingresar
 *   customer  → 404, no 403: un panel que responde «prohibido» confirma que
 *               existe. Para quien no es administrador, simplemente no está.
 *
 * La tercera capa —el envoltorio de Server Actions— vuelve a verificar en
 * cada mutación. Esta guardia protege lo que se pinta, no lo que se hace.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/ingresar?volver=/admin");
  }

  if (session.role !== "admin" || session.profile.isBanned) {
    notFound();
  }

  return (
    <>
      {/* Corre antes de pintar: sin esto el panel aparece claro y salta a
          oscuro en el primer render. */}
      <script dangerouslySetInnerHTML={{ __html: scriptDeTema }} />

      {/* `MarcoDeEscala` activa la densidad del panel: 14px de base, radios
          de 8-12px y filas de 44px, sin duplicar ningún componente (§4).
          Pone el `data-scale` para el CSS y además lo deja disponible para
          los diálogos y menús, que se pintan fuera de este árbol.

          **En columna hasta `lg`, y ahí sí en fila.** `AdminSidebar` empieza
          con la barra del teléfono, que es una franja de 14 de alto pensada
          para ir ARRIBA del contenido; con `flex` a secas se acomodaba como
          primera columna y se comía 125 de los 390 píxeles de la pantalla,
          dejando el contenido en un canuto. Estaba así desde F1.12 y lo
          encontró el repaso de F7.1, que es la primera pantalla del panel
          que se mira en serio desde un teléfono (§6.9). El menú de
          escritorio es `fixed`, así que no participa de esto ni en un caso
          ni en el otro. */}
      <MarcoDeEscala
        escala="admin"
        className="flex min-h-svh flex-col bg-canvas text-ink lg:flex-row"
      >
        <AdminSidebar nombre={session.profile.fullName} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>

        {/* Los avisos viven acá y no en cada pantalla, por dos motivos. Uno:
            un `aria-live` tiene que estar en el DOM antes que su contenido, o
            el lector de pantalla no lo anuncia. Dos: **sobreviven a la
            navegación** —crear un producto empuja a otra pantalla y la
            confirmación tiene que llegar ahí—, y el layout es lo único que no
            se vuelve a montar al navegar dentro del panel.

            Adentro de `MarcoDeEscala` a propósito: `sonner` no usa un portal,
            así que hereda el `data-scale` y la variante `admin:` funciona sin
            el truco de `escala.tsx`. */}
        <Toaster />
      </MarcoDeEscala>
    </>
  );
}
