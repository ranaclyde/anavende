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
 * La foto de perfil, en «Mis datos» (RF-07). Se guarda al elegirla, sin pasar
 * por «Guardar cambios»: si no, alguien se iría creyendo que ya la cambió.
 */
export function FotoDePerfil({
  cara,
  fotoActual,
}: {
  /** La foto o el blobatar, armado en el servidor. */
  cara: React.ReactNode;
  /** La clave de la foto guardada, o `null`. */
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

  useEffect(() => {
    if (!vistaPrevia) return;
    return () => URL.revokeObjectURL(vistaPrevia);
  }, [vistaPrevia]);

  const elegir = async (archivo: File | null) => {
    // Si no, elegir la misma foto otra vez no dispara `change`.
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
    // La vista previa se suelta recién cuando llega la foto nueva, para que
    // no parpadee la anterior.
    router.refresh();
  };

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

      {/* Fuera del orden de tabulación: el control es el botón. */}
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
