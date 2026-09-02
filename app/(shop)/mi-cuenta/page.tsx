import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BotonSalir } from "@/components/shop/boton-salir";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getIdentity, getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi cuenta" };

/**
 * Panel del comprador (RF-07). Las secciones —direcciones, favoritos,
 * compras— las construyen F5.3, F5.4 y F6.5. Acá está lo que F1.7 necesita
 * para cerrarse: un lugar al que llegar después de entrar, que demuestre que
 * la sesión y el perfil se resolvieron.
 */
export default async function MiCuenta() {
  const sesion = await getSession();

  if (!sesion) {
    // Hay identidad pero no perfil: falta completarlo (§13.4).
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/mi-cuenta");
  }

  const { profile, identity } = sesion;

  return (
    <div className="mx-auto flex max-w-shop flex-col gap-6 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-title text-ink">Hola, {profile.fullName}</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Mis datos</CardTitle>
          <CardDescription>
            Con estos datos coordinamos tus compras
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="flex flex-col gap-3">
            <Dato etiqueta="Nombre" valor={profile.fullName} />
            <Dato etiqueta="Email" valor={profile.email} />
            <Dato etiqueta="Teléfono" valor={profile.phone} />
            <Dato
              etiqueta="Email verificado"
              valor={identity.emailVerified ? "Sí" : "No"}
            />
            {profile.role === "admin" && <Dato etiqueta="Rol" valor="Administradora" />}
          </dl>
          <BotonSalir />
        </CardContent>
      </Card>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-ink-secondary">{etiqueta}</dt>
      <dd className="text-body text-ink">{valor}</dd>
    </div>
  );
}
