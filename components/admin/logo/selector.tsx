"use client";

import Image from "next/image";
import { ImageOff, Upload } from "lucide-react";
import { useEffect, useRef } from "react";

import { LOGO } from "@/components/admin/catalogo/copy";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { FieldHint, Label } from "@/components/ui/label";
import { motivoDeRechazo } from "@/modules/media/cliente";
import { TIPOS_ACEPTADOS } from "@/modules/media/tamanos";

/**
 * Elegir, cambiar o quitar un logo — RF-18 (marca) y RF-19 (medio de pago).
 *
 * Salió del diálogo de marcas cuando apareció el segundo consumidor. No es
 * el dibujo lo que se comparte, es el COMPORTAMIENTO: que «Cancelar» cancele
 * también el logo, que la vista previa se libere, que un archivo rechazado
 * deje el campo limpio para poder volver a elegir el mismo. Tres reglas que
 * no se ven en la pantalla y que la segunda copia habría perdido de a una.
 */

/**
 * Qué hacer con el logo al guardar. Se decide acá y se aplica en el envío,
 * en vez de subir o borrar en cuanto se toca el botón: así «Cancelar»
 * cancela de verdad, incluido el logo.
 */
export type AccionDeLogo =
  | { tipo: "mantener" }
  | { tipo: "reemplazar"; archivo: File; vistaPrevia: string }
  | { tipo: "quitar" };

export const LOGO_SIN_TOCAR: AccionDeLogo = { tipo: "mantener" };

/** Lo que se ve ahora: el elegido, el guardado, o nada. */
export function logoVisible(
  logo: AccionDeLogo,
  guardado: string | null,
): string | null {
  return logo.tipo === "reemplazar"
    ? logo.vistaPrevia
    : logo.tipo === "quitar"
      ? null
      : guardado;
}

export function SelectorDeLogo({
  id,
  guardado,
  logo,
  alCambiar,
  error,
  alError,
  deshabilitado,
}: {
  id: string;
  /** La URL del logo que ya está guardado, o `null`. */
  guardado: string | null;
  logo: AccionDeLogo;
  alCambiar: (logo: AccionDeLogo) => void;
  error: string | null;
  alError: (mensaje: string | null) => void;
  deshabilitado: boolean;
}) {
  const campoDeArchivo = useRef<HTMLInputElement>(null);
  const visible = logoVisible(logo, guardado);

  // La vista previa es un objeto en memoria del navegador; si no se libera,
  // el archivo entero queda retenido hasta que se recargue la página.
  useEffect(() => {
    if (logo.tipo !== "reemplazar") return;
    return () => URL.revokeObjectURL(logo.vistaPrevia);
  }, [logo]);

  const elegirArchivo = (archivo: File | null) => {
    alError(null);
    if (!archivo) return;

    const motivo = motivoDeRechazo(archivo);
    if (motivo) {
      alError(motivo);
      // Se limpia el input: si no, elegir el MISMO archivo otra vez no
      // dispara `change` y parece que el botón dejó de andar.
      if (campoDeArchivo.current) campoDeArchivo.current.value = "";
      return;
    }

    alCambiar({
      tipo: "reemplazar",
      archivo,
      vistaPrevia: URL.createObjectURL(archivo),
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        {LOGO.etiqueta}{" "}
        <span className="font-normal text-ink-tertiary">{LOGO.opcional}</span>
      </Label>

      <div className="flex items-center gap-3">
        {/* El recuadro tiene el mismo tamaño con logo y sin logo: si creciera
            al elegir uno, el diálogo entero saltaría bajo el cursor justo
            cuando hay que apretar «Guardar». */}
        <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-panel-control border border-border bg-logo-chip">
          {visible ? (
            <Image
              src={visible}
              alt=""
              width={64}
              height={64}
              unoptimized={logo.tipo === "reemplazar"}
              className="size-full object-contain p-1"
            />
          ) : (
            // Sobre el chip claro, el ícono también tiene que ser oscuro:
            // `--ink-tertiary` se aclara en modo oscuro.
            <ImageOff aria-hidden className="size-5 text-logo-chip-ink" />
          )}
        </span>

        <div className="flex flex-col items-start gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => campoDeArchivo.current?.click()}
              disabled={deshabilitado}
            >
              <Upload aria-hidden />
              {visible ? LOGO.cambiar : LOGO.elegir}
            </Button>

            {visible ? (
              <Button
                type="button"
                variant="tertiary"
                size="sm"
                onClick={() => {
                  alError(null);
                  if (campoDeArchivo.current) campoDeArchivo.current.value = "";
                  alCambiar({ tipo: "quitar" });
                }}
                disabled={deshabilitado}
              >
                {LOGO.quitar}
              </Button>
            ) : null}
          </div>

          <FieldHint>
            {logo.tipo === "reemplazar"
              ? logo.archivo.name
              : visible
                ? LOGO.ayuda
                : `${LOGO.sinLogo}. ${LOGO.ayuda}`}
          </FieldHint>
        </div>
      </div>

      {/* El input nativo va oculto y no `display:none`: escondido así sigue
          siendo alcanzable por el `click()` del botón y por los lectores de
          pantalla. */}
      <input
        ref={campoDeArchivo}
        id={id}
        type="file"
        accept={TIPOS_ACEPTADOS.join(",")}
        className="sr-only"
        onChange={(e) => elegirArchivo(e.target.files?.[0] ?? null)}
      />

      <FieldError>{error}</FieldError>
    </div>
  );
}
