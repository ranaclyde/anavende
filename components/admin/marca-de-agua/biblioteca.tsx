"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImagePlus, Images, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { CUADRICULA } from "@/components/admin/marca-de-agua/tipos";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
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
}: {
  biblioteca: ImagenDeLaBiblioteca[];
  /** Qué capas GUARDADAS usa cada imagen, por id: «1, 3». */
  usadaEn: Map<string, number[]>;
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

  return (
    <TarjetaDeSeccion
      id="marca-biblioteca"
      titulo="Biblioteca"
      ayuda="Las imágenes que podés usar en las capas. PNG o WEBP con fondo transparente, de hasta 10 MB. Quedan guardadas hasta que las borres."
      acciones={
        biblioteca.length === 0 ? null : (
          <Button
            variant="secondary"
            size="sm"
            loading={subiendo}
            loadingLabel="Subiendo"
            onClick={() => campo.current?.click()}
          >
            <ImagePlus aria-hidden />
            Subir imagen
          </Button>
        )
      }
    >
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

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      {biblioteca.length === 0 ? (
        <VacioDelPanel
          dentro
          icono={Images}
          titulo="Todavía no subiste ninguna"
          accion={
            <Button
              variant="secondary"
              loading={subiendo}
              loadingLabel="Subiendo"
              onClick={() => campo.current?.click()}
            >
              <ImagePlus aria-hidden />
              Subir imagen
            </Button>
          }
        >
          Tu logo, o la plantilla con el nombre de la tienda repetido. Tienen
          que tener fondo transparente: lo que no es transparente tapa la foto.
        </VacioDelPanel>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-3">
          {biblioteca.map((imagen) => {
            const usada = usadaEn.get(imagen.id);
            return (
              <li key={imagen.id} className="flex flex-col gap-1.5">
                <div
                  className="relative grid aspect-square place-items-center overflow-hidden rounded-panel-image border border-border p-3"
                  style={CUADRICULA}
                >
                  <Image
                    src={imagen.url}
                    alt=""
                    width={imagen.ancho}
                    height={imagen.alto}
                    sizes="136px"
                    className="max-h-full w-auto object-contain"
                  />
                  <Button
                    variant="destructive-ghost"
                    size="icon"
                    disabled={borrando}
                    onClick={() => setPorBorrar(imagen)}
                    title="Borrar"
                    className="absolute right-1 top-1 bg-surface/90 shadow-sm"
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">Borrar «{imagen.nombre}»</span>
                  </Button>
                </div>
                <p className="flex min-w-0 flex-col">
                  <span
                    className="truncate text-body-sm text-ink"
                    title={imagen.nombre}
                  >
                    {imagen.nombre}
                  </span>
                  <span className="text-caption text-ink-secondary">
                    {usada ? `En la capa ${usada.join(" y ")}` : "Sin usar"}
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      )}

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
    </TarjetaDeSeccion>
  );
}
