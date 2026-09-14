import { BadgeCheck, CircleAlert, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RetirarPedidoDeBaja } from "@/components/shop/baja/retirar";
import { CambiarContrasenaForm } from "@/components/shop/cambiar-contrasena-form";
import { MisDatosForm } from "@/components/shop/mis-datos-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
 * «Mis datos» — RF-07, F5.2. El saludo, «Cerrar sesión» y el menú de
 * secciones están en el layout desde F5.3.
 *
 * **Dos columnas desde `xl`, una por debajo.** Con el menú al costado, a
 * 1024px cada tarjeta quedaría de unos 350px, y Nombre y Apellido —que van
 * uno al lado del otro— no entran cómodos. Cada tarjeta mide lo que su
 * contenido (`items-start`): igualarlas en alto dejaría los botones a
 * distinta altura.
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
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Mis datos</CardTitle>
          <CardDescription>Con estos datos coordinamos tus compras</CardDescription>
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

      {/* RF-34 es de compradores: una administradora no se da de baja. */}
      {sesion.role === "customer" ? (
        <BajaDeLaCuenta
          pedidaEl={profile.closureRequestedAt}
          motivo={profile.closureReason}
        />
      ) : null}
    </div>
  );
}

const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * La baja de la cuenta — RF-34, F5.8.
 *
 * **A la vista y no escondida**: RF-34 es un requisito legal y pide un acceso
 * visible. Va al final, a lo ancho, con su propio `id` porque el pie de la
 * tienda enlaza acá (pedido del 2026-09-14). `scroll-mt` para que el
 * encabezado fijo no la tape al llegar.
 *
 * Pedida, cuenta desde cuándo y con qué motivo, y ofrece retirarla: la
 * cuenta está en pausa, y ésta es la salida que el aviso de arriba promete.
 */
function BajaDeLaCuenta({
  pedidaEl,
  motivo,
}: {
  pedidaEl: Date | null;
  motivo: string | null;
}) {
  return (
    <section
      id="baja"
      aria-label="Baja de la cuenta"
      className="scroll-mt-24 xl:col-span-2"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            Baja de la cuenta
            {pedidaEl ? <Badge tone="warning">Pedida</Badge> : null}
          </CardTitle>
          <CardDescription>
            {pedidaEl
              ? `La pediste el ${FECHA.format(pedidaEl)}. Hasta que la procesemos podés mirar la tienda, pero no comprar ni hacer cambios.`
              : "Si ya no querés usar tu cuenta, podés pedir que la demos de baja. Tus compras no se borran."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {pedidaEl ? (
            <>
              {motivo ? (
                <p className="text-body-sm text-ink-secondary">
                  Tu motivo: «{motivo}»
                </p>
              ) : null}
              <RetirarPedidoDeBaja />
            </>
          ) : (
            <Button asChild variant="destructive" size="md" className="self-start">
              <Link href="/mi-cuenta/baja">
                <UserX aria-hidden />
                Pedir la baja de mi cuenta
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
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
