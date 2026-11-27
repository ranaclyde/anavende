"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ImagePlus,
  Maximize2,
  MoreVertical,
  Star,
  Trash2,
  MoveLeft,
  MoveRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field-error";
import { Visor } from "@/components/ui/visor-de-fotos";
import { cn } from "@/lib/utils";
import {
  borrarUnaImagen,
  ordenarImagenes,
} from "@/modules/catalog/variants/actions";
import type { ImagenDeVariante } from "@/modules/catalog/variants/queries";
import {
  motivoDeRechazo,
  subirImagen,
  type Progreso,
} from "@/modules/media/cliente";
import { MAXIMO_POR_VARIANTE, TIPOS_ACEPTADOS } from "@/modules/media/tamanos";

/**
 * La principal es la de la posición 0 (TECHNICAL-SPEC «La imagen principal»).
 * El menú de cada imagen reemplaza al arrastre en el teléfono y el teclado.
 */

type Subida = {
  clave: string;
  nombre: string;
  archivo: File;
  vistaPrevia: string;
  fase: Progreso["fase"];
  porcentaje: number;
};

export function ImagenesDeVariante({
  productId,
  variantId,
  imagenes,
  /** Reutiliza las de otra variante: se ven pero no se tocan. */
  soloLectura,
  etiqueta,
}: {
  productId: string;
  variantId: string;
  imagenes: ImagenDeVariante[];
  soloLectura: boolean;
  etiqueta: string;
}) {
  const router = useRouter();
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<Subida[]>([]);
  const [sobreLaZona, setSobreLaZona] = useState(false);
  const campoDeArchivo = useRef<HTMLInputElement>(null);
  /** Posición de la foto abierta en el visor; `null` = cerrado. */
  const [ampliada, setAmpliada] = useState<number | null>(null);

  // El orden en pantalla, que se adelanta al del servidor. Se resincroniza
  // durante el render y no en un efecto, que pintaría primero el viejo.
  const idsDelServidor = imagenes.map((i) => i.id).join("|");
  const [orden, setOrden] = useState<string[]>(() => imagenes.map((i) => i.id));
  const [ultimoVisto, setUltimoVisto] = useState(idsDelServidor);

  if (ultimoVisto !== idsDelServidor) {
    setUltimoVisto(idsDelServidor);
    setOrden(imagenes.map((i) => i.id));
  }

  const arrastrada = useRef<string | null>(null);

  // También en un ref y no solo en el estado: `dragover` y `drop` pueden
  // llegar en la misma tanda, React agrupa los `setState` y `drop` leería el
  // `orden` anterior, sin guardar nada.
  const ordenPendiente = useRef<string[] | null>(null);
  const previas = useRef(new Set<string>());

  useEffect(() => {
    const abiertas = previas.current;
    return () => {
      for (const url of abiertas) URL.revokeObjectURL(url);
      abiertas.clear();
    };
  }, []);

  const porId = new Map(imagenes.map((i) => [i.id, i]));
  const visibles = orden.flatMap((id) => {
    const imagen = porId.get(id);
    return imagen ? [imagen] : [];
  });

  const espacio = MAXIMO_POR_VARIANTE - visibles.length - subiendo.length;

  const agregar = (elegidos: File[]) => {
    setError(null);
    if (!elegidos.length) return;

    if (espacio <= 0) {
      setError(
        `Ya hay ${MAXIMO_POR_VARIANTE} imágenes, que son las que entran. Borrá una para subir otra.`,
      );
      return;
    }

    const aceptados: File[] = [];
    let primerMotivo: string | null = null;
    let rechazados = 0;

    for (const archivo of elegidos) {
      const motivo = motivoDeRechazo(archivo);
      if (motivo) {
        primerMotivo ??= `«${archivo.name}»: ${motivo}`;
        rechazados++;
        continue;
      }
      aceptados.push(archivo);
    }

    const entran = aceptados.slice(0, espacio);
    const sobran = aceptados.length - entran.length;

    if (primerMotivo) {
      setError(
        rechazados === 1
          ? primerMotivo
          : `${primerMotivo} (y ${rechazados - 1} ${rechazados - 1 === 1 ? "archivo más" : "archivos más"} rechazados)`,
      );
    } else if (sobran > 0) {
      setError(
        `Entran ${MAXIMO_POR_VARIANTE} imágenes por color, así que subimos ${entran.length} y dejamos ${sobran} afuera.`,
      );
    }

    if (!entran.length) return;

    const cola: Subida[] = entran.map((archivo) => {
      const vistaPrevia = URL.createObjectURL(archivo);
      previas.current.add(vistaPrevia);
      return {
        clave: crypto.randomUUID(),
        nombre: archivo.name,
        archivo,
        vistaPrevia,
        fase: "subiendo",
        porcentaje: 0,
      };
    });

    setSubiendo((previo) => [...previo, ...cola]);
    void correr(cola);
  };

  // De a una: cada subida son tres conversiones de sharp, en 4 GB.
  const correr = async (cola: Subida[]) => {
    let alguna = false;
    let fallo: string | null = null;

    for (const item of cola) {
      const resultado = await subirImagen(
        { destino: "variante", productId, variantId },
        item.archivo,
        (avance) =>
          setSubiendo((previo) =>
            previo.map((s) =>
              s.clave === item.clave ? { ...s, ...avance } : s,
            ),
          ),
      );

      URL.revokeObjectURL(item.vistaPrevia);
      previas.current.delete(item.vistaPrevia);
      setSubiendo((previo) => previo.filter((s) => s.clave !== item.clave));

      if (resultado.ok) alguna = true;
      else fallo ??= `«${item.nombre}»: ${resultado.message}`;
    }

    if (fallo) setError(fallo);

    // El Route Handler invalida la caché, pero un envío por XHR no trae la
    // vista nueva: sin esto la galería sigue vacía.
    if (alguna) router.refresh();
  };

  const aplicar = (nuevo: string[]) => {
    setOrden(nuevo);
    setError(null);

    iniciar(async () => {
      const r = await ordenarImagenes({ variantId, ids: nuevo });
      if (!r.ok) {
        setError(r.message);
        // Al del servidor, no al que había en pantalla.
        setOrden(imagenes.map((i) => i.id));
        return;
      }
      router.refresh();
    });
  };

  const mover = (id: string, salto: number) => {
    const desde = orden.indexOf(id);
    const hasta = desde + salto;
    if (desde < 0 || hasta < 0 || hasta >= orden.length) return;
    const nuevo = [...orden];
    nuevo.splice(hasta, 0, ...nuevo.splice(desde, 1));
    aplicar(nuevo);
  };

  const hacerPrincipal = (id: string) => {
    if (orden[0] === id) return;
    aplicar([id, ...orden.filter((x) => x !== id)]);
  };

  const borrar = (id: string) => {
    setError(null);
    iniciar(async () => {
      const r = await borrarUnaImagen({ id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      router.refresh();
    });
  };

  const alPasarPorEncima = (sobreId: string) => {
    const id = arrastrada.current;
    if (!id || id === sobreId) return;

    // Del ref si hay un arrastre en curso, del estado si recién empieza.
    const actual = ordenPendiente.current ?? orden;
    const desde = actual.indexOf(id);
    const hasta = actual.indexOf(sobreId);
    if (desde < 0 || hasta < 0) return;

    const nuevo = [...actual];
    nuevo.splice(hasta, 0, ...nuevo.splice(desde, 1));
    ordenPendiente.current = nuevo;
    setOrden(nuevo);
  };

  const alSoltar = () => {
    const habia = arrastrada.current !== null;
    const nuevo = ordenPendiente.current;
    arrastrada.current = null;
    ordenPendiente.current = null;

    if (habia && nuevo && nuevo.join("|") !== idsDelServidor) aplicar(nuevo);
  };

  // La guarda del ref no sobra: Chrome adjunta el archivo al arrastrar un
  // `<img>`: una miniatura reordenada llega con `Files` y se subiría.
  const traeArchivos = (e: React.DragEvent) =>
    arrastrada.current === null &&
    Array.from(e.dataTransfer.types).includes("Files");

  const visor = (
    <Visor
      imagenes={visibles.map((v) => ({
        grande: v.grande,
        miniatura: v.url,
        alt: v.altText,
      }))}
      actual={Math.min(ampliada ?? 0, Math.max(0, visibles.length - 1))}
      descripcion={etiqueta}
      abierta={ampliada !== null && visibles.length > 0}
      onAbrir={(v) => {
        if (!v) setAmpliada(null);
      }}
      onElegir={setAmpliada}
    />
  );

  if (soloLectura) {
    // El aviso fuera de la lista: un `<p>` dentro de un `<ul>` no es válido.
    return visibles.length === 0 ? (
      <p className="text-caption text-ink-secondary">
        El color del que reutiliza las fotos todavía no tiene ninguna.
      </p>
    ) : (
      <>
        <Galeria>
          {visibles.map((imagen, i) => (
            <li key={imagen.id} className="w-28 sm:w-24">
              <Recuadro>
                <Foto imagen={imagen} etiqueta={etiqueta} />
                {/* Sin arrastre, va un botón de verdad. */}
                <button
                  type="button"
                  onClick={() => setAmpliada(i)}
                  className="absolute inset-0 cursor-zoom-in rounded-panel-image focus-visible:shadow-focus focus-visible:outline-none"
                >
                  <span className="sr-only">
                    Ver más grande la imagen {i + 1} de {etiqueta}
                  </span>
                </button>
              </Recuadro>
              <Posicion i={i} />
            </li>
          ))}
        </Galeria>
        {visor}
      </>
    );
  }

  return (
    <div
      onDragEnter={(e) => {
        if (traeArchivos(e)) setSobreLaZona(true);
      }}
      onDragOver={(e) => {
        // Sin esto el navegador abre el archivo soltado en una pestaña nueva.
        if (traeArchivos(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        // Pasar de una miniatura a otra también dispara `dragleave`.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setSobreLaZona(false);
        }
      }}
      onDrop={(e) => {
        if (!traeArchivos(e)) return;
        e.preventDefault();
        setSobreLaZona(false);
        agregar(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex flex-col gap-2 rounded-panel-card border border-dashed border-transparent p-1 transition-colors",
        sobreLaZona ? "border-brand bg-brand-tint" : null,
      )}
    >
      <Galeria>
        {visibles.map((imagen, i) => (
          <li
            key={imagen.id}
            draggable={!guardando}
            onDragStart={(e) => {
              arrastrada.current = imagen.id;
              e.dataTransfer.effectAllowed = "move";
              // Firefox no empieza el arrastre sin datos adjuntos.
              e.dataTransfer.setData("text/plain", imagen.id);
            }}
            onDragOver={(e) => {
              if (arrastrada.current === null) return;
              e.preventDefault();
              alPasarPorEncima(imagen.id);
            }}
            onDrop={(e) => {
              if (arrastrada.current === null) return;
              e.preventDefault();
              alSoltar();
            }}
            onDragEnd={alSoltar}
            className="w-28 sm:w-24"
          >
            {/* `onClick` del recuadro y no un `<button>`: Firefox no arranca
                un arrastre desde un botón. El teclado usa el menú. */}
            <Recuadro
              className="cursor-zoom-in active:cursor-grabbing"
              onClick={(e) => {
                // Los clics del menú burbujean hasta acá aunque se dibuje en
                // un portal.
                if ((e.target as Element).closest("button, [role='menu']")) {
                  return;
                }
                setAmpliada(i);
              }}
            >
              <Foto imagen={imagen} etiqueta={etiqueta} />

              {/* Encima y no debajo: debajo quedaba más cerca de la foto
                  siguiente. */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={guardando}
                  className="absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-panel-control text-ink-secondary transition-colors hover:text-ink disabled:opacity-40 sm:size-9"
                >
                  {/* Con borde: sobre una foto clara, el chip desaparece. */}
                  <span className="grid size-7 place-items-center rounded-panel-control border border-border bg-surface/85 shadow-sm backdrop-blur-sm">
                    <MoreVertical aria-hidden className="size-4" />
                  </span>
                  <span className="sr-only">
                    Opciones de la imagen {i + 1} de {etiqueta}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setAmpliada(i)}>
                    <Maximize2 aria-hidden />
                    Ver más grande
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={i === 0}
                    onSelect={() => hacerPrincipal(imagen.id)}
                  >
                    <Star aria-hidden />
                    Hacer principal
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={i === 0}
                    onSelect={() => mover(imagen.id, -1)}
                  >
                    <MoveLeft aria-hidden />
                    Mover antes
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={i === visibles.length - 1}
                    onSelect={() => mover(imagen.id, 1)}
                  >
                    <MoveRight aria-hidden />
                    Mover después
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => borrar(imagen.id)}
                    className="text-danger focus:text-danger"
                  >
                    <Trash2 aria-hidden />
                    Borrar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Recuadro>

            <Posicion i={i} />
          </li>
        ))}

        {subiendo.map((s) => (
          <li key={s.clave} className="w-28 sm:w-24">
            <Recuadro>
              {/* `unoptimized`: `next/image` no puede buscar un `blob:`. */}
              <Image
                src={s.vistaPrevia}
                alt=""
                width={96}
                height={96}
                unoptimized
                className="size-full object-contain p-1 opacity-60"
              />
              <div
                role="progressbar"
                aria-valuenow={s.porcentaje}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Subiendo ${s.nombre}`}
                className="absolute inset-x-0 bottom-0 h-1 bg-surface-sunken"
              >
                <div
                  className="h-full bg-brand transition-[width] duration-150"
                  style={{ width: `${s.porcentaje}%` }}
                />
              </div>
            </Recuadro>
            <p className="mt-1 truncate text-caption tabular-nums text-ink-secondary">
              {s.fase === "subiendo" ? `${s.porcentaje}%` : "Optimizando…"}
            </p>
          </li>
        ))}

        {espacio > 0 ? (
          <li className="w-28 sm:w-24">
            <button
              type="button"
              // Adonde lleva el foco agregar un color.
              data-agregar-fotos
              onClick={() => campoDeArchivo.current?.click()}
              className="grid aspect-square w-full place-items-center gap-1 rounded-panel-image border border-dashed border-border-strong text-ink-secondary transition-colors hover:border-brand hover:text-brand"
            >
              <ImagePlus aria-hidden className="size-5" />
              <span className="text-caption">Agregar</span>
              <span className="sr-only">imágenes a {etiqueta}</span>
            </button>
            <p className="mt-1 text-caption text-ink-secondary">
              {espacio === 1 ? "Queda 1" : `Quedan ${espacio}`}
            </p>
          </li>
        ) : null}
      </Galeria>

      {/* `sr-only` y no `display:none`, que lo sacaría de los lectores. */}
      <input
        ref={campoDeArchivo}
        type="file"
        multiple
        accept={TIPOS_ACEPTADOS.join(",")}
        aria-label={`Imágenes para ${etiqueta}`}
        // Se llega por el botón «Agregar».
        tabIndex={-1}
        className="sr-only"
        onChange={(e) => {
          agregar(Array.from(e.target.files ?? []));
          // Sin esto, elegir el mismo archivo otra vez no dispara `change`.
          e.target.value = "";
        }}
      />

      {/* Qué entra se explica una vez, arriba de la sección. */}
      <FieldError>{error}</FieldError>

      {visor}
    </div>
  );
}

function Galeria({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-wrap items-start gap-2">{children}</ul>;
}

function Posicion({ i }: { i: number }) {
  return i === 0 ? (
    <Badge tone="brand" className="mt-1">
      Principal
    </Badge>
  ) : (
    <p className="mt-1 pl-1 text-caption tabular-nums text-ink-secondary">
      {i + 1}
    </p>
  );
}

function Recuadro({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-panel-image border border-border bg-logo-chip",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Foto({
  imagen,
  etiqueta,
}: {
  imagen: ImagenDeVariante;
  etiqueta: string;
}) {
  return (
    <Image
      src={imagen.url}
      // Sin alternativo propio: el nombre del color ya está escrito al lado.
      alt={imagen.altText ?? ""}
      width={96}
      height={96}
      // Una `<img>` arrastrada adjunta su archivo: ver `traeArchivos`.
      draggable={false}
      className="size-full object-contain p-1"
      title={etiqueta}
    />
  );
}
