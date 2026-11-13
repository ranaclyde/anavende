"use client";

import { ImageUp, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { CapaGuardable } from "@/components/admin/marca-de-agua/tipos";
import type { FotoDeMuestra } from "@/modules/marca-de-agua/queries";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { Button } from "@/components/ui/button";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * La vista previa de la marca — RF-39, TS §9.6.
 *
 * **La arma el servidor, con la misma función que la subida.** Una vista
 * hecha acá con CSS se vería parecida; la del servidor es la que va a
 * quedar. Lo que se manda son las capas que están en pantalla, sin guardar:
 * se prueba antes de guardar, no después.
 *
 * **La foto se achica una vez, acá, a 1400px** —el ancho de `-detail`—,
 * antes de mandarla: cada movimiento de un control pide una vista nueva, y
 * mandar 8 MB por cada una haría que el deslizador se sintiera pegajoso.
 *
 * **Arranca con la última foto de producto que se subió sin marca**, que el
 * servidor lee por su id: una vista previa vacía era media pantalla de caja
 * punteada que no decía nada (2026-11-11). Se cambia por una propia cuando
 * se quiere.
 */

/** Cuánto se espera a que se deje de mover un control antes de pedir. */
const ESPERA_MS = 300;
const ANCHO = 1400;

async function achicar(archivo: File): Promise<Blob> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, ANCHO / bitmap.width);
  const lienzo = document.createElement("canvas");
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext("2d")!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    lienzo.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob"))),
      "image/jpeg",
      0.92,
    ),
  );
}

export function VistaPrevia({
  capas,
  muestra,
}: {
  capas: CapaGuardable[];
  muestra: FotoDeMuestra | null;
}) {
  const campo = useRef<HTMLInputElement>(null);
  const [foto, setFoto] = useState<Blob | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Las capas como texto: el efecto depende de un primitivo y no se dispara
  // por un arreglo nuevo con los mismos valores.
  const pedido = JSON.stringify(capas);

  const muestraId = muestra?.id ?? null;
  const hayFoto = foto !== null || muestraId !== null;

  useEffect(() => {
    if (!foto && !muestraId) return;
    const corte = new AbortController();

    const reloj = setTimeout(async () => {
      setCargando(true);
      const cuerpo = new FormData();
      if (foto) cuerpo.set("foto", foto, "prueba.jpg");
      else if (muestraId) cuerpo.set("muestra", muestraId);
      cuerpo.set("capas", pedido);
      try {
        const r = await fetch("/api/admin/marca-de-agua/vista-previa", {
          method: "POST",
          body: cuerpo,
          signal: corte.signal,
        });
        if (!r.ok) {
          const { message } = (await r.json().catch(() => ({}))) as {
            message?: string;
          };
          setError(
            message ?? "No pudimos armar la vista previa. Probá de nuevo.",
          );
        } else {
          const url = URL.createObjectURL(await r.blob());
          setError(null);
          setResultado(url);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setError("No pudimos armar la vista previa. Revisá la conexión.");
      }
      setCargando(false);
    }, ESPERA_MS);

    return () => {
      clearTimeout(reloj);
      corte.abort();
    };
  }, [foto, muestraId, pedido]);

  // Cada vista se suelta cuando llega la siguiente, y la última al irse de
  // la pantalla: es la limpieza del efecto que depende de ella.
  useEffect(
    () => () => {
      if (resultado) URL.revokeObjectURL(resultado);
    },
    [resultado],
  );

  async function elegir(archivo: File) {
    if (!archivo.type.startsWith("image/") || archivo.size > TAMANO_MAXIMO) {
      setError("Elegí una foto JPG, PNG o WEBP de hasta 10 MB.");
      return;
    }
    try {
      setFoto(await achicar(archivo));
    } catch {
      setError("No pudimos abrir esa foto. Probá con otra.");
    }
  }

  return (
    <TarjetaDeSeccion
      id="marca-vista-previa"
      titulo="Vista previa"
      ayuda={
        foto
          ? "Así queda en la ficha del producto, con la foto que elegiste. No se guarda."
          : muestra
            ? `Así queda en la ficha del producto, con la última foto que subiste: «${muestra.producto}».`
            : "Así queda en la ficha del producto. Probala con una foto tuya: no se guarda."
      }
      acciones={
        hayFoto ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => campo.current?.click()}
          >
            <ImageUp aria-hidden />
            Cambiar foto
          </Button>
        ) : null
      }
    >
      <input
        ref={campo}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (archivo) void elegir(archivo);
        }}
      />

      {!hayFoto ? (
        <button
          type="button"
          onClick={() => campo.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-panel-image border border-dashed border-border-strong bg-surface-sunken px-6 py-8 text-center transition-colors duration-150 hover:border-accent hover:bg-accent-tint focus-visible:shadow-focus focus-visible:outline-none"
        >
          <ImageUp aria-hidden className="size-6 text-ink-secondary" />
          <span className="text-body-sm font-medium text-ink">
            Elegir una foto para probar
          </span>
          <span className="text-caption text-ink-secondary">
            Una de un producto, como las que subís.
          </span>
        </button>
      ) : (
        <div
          className="relative overflow-hidden rounded-panel-image border border-border bg-surface-sunken"
          aria-busy={cargando}
        >
          {resultado ? (
            // `<img>` y no `next/image`: es un `blob:` recién armado, y el
            // optimizador no tiene nada que hacer con él.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resultado}
              alt="La foto de prueba con la marca de agua puesta"
              // Pegada arriba y ancha, una foto vertical pasaría el alto de
              // la pantalla y se cortaría el pie, justo donde va el logo.
              className="mx-auto block h-auto max-h-[calc(100dvh-12rem)] w-auto max-w-full"
            />
          ) : (
            <div className="aspect-[4/3]" />
          )}
          {cargando ? (
            <span
              role="status"
              className="absolute right-2 top-2 flex items-center gap-1.5 rounded-pill bg-surface/90 px-2.5 py-1 text-caption text-ink-secondary shadow-sm"
            >
              <LoaderCircle
                aria-hidden
                className="size-3.5 animate-spin motion-reduce:animate-none"
              />
              Actualizando
            </span>
          ) : null}
        </div>
      )}

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      {hayFoto && capas.length === 0 ? (
        <p className="text-caption text-ink-secondary">
          Sin capas, la foto sale como la subiste.
        </p>
      ) : null}
    </TarjetaDeSeccion>
  );
}
