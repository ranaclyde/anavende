"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Google y Facebook quedan APAGADOS hasta que F1.7 tenga las apps creadas en
// las consolas de Google y Meta (2026-09-10, pedido tuyo). El componente
// resuelve bien el estado «no configurado» —botones deshabilitados con el
// motivo al lado—, pero dos botones que nadie puede tocar son ruido justo en
// la pantalla donde menos conviene dudar. Para volver: descomentar esta línea
// y la del render, abajo. No hace falta nada más.
// import { ProveedoresSociales } from "@/components/shop/proveedores-sociales";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { enlaceDeWhatsApp } from "@/lib/whatsapp";
import { enviarVerificacion, ingresar } from "@/modules/users/actions";

type Campo = "email" | "password";

/**
 * Ingreso — RF-06, RF-27, RF-34.
 *
 * Cuatro desenlaces además del normal, y cada uno se presenta distinto:
 *   · bloqueado           → se muestra LA RAZÓN registrada (RF-27)
 *   · dado de baja        → otra cosa, y se dice distinto (RF-34, RN-13)
 *   · email sin verificar → se explica y se ofrece reenviar ahí mismo (RF-05)
 *   · cualquier otro      → mensaje genérico que no revela si el email existe
 *
 * **Los dos primeros llegan como el mismo error de GoTrue** (`user_banned`):
 * quién es cada uno lo decide la acción mirando el perfil (§13.5b). Acá lo
 * único que cambia es qué se lee, y es todo el punto de RN-13: a quien se fue
 * por su cuenta no se le dice que está bloqueado.
 */
export function LoginForm({
  volver,
  whatsapp,
}: {
  volver?: string;
  /** Para los avisos de cuenta bloqueada y dada de baja. `null` si no hay. */
  whatsapp?: string | null;
}) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [reenviando, iniciarReenvio] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);
  const [reenviado, setReenviado] = useState(false);

  const bloqueado = errores.codigo === "USER_BANNED";
  const dadoDeBaja = errores.codigo === "ACCOUNT_CLOSED";
  const sinVerificar = errores.codigo === "EMAIL_NOT_VERIFIED";
  const motivo = errores.detalles?.motivo as string | null | undefined;
  const emailSinVerificar = errores.detalles?.email as string | undefined;

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setErrores(SIN_ERRORES);
    setReenviado(false);

    iniciar(async () => {
      const r = await ingresar({
        email: String(datos.get("email") ?? ""),
        password: String(datos.get("password") ?? ""),
      });

      if (!r.ok) {
        setErrores(leerErrores<Campo>(r));
        return;
      }

      router.push(volver && volver.startsWith("/") ? volver : "/mi-cuenta");
      router.refresh();
    });
  };

  const reenviar = () => {
    if (!emailSinVerificar) return;
    iniciarReenvio(async () => {
      // Con el `volver` puesto, el enlace del email devuelve a donde estaba
      // queriendo comprar y no a «Mi cuenta» (F5.7).
      const r = await enviarVerificacion({ email: emailSinVerificar, volver });
      if (r.ok) setReenviado(true);
      else setErrores((prev) => ({ ...prev, general: r.message }));
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingresá a tu cuenta</CardTitle>
        <CardDescription>
          Para ver tus compras, tu carrito y tus favoritos
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* <ProveedoresSociales volver={volver} accion="ingreso" /> */}

        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              aria-invalid={!!errores.campos.email || undefined}
            />
            <FieldError>{errores.campos.email}</FieldError>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="password">Contraseña</Label>
              <Link
                href="/recuperar"
                className="rounded-pill text-caption text-ink-secondary underline underline-offset-4 hover:text-ink"
              >
                ¿La olvidaste?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              aria-invalid={!!errores.campos.password || undefined}
            />
            <FieldError>{errores.campos.password}</FieldError>
          </div>

          {/* RF-27: no alcanza con negar el acceso, hay que decir por qué. */}
          {bloqueado && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-image border border-danger bg-danger-tint p-4"
            >
              <p className="text-body-sm font-medium text-danger">
                Tu cuenta está bloqueada
              </p>
              {motivo && (
                <p className="text-body-sm text-ink">
                  Motivo registrado: {motivo}
                </p>
              )}
              {/* RF-27 pide el motivo Y el canal de contacto. Hasta F7.7 esto
                  nombraba WhatsApp sin llevar a ningún lado; sin número
                  configurado sigue siendo la frase, que es mejor que un
                  enlace roto. */}
              {whatsapp ? (
                <a
                  href={enlaceDeWhatsApp(
                    whatsapp,
                    "Hola, mi cuenta figura bloqueada y quería consultar.",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 rounded-pill text-caption text-ink-secondary underline underline-offset-4 hover:text-ink"
                >
                  <IconoWhatsApp className="size-3.5" />
                  Si creés que es un error, escribinos y lo vemos.
                </a>
              ) : (
                <p className="text-caption text-ink-secondary">
                  Si creés que es un error, escribinos por WhatsApp y lo vemos.
                </p>
              )}
            </div>
          )}

          {/* RF-34 y RN-13: se fue por su cuenta, no lo echaron. Sin motivo
              —lo escribió ella misma— y con la puerta de vuelta, que es lo
              único que le falta saber: volver se pide, y la cuenta está
              entera. */}
          {dadoDeBaja && (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-image border border-border bg-surface-sunken p-4"
            >
              <p className="text-body-sm font-medium text-ink">
                Tu cuenta está dada de baja
              </p>
              <p className="text-body-sm text-ink-secondary">
                La diste de baja vos. No borramos nada: si querés volver,
                escribinos y la reactivamos con tus compras, tus direcciones y
                tus favoritos donde los dejaste.
              </p>
              {whatsapp ? (
                <a
                  href={enlaceDeWhatsApp(
                    whatsapp,
                    "Hola, había dado de baja mi cuenta y quería volver.",
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-1.5 rounded-pill text-caption text-ink-secondary underline underline-offset-4 hover:text-ink"
                >
                  <IconoWhatsApp className="size-3.5" />
                  Escribinos y la reactivamos.
                </a>
              ) : (
                <p className="text-caption text-ink-secondary">
                  Escribinos por WhatsApp y la reactivamos.
                </p>
              )}
            </div>
          )}

          {/* RF-05: se explica y se resuelve en el mismo lugar. */}
          {sinVerificar && (
            <div
              role="alert"
              className="flex flex-col items-start gap-3 rounded-image border border-warning bg-warning-tint p-4"
            >
              <p className="text-body-sm text-ink">
                {reenviado
                  ? "Te mandamos otro email. Abrilo y volvé a entrar."
                  : "Todavía no confirmaste tu email. Abrí el enlace que te mandamos y después entrá."}
              </p>
              {!reenviado && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={reenviando}
                  loadingLabel="Reenviando"
                  onClick={reenviar}
                >
                  Reenviar verificación
                </Button>
              )}
            </div>
          )}

          {!bloqueado && !dadoDeBaja && !sinVerificar && (
            <FieldError>{errores.general}</FieldError>
          )}

          <Button
            type="submit"
            variant="brand"
            size="lg"
            className="w-full"
            loading={enviando}
            loadingLabel="Ingresando"
          >
            Ingresar
          </Button>

          <p className="text-center text-body-sm text-ink-secondary">
            ¿Todavía no tenés cuenta?{" "}
            <Link
              href={volver ? `/registro?volver=${encodeURIComponent(volver)}` : "/registro"}
              className="rounded-pill text-ink underline underline-offset-4"
            >
              Creá una
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
