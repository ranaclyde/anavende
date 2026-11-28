import { AdminSidebar } from "@/components/admin/sidebar";
import { AvisoDeVersion } from "@/components/admin/aviso-de-version";
import { scriptDeTema } from "@/components/admin/theme";
import { MarcoDeEscala } from "@/components/ui/escala";
import { Toaster } from "@/components/ui/sonner";
import { exigirAdmin } from "@/lib/session";
import { versionDelBuild } from "@/lib/version";
import { caraDe } from "@/modules/users/avatar";

/**
 * Segunda capa de autorización (TECHNICAL-SPEC §13.7): el proxy solo mira la
 * cookie; acá se lee el rol del perfil contra la base. Un customer recibe 404,
 * no 403, para no confirmar que el panel existe. Las Server Actions vuelven a
 * verificar en cada mutación.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Cada página lo repite: acá solo no alcanza, porque Next renderiza
  // layout y página en paralelo.
  const session = await exigirAdmin();

  return (
    <>
      {/* Corre antes de pintar: sin esto el panel aparece claro y salta a
          oscuro en el primer render. */}
      <script dangerouslySetInnerHTML={{ __html: scriptDeTema }} />

      {/* En columna hasta `lg`: la barra del teléfono de `AdminSidebar` va
          arriba del contenido, no como primera columna. */}
      <MarcoDeEscala
        escala="admin"
        className="flex min-h-svh flex-col bg-canvas text-ink lg:flex-row"
      >
        <AdminSidebar
          nombre={session.profile.fullName}
          cara={caraDe(session.profile)}
        />
        <main className="min-w-0 flex-1 p-4 lg:p-6">{children}</main>

        {/* En el layout porque no se vuelve a montar al navegar: el aviso
            sobrevive al cambio de pantalla y el `aria-live` ya está en el DOM
            antes que su contenido. Adentro de `MarcoDeEscala` porque `sonner`
            no usa portal y así hereda el `data-scale`. */}
        <Toaster />

        {/* Avisa si hubo un despliegue con el panel abierto: desde ahí
            «Guardar» falla (`lib/version.ts`). */}
        <AvisoDeVersion version={versionDelBuild()} />
      </MarcoDeEscala>
    </>
  );
}
