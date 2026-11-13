"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Images, Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { CUADRICULA } from "@/components/admin/marca-de-agua/tipos";
import { VacioDelPanel } from "@/components/admin/vacio";
import { avisar, avisarConPero } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { borrarDeLaBiblioteca } from "@/modules/marca-de-agua/actions";
import type { ImagenDeLaBiblioteca } from "@/modules/marca-de-agua/queries";
import { subirImagen } from "@/modules/media/cliente";
import { TAMANO_MAXIMO } from "@/modules/media/tamanos";

/**
 * La biblioteca de marcas de agua — RF-39.
 *
 * Las imágenes quedan hasta que se borran a mano: activar, desactivar o
 * cambiar las capas no las toca.
 *
 * Con imágenes es una tira de miniaturas chicas, arriba de las capas y en la
 * misma tarjeta: se elige de ahí. Sin ninguna es lo único de la pantalla.
 */

/** Solo las que guardan transparencia: un JPG sería un recuadro blanco. */
const ACEPTADAS = ["image/png", "image/webp"];

function motivoDeRechazo(archivo: File): string | null {
  if (archivo.type === "image/jpeg") {
    return `«${archivo.name}» es un JPG, que no tiene fondo transparente. Subila en PNG.`;
  }
  if (!ACEPTADAS.includes(archivo.type)) {
    return `«${archivo.name}» no es una imagen PNG ni WEBP.`;
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return `«${archivo.name}» pesa más de 10 MB. Probá con una más chica.`;
  }
  return null;
}

export function BibliotecaDeMarcas({
  biblioteca,
  usadaEn,
  alAgregarCapa,
  entranMasCapas = true,
}: {
  biblioteca: ImagenDeLaBiblioteca[];
  /** Qué capas GUARDADAS usa cada imagen, por id: «1, 3». */
  usadaEn: Map<string, number[]>;
  /**
   * Arma una capa con esa imagen (2026-11-13). La capa queda ligada a la
   * imagen con la que se armó: para cambiarla, se quita y se arma otra.
   */
  alAgregarCapa?: (imageId: string) => void;
  entranMasCapas?: boolean;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<ImagenDeLaBiblioteca | null>(null);
  const [borrando, iniciar] = useTransition();

  async function subir(archivos: File[]) {
    setError(null);
    const rechazo = archivos.map(motivoDeRechazo).find(Boolean);
    if (rechazo) {
      setError(rechazo);
      return;
    }

    setSubiendo(true);
    // De a una: el servidor procesa cada imagen y el tope de subidas por
    // minuto es por persona (`/api/admin/upload`).
    for (const archivo of archivos) {
      const r = await subirImagen({ destino: "marca-de-agua" }, archivo);
      if (!r.ok) {
        setError(r.message);
        break;
      }
    }
    setSubiendo(false);
    router.refresh();
  }

  const vacia = biblioteca.length === 0;
  const capasDe = porBorrar ? (usadaEn.get(porBorrar.id) ?? []) : [];

  function borrar(imagen: ImagenDeLaBiblioteca) {
    setPorBorrar(null);
    iniciar(async () => {
      const r = await borrarDeLaBiblioteca({ id: imagen.id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      if (r.data.seApago) {
        avisarConPero(
          `Borramos «${imagen.nombre}». Era la única capa, así que la marca de agua quedó desactivada.`,
        );
      } else {
        avisar(`Borramos «${imagen.nombre}».`);
      }
    });
  }

  const subirBoton = (
    <Button
      variant="secondary"
      size={vacia ? "md" : "sm"}
      loading={subiendo}
      loadingLabel="Subiendo"
      onClick={() => campo.current?.click()}
    >
      <ImagePlus aria-hidden />
      Subir imagen
    </Button>
  );

  const entrada = (
    <input
      ref={campo}
      type="file"
      accept={ACEPTADAS.join(",")}
      multiple
      hidden
      onChange={(e) => {
        const archivos = Array.from(e.target.files ?? []);
        e.target.value = "";
        if (archivos.length > 0) void subir(archivos);
      }}
    />
  );

  const aviso =
    error === null ? null : (
      <p role="alert" className="text-body-sm text-danger">
        {error}
      </p>
    );

  // Sin ninguna imagen, la pantalla es solo esto: lo demás —capas,
  // vista previa, el interruptor— no tiene con qué funcionar todavía.
  if (vacia) {
    return (
      <section aria-label="Imágenes" className="flex flex-col gap-3">
        {entrada}
        <VacioDelPanel
          como="h2"
          icono={Images}
          titulo="Empezá por subir tu marca"
          accion={subirBoton}
        >
          Tu logo, o la plantilla con el nombre de la tienda repetido, en PNG o
          WEBP con fondo transparente: lo que no es transparente tapa la foto.
        </VacioDelPanel>
        {aviso}
      </section>
    );
  }

  return (
    <section aria-labelledby="marca-imagenes" className="flex flex-col gap-3">
      {entrada}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="marca-imagenes" className="text-body font-medium text-ink">
            Imágenes
          </h2>
          <p className="text-body-sm text-ink-secondary">
            PNG o WEBP con fondo transparente. Quedan hasta que las borres.
          </p>
        </div>
        {subirBoton}
      </div>

      {aviso}

      <ul className="flex flex-wrap gap-3">
        {biblioteca.map((imagen) => {
          const usada = usadaEn.get(imagen.id);
          return (
            <li key={imagen.id} className="flex w-24 flex-col gap-1">
              <div
                className="relative grid aspect-square place-items-center overflow-hidden rounded-panel-image border border-border p-2"
                style={CUADRICULA}
              >
                <Image
                  src={imagen.url}
                  alt=""
                  width={imagen.ancho}
                  height={imagen.alto}
                  sizes="96px"
                  className="max-h-full w-auto object-contain"
                />
              </div>
              <div className="flex items-start gap-0.5">
                <p className="flex min-w-0 flex-1 flex-col">
                  <span
                    className="truncate text-caption text-ink"
                    title={imagen.nombre}
                  >
                    {imagen.nombre}
                  </span>
                  <span className="text-caption text-ink-secondary">
                    {usada ? `Capa ${usada.join(" y ")}` : "Sin usar"}
                  </span>
                </p>
                <Button
                  variant="destructive-ghost"
                  size="icon"
                  disabled={borrando}
                  onClick={() => setPorBorrar(imagen)}
                  title="Borrar"
                  className="-mr-2 -mt-1 shrink-0"
                >
                  <Trash2 aria-hidden />
                  <span className="sr-only">Borrar «{imagen.nombre}»</span>
                </Button>
              </div>
              {alAgregarCapa ? (
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!entranMasCapas}
                  onClick={() => alAgregarCapa(imagen.id)}
                  className="w-full"
                >
                  <Plus aria-hidden />
                  <span>
                    <span className="sr-only">Agregar una </span>
                    Capa
                    <span className="sr-only"> con «{imagen.nombre}»</span>
                  </span>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={porBorrar !== null}
        onOpenChange={(abierto) => (abierto ? null : setPorBorrar(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar «{porBorrar?.nombre}»</DialogTitle>
            <DialogDescription>
              {capasDe.length === 0
                ? "Se borra de la biblioteca. Las fotos que ya la llevan no cambian."
                : `La usa ${capasDe.length === 1 ? `la capa ${capasDe[0]}` : `las capas ${capasDe.join(" y ")}`}, que se va${capasDe.length === 1 ? "" : "n"} con ella. Las fotos que ya la llevan no cambian.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPorBorrar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive-solid"
              onClick={() => porBorrar && borrar(porBorrar)}
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
