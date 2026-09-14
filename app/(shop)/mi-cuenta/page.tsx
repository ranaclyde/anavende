import { BadgeCheck, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BotonSalir } from "@/components/shop/boton-salir";
import { CambiarContrasenaForm } from "@/components/shop/cambiar-contrasena-form";
import { MisDatosForm } from "@/components/shop/mis-datos-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldHint } from "@/components/ui/label";
import { getIdentity, getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi cuenta" };

/**
 * Panel del comprador (RF-07). «Mis datos» y la contraseña son F5.2; las
 * secciones que faltan —direcciones, favoritos, compras— las construyen F5.3,
 * F5.4 y F6.5.
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
        <CardContent className="flex flex-col gap-5">
          <EmailDeLaCuenta
            email={profile.email}
            verificado={identity.emailVerified}
          />
          {profile.role === "admin" && (
            <p className="text-body-sm text-ink-secondary">
              Tu cuenta es de administradora.
            </p>
          )}
          <MisDatosForm
            firstName={profile.firstName}
            lastName={profile.lastName}
            // Se guarda como +549…; se muestra como lo escribe la gente.
            telefono={profile.phone.replace(/^\+549/, "")}
          />
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Contraseña</CardTitle>
          <CardDescription>
            {identity.tieneContrasena
              ? "Para cambiarla te pedimos la actual"
              : "Entraste con Google o Facebook. Si definís una, también vas a poder entrar con tu email"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CambiarContrasenaForm
            email={profile.email}
            tieneContrasena={identity.tieneContrasena}
          />
        </CardContent>
      </Card>

      <BotonSalir />
    </div>
  );
}

/**
 * El email, con su estado al lado — pedido del 2026-09-13, en lugar del
 * renglón «Email verificado: Sí».
 *
 * **Verificado es un tilde verde** (`--success`), no azul: el azul es el
 * tilde de las redes sociales, que certifica a una persona, no un email.
 * **Sin verificar es ámbar y dice «Sin verificar»**: el rojo en esta tienda
 * es error de formulario (§6.6), y un ícono solo, sin palabra, no le dice a
 * nadie qué le falta. En los dos, el color no es el único portador (§9).
 *
 * En la práctica el ámbar casi no se ve: sin verificar no se puede entrar
 * (RF-05). Está para que un estado raro de la cuenta no se dibuje como bueno.
 */
function EmailDeLaCuenta({
  email,
  verificado,
}: {
  email: string;
  verificado: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-body-sm font-medium text-ink">Email</p>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body text-ink">
        <span className="min-w-0 break-all">{email}</span>
        {verificado ? (
          <span title="Email verificado" className="inline-flex text-success">
            <BadgeCheck aria-hidden className="size-5" />
            <span className="sr-only">(verificado)</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-body-sm text-warning">
            <CircleAlert aria-hidden className="size-4" />
            Sin verificar
          </span>
        )}
      </p>
      <FieldHint>Es con el que entrás; no se cambia desde acá.</FieldHint>
    </div>
  );
}
