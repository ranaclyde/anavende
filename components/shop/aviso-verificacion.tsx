"use client";

import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";

import {
  Turnstile,
  TURNSTILE_ACTIVO,
  type ControlDeTurnstile,
} from "@/components/shop/turnstile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field-error";
import { enviarVerificacion } from "@/modules/users/actions";

/**
 * «Revisá tu email» — RF-05.
 * Hasta abrir el enlace no se puede entrar, así que esta pantalla tiene que
 * resolver sola el caso de que el email no llegue: el reenvío vive acá.
 */
export function AvisoDeVerificacion({
  email,
  volver,
}: {
  email?: string;
  /** El mismo destino que viajó en el primer email (F5.7). */
  volver?: string;
}) {
  const [reenviando, iniciar] = useTransition();
  const [reenviado, setReenviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // F10.5b: el reenvío también pide el token de Turnstile.
  const [captcha, setCaptcha] = useState<string | null>(null);
  const turnstile = useRef<ControlDeTurnstile>(null);
  const idDelAviso = useId();
  const faltaCaptcha = TURNSTILE_ACTIVO && !captcha;

  const reenviar = () => {
    if (!email) return;
    setError(null);
    iniciar(async () => {
      const r = await enviarVerificacion({
        email,
        volver,
        captcha: captcha ?? undefined,
      });
      turnstile.current?.reiniciar();
      if (r.ok) setReenviado(true);
      else setError(r.message);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisá tu email</CardTitle>
        <CardDescription>
          Te mandamos un enlace para confirmar la cuenta
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-body-sm text-ink-secondary">
          {email ? (
            <>
              Lo mandamos a <span className="text-ink">{email}</span>. Abrí el
              enlace y ya podés entrar.
            </>
          ) : (
            "Abrí el enlace que te mandamos y ya podés entrar."
          )}{" "}
          Si no lo ves en unos minutos, fijate en el correo no deseado.
        </p>

        {email && (
          <div className="flex flex-col items-start gap-2">
            {reenviado ? (
              <p className="text-body-sm text-success">
                Listo, te mandamos otro.
              </p>
            ) : (
              <>
                <div className="self-stretch">
                  <Turnstile
                    ref={turnstile}
                    onToken={setCaptcha}
                    idDelAviso={idDelAviso}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  loading={reenviando}
                  loadingLabel="Reenviando"
                  disabled={faltaCaptcha}
                  aria-describedby={faltaCaptcha ? idDelAviso : undefined}
                  onClick={reenviar}
                >
                  No me llegó, reenviar
                </Button>
              </>
            )}
            <FieldError>{error}</FieldError>
          </div>
        )}

        <Button asChild variant="tertiary" size="lg" className="self-start">
          <Link
            href={
              volver
                ? `/ingresar?volver=${encodeURIComponent(volver)}`
                : "/ingresar"
            }
          >
            Ir a ingresar
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
