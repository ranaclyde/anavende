"use client";

import { UserX } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Textarea } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores } from "@/lib/form";
import { pedirLaBaja } from "@/modules/users/baja/actions";
import { MAXIMO_DEL_MOTIVO } from "@/modules/users/baja/schemas";

const OBLIGATORIO = "Contanos por qué te querés ir: es obligatorio.";

/**
 * El motivo y la confirmación — RF-34, F5.8.
 *
 * **El motivo se pide antes de la pregunta**: si falta, se dice en el campo y
 * no se abre el diálogo. Preguntar «¿seguro?» para después rechazar por un
 * campo vacío es hacerle confirmar algo que no iba a pasar.
 *
 * **Confirmar va en un diálogo, con el botón rojo relleno** (DR §2.2): es el
 * único lugar donde el destructivo va relleno, porque ahí no hay un botón de
 * marca al lado con qué confundirlo. Afuera, «Pedir la baja» es de contorno.
 */
export function FormularioDeBaja() {
  const router = useRouter();
  const [motivo, setMotivo] = useState("");
  const [errorDelMotivo, setErrorDelMotivo] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [errorDelDialogo, setErrorDelDialogo] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();

  function preguntar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!motivo.trim()) {
      setErrorDelMotivo(OBLIGATORIO);
      return;
    }
    setErrorDelMotivo(null);
    setErrorDelDialogo(null);
    setConfirmando(true);
  }

  function confirmar() {
    iniciar(async () => {
      const r = await pedirLaBaja({ motivo });

      if (r.ok) {
        // A «Mis datos», donde se ve el pedido y se puede retirar. El
        // `refresh` trae el aviso de arriba y los controles apagados.
        router.push("/mi-cuenta#baja");
        router.refresh();
        return;
      }

      if (r.code === "VALIDATION") {
        setConfirmando(false);
        setErrorDelMotivo(leerErrores<"motivo">(r).campos.motivo ?? r.message);
        return;
      }

      // Órdenes activas que aparecieron mientras tanto, o lo inesperado: se
      // dice en el diálogo, que es donde está mirando.
      setErrorDelDialogo(r.message);
    });
  }

  return (
    <>
      <form onSubmit={preguntar} noValidate className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="motivo">¿Por qué te querés ir?</Label>
          <Textarea
            id="motivo"
            name="motivo"
            rows={4}
            maxLength={MAXIMO_DEL_MOTIVO}
            required
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value);
              if (errorDelMotivo) setErrorDelMotivo(null);
            }}
            aria-invalid={!!errorDelMotivo || undefined}
            aria-describedby="motivo-ayuda"
          />
          {errorDelMotivo ? (
            <FieldError id="motivo-ayuda">{errorDelMotivo}</FieldError>
          ) : (
            <FieldHint id="motivo-ayuda">
              Es obligatorio, y nos ayuda a mejorar. Hasta {MAXIMO_DEL_MOTIVO}{" "}
              caracteres.
            </FieldHint>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button type="submit" variant="destructive" size="lg">
            <UserX aria-hidden />
            Pedir la baja
          </Button>
          <Button asChild variant="tertiary" size="lg">
            <Link href="/mi-cuenta">Volver a Mis datos</Link>
          </Button>
        </div>
      </form>

      <Dialog open={confirmando} onOpenChange={setConfirmando}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Pedir la baja de tu cuenta?</DialogTitle>
            <DialogDescription>
              Desde ahora vas a poder mirar la tienda, pero no comprar ni hacer
              cambios. Hasta que la procesemos, podés retirar el pedido desde
              «Mis datos».
            </DialogDescription>
          </DialogHeader>

          {errorDelDialogo === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {errorDelDialogo}
            </p>
          )}

          <DialogFooter>
            <Button variant="tertiary" onClick={() => setConfirmando(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive-solid"
              loading={enCurso}
              loadingLabel="Pidiendo la baja"
              onClick={confirmar}
            >
              Sí, pedir la baja
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
