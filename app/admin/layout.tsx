import { notFound, redirect } from "next/navigation";

import { AdminSidebar } from "@/components/admin/sidebar";
import { scriptDeTema } from "@/components/admin/theme";
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

      {/* data-scale activa la densidad del panel: 14px de base, radios de
          8-12px y filas de 44px, sin duplicar ningún componente (§4). */}
      <div
        data-scale="admin"
        className="flex min-h-svh bg-canvas text-ink"
      >
        <AdminSidebar nombre={session.profile.fullName} />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </>
  );
}
