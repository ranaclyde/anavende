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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getIdentity, getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi cuenta" };

/**
 * Panel del comprador (RF-07). «Mis datos» y la contraseña son F5.2; las
 * secciones que faltan —direcciones, favoritos, compras— las construyen F5.3,
 * F5.4 y F6.5.
 *
 * **Dos columnas desde `lg`, una en el teléfono** (2026-09-13). Apiladas en
 * una columna angosta dejaban media pantalla vacía; estiradas a todo el ancho,
 * un campo de nombre de 1200px. Cada tarjeta mide lo que su contenido
 * (`items-start`): igualarlas en alto dejaría los botones a distinta altura.
 * «Cerrar sesión» sube al lado del saludo, que es donde se lo busca, en vez
 * de quedar suelto al pie.
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title text-ink">Hola, {profile.fullName}</h1>
        <div>
          <BotonSalir />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
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
            <MisDatosForm
              firstName={profile.firstName}
              lastName={profile.lastName}
              // Se guarda como +549…; se muestra como lo escribe la gente.
              telefono={profile.phone.replace(/^\+549/, "")}
            />
          </CardContent>
        </Card>

        <Card>
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
      </div>
    </div>
  );
}

/**
 * El email, en un recuadro con la forma de los campos de al lado pero sobre
 * `--canvas`: se lee como un dato que no se edita sin tener que decirlo
 * (pedido del 2026-09-13). Es un `input` de solo lectura y no un texto
 * suelto, así el lector de pantalla lo anuncia como tal y se puede copiar.
 * **El texto no se agrisa**: un email en gris claro es un email que cuesta
 * leer, y lo que tiene que decir «no editable» es el fondo, no la letra.
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
      <Label htmlFor="email">Email</Label>
      <div className="relative">
        <Input
          id="email"
          type="email"
          value={email}
          readOnly
          aria-describedby="email-estado"
          className={cn(
            "cursor-default truncate bg-canvas",
            verificado ? "pr-12" : "pr-36",
          )}
        />
        {verificado ? (
          <span
            id="email-estado"
            title="Email verificado"
            className="absolute inset-y-0 right-4 flex items-center text-success"
          >
            <BadgeCheck aria-hidden className="size-5" />
            <span className="sr-only">Verificado</span>
          </span>
        ) : (
          <span
            id="email-estado"
            className="absolute inset-y-0 right-4 flex items-center gap-1 text-body-sm text-warning"
          >
            <CircleAlert aria-hidden className="size-4" />
            Sin verificar
          </span>
        )}
      </div>
    </div>
  );
}
