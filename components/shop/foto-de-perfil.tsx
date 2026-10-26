"use client";

import { Camera } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useCuentaEnPausa } from "@/components/shop/cuenta-en-pausa";
import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FieldHint } from "@/components/ui/label";
import {
  motivoDeRechazo,
  subirImagen,
  type Progreso,
} from "@/modules/media/cliente";
import { TIPOS_ACEPTADOS } from "@/modules/media/tamanos";
import { quitarMiFoto } from "@/modules/users/actions";

/**
 * La foto de perfil, en «Mis datos» — RF-07, F5.9.
 *
 * **Se guarda al elegirla**, sin pasar por «Guardar cambios»: la foto no es
 * un campo que se corrige letra por letra, y atarla al botón del formulario
 * dejaría una foto elegida y sin guardar si alguien se va de la página
 * convencido de que ya la cambió. Lo mismo «Quitar foto».
 *
 * Mientras sube se ve la foto elegida, atenuada, y el botón dice en qué va:
 * primero los bytes por la red y después la conversión del servidor, que con
 * una foto de celular no es instantánea (§9.1).
 *
 * Sin foto, la cuenta tiene igual una cara: el blobatar que arma el servidor
 * a partir del id, y que se mueve al pasar el mouse por la fila
 * (`CaraAnimada`, `data-anima-cara`).
 */
export function FotoDePerfil({
  cara,
  fotoActual,
}: {
  /** Lo que se ve hoy, armado en el servidor: la foto o el blobatar. */
  cara: React.ReactNode;
  /** La clave de la foto guardada, o `null`: dice si hay una y cuándo cambió. */
  fotoActual: string | null;
}) {
  const tieneFoto = fotoActual !== null;
  const router = useRouter();
  const enPausa = useCuentaEnPausa();
  const campoDeArchivo = useRef<HTMLInputElement>(null);

  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<Progreso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [quitando, iniciarQuitar] = useTransition();

  const subiendo = progreso !== null;
  const ocupado = subiendo || quitando;

  // La vista previa es el archivo entero en memoria del navegador; si no se
  // libera, queda retenido hasta recargar.
  useEffect(() => {
    if (!vistaPrevia) return;
    return () => URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  const elegir = async (archivo: File | null) => {
    // Se limpia siempre: si no, elegir la MISMA foto otra vez no dispara
    // `change` y parece que el botón dejó de andar.
    if (campoDeArchivo.current) campoDeArchivo.current.value = "";
    if (!archivo) return;

    setError(null);
    setListo(null);

    const motivo = motivoDeRechazo(archivo);
    if (motivo) {
      setError(motivo);
      return;
    }

    setVistaPrevia(URL.createObjectURL(archivo));
    setProgreso({ fase: "subiendo", porcentaje: 0 });

    const r = await subirImagen(
      {},
      archivo,
      setProgreso,
      "/api/mi-cuenta/foto",
    );

    setProgreso(null);
    if (!r.ok) {
      setVistaPrevia(null);
      setError(r.message);
      return;
    }

    setListo("Listo, cambiamos tu foto.");
    // La foto nueva llega con el refresco —acá y en el encabezado—; recién
    // ahí se suelta la vista previa, para que no parpadee la anterior.
    router.refresh();
  };

  // Cuando llega la foto nueva del servidor, la vista previa ya no hace falta.
  const [fotoVista, setFotoVista] = useState(fotoActual);
  if (fotoVista !== fotoActual) {
    setFotoVista(fotoActual);
    if (!subiendo) setVistaPrevia(null);
  }

  const quitar = () => {
    setError(null);
    setListo(null);
    iniciarQuitar(async () => {
      const r = await quitarMiFoto({});
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setListo("Listo, quitamos tu foto.");
    });
  };

  const etiquetaDeCarga =
    progreso?.fase === "optimizando"
      ? "Preparando la foto"
      : `Subiendo, ${progreso?.porcentaje ?? 0}%`;

  return (
    <div className="flex flex-col gap-3">
      <div data-anima-cara className="flex items-center gap-4">
        {vistaPrevia ? (
          <Avatar
            src={vistaPrevia}
            tamano={96}
            arriba
            className={subiendo ? "opacity-60 transition-opacity" : undefined}
          />
        ) : (
          cara
        )}

        <div className="flex min-w-0 flex-col items-start gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => campoDeArchivo.current?.click()}
              loading={subiendo}
              loadingLabel={etiquetaDeCarga}
              disabled={enPausa || quitando}
              aria-describedby={enPausa ? ID_AVISO_DE_PAUSA : "foto-ayuda"}
            >
              <Camera aria-hidden />
              {tieneFoto ? "Cambiar foto" : "Subir una foto"}
            </Button>

            {tieneFoto ? (
              <Button
                type="button"
                variant="tertiary"
                size="md"
                onClick={quitar}
                loading={quitando}
                loadingLabel="Quitando la foto"
                disabled={enPausa || subiendo}
                aria-describedby={enPausa ? ID_AVISO_DE_PAUSA : undefined}
              >
                Quitar foto
              </Button>
            ) : null}
          </div>

          <FieldHint id="foto-ayuda">
            {subiendo
              ? `${etiquetaDeCarga}…`
              : "JPG, PNG o WEBP, hasta 10 MB. La ven solo vos y la tienda."}
          </FieldHint>
        </div>
      </div>

      {/* El input nativo, escondido y fuera del orden de tabulación: el
          botón es el control, y con los dos se pasaba dos veces por lo mismo. */}
      <input
        ref={campoDeArchivo}
        type="file"
        accept={TIPOS_ACEPTADOS.join(",")}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(e) => elegir(e.target.files?.[0] ?? null)}
        disabled={ocupado || enPausa}
      />

      <FieldError>{error}</FieldError>
      {listo ? (
        <p role="status" className="text-body-sm text-success">
          {listo}
        </p>
      ) : null}
    </div>
  );
}
