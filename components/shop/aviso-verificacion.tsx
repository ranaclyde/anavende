"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

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
export function AvisoDeVerificacion({ email }: { email?: string }) {
  const [reenviando, iniciar] = useTransition();
  const [reenviado, setReenviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reenviar = () => {
    if (!email) return;
    setError(null);
    iniciar(async () => {
      const r = await enviarVerificacion({ email });
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
              <Button
                type="button"
                variant="secondary"
                size="md"
                loading={reenviando}
                loadingLabel="Reenviando"
                onClick={reenviar}
              >
                No me llegó, reenviar
              </Button>
            )}
            <FieldError>{error}</FieldError>
          </div>
        )}

        <Button asChild variant="tertiary" size="lg" className="self-start">
          <Link href="/ingresar">Ir a ingresar</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
