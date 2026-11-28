import { BadgeCheck, CircleAlert, UserX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { RetirarPedidoDeBaja } from "@/components/shop/baja/retirar";
import { CambiarContrasenaForm } from "@/components/shop/cambiar-contrasena-form";
import { CaraAnimada } from "@/components/shop/cara-animada";
import { FotoDePerfil } from "@/components/shop/foto-de-perfil";
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
import { telefonoLocal } from "@/lib/telefono";
import { cn } from "@/lib/utils";
import { getIdentity, getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Mi cuenta" };

/**
 * Dos columnas recién desde `xl`: con el menú al costado, a 1024px Nombre y
 * Apellido no entran cómodos uno al lado del otro.
 */
export default async function MiCuenta({
  searchParams,
}: {
  searchParams: Promise<{ contrasena?: string }>;
}) {
  const sesion = await getSession();
  // Quien viene de definir la contraseña desde el enlace de recuperación no
  // tiene otra señal de que salió bien: se dice en la tarjeta de la contraseña.
  const { contrasena } = await searchParams;

  if (!sesion) {
    // Hay identidad pero no perfil: falta completarlo.
    if (await getIdentity()) redirect("/completar-perfil");
    redirect("/ingresar?volver=/mi-cuenta");
  }

  const { profile, identity } = sesion;

  return (
    <div className="grid items-start gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Mis datos</CardTitle>
          <CardDescription>
            Con estos datos coordinamos tus compras
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Arriba de todo, que es donde se busca. */}
          <FotoDePerfil
            cara={<CaraAnimada cuenta={profile} tamano={96} arriba />}
            fotoActual={profile.avatarKey}
          />
          <EmailDeLaCuenta
            email={profile.email}
            verificado={identity.emailVerified}
          />
          <MisDatosForm
            firstName={profile.firstName}
            lastName={profile.lastName}
            // Se guarda como +549…; se muestra como lo escribe la gente.
            telefono={telefonoLocal(profile.phone)}
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
        <CardContent className="flex flex-col gap-5">
          {contrasena === "nueva" ? (
            <p role="status" className="text-body-sm text-success">
              Listo, ya tenés tu contraseña nueva.
            </p>
          ) : null}
          <CambiarContrasenaForm
            email={profile.email}
            tieneContrasena={identity.tieneContrasena}
          />
        </CardContent>
      </Card>

      {/* Una administradora no se da de baja (RF-34 es de compradores). */}
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
 * A la vista y no escondida: RF-34 pide un acceso visible. El `id` es porque
 * el pie de la tienda enlaza acá; `scroll-mt`, para que no la tape el
 * encabezado fijo.
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
            <Button
              asChild
              variant="destructive"
              size="md"
              className="self-start"
            >
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
 * Un `input` de solo lectura y no texto suelto: el lector de pantalla lo
 * anuncia y se puede copiar. «No editable» lo dice el fondo; la letra no se
 * agrisa. Sin verificar casi no se ve (no se puede entrar así), pero un estado
 * raro de la cuenta no tiene que dibujarse como bueno.
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
