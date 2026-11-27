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
 * Qué hacer con el logo al guardar. Se aplica en el envío, no al tocar el
 * botón: así «Cancelar» cancela también el logo.
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
  palabras = LOGO,
  guardado,
  logo,
  alCambiar,
  error,
  alError,
  deshabilitado,
}: {
  id: string;
  /** Cómo se llama lo que se sube: en la categoría es una imagen. */
  palabras?: { etiqueta: string; sinLogo: string };
  guardado: string | null;
  logo: AccionDeLogo;
  alCambiar: (logo: AccionDeLogo) => void;
  error: string | null;
  alError: (mensaje: string | null) => void;
  deshabilitado: boolean;
}) {
  const campoDeArchivo = useRef<HTMLInputElement>(null);
  const visible = logoVisible(logo, guardado);

  // Si no se libera, el archivo queda retenido hasta recargar la página.
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
      // Si no se limpia, elegir el mismo archivo otra vez no dispara `change`.
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
        {palabras.etiqueta}{" "}
        <span className="font-normal text-ink-secondary">{LOGO.opcional}</span>
      </Label>

      <div className="flex items-center gap-3">
        {/* Tamaño fijo: si creciera al elegir un logo, el diálogo saltaría. */}
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
                : `${palabras.sinLogo}. ${LOGO.ayuda}`}
          </FieldHint>
        </div>
      </div>

      {/* `sr-only` y no `display:none`: así lo alcanzan el `click()` y los
          lectores de pantalla. */}
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
