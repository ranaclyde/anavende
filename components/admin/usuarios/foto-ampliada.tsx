"use client";

import Image from "next/image";
import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * La foto de una cuenta, ampliada sin salir de la ficha — F5.9, pedido tuyo
 * del 2026-10-26. Hasta ese día se abría en otra pestaña: a 64px se reconoce a
 * alguien, pero no se ve bien qué subió, y para mirarla había que irse del
 * panel.
 *
 * **A 256px y no más**: es la única versión que se guarda
 * (`TAMANOS_PERFIL`). Estirarla sería mostrar píxeles inventados.
 *
 * Solo con foto propia: el blobatar no tiene nada más que ver, y no es un
 * botón (lo resuelve `Retrato`, en la ficha).
 */
export function FotoAmpliada({ src, nombre }: { src: string; nombre: string }) {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        title="Ver la foto"
        className="shrink-0 cursor-zoom-in rounded-pill transition-opacity duration-150 hover:opacity-85"
      >
        <Avatar src={src} tamano={64} arriba />
        <span className="sr-only">Ver la foto de {nombre}</span>
      </button>

      <Dialog open={abierta} onOpenChange={setAbierta}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Foto de {nombre}</DialogTitle>
          </DialogHeader>
          <Image
            src={src}
            alt={`Foto de perfil de ${nombre}`}
            width={256}
            height={256}
            unoptimized
            className="mx-auto size-64 max-w-full rounded-panel-image bg-surface-sunken object-cover ring-1 ring-border"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
