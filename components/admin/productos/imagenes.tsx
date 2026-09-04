"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, MoreVertical, Star, Trash2, MoveLeft, MoveRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field-error";
import { cn } from "@/lib/utils";
import {
  borrarUnaImagen,
  ordenarImagenes,
} from "@/modules/catalog/variants/actions";
import type { ImagenDeVariante } from "@/modules/catalog/variants/queries";
import { motivoDeRechazo, subirImagen, type Progreso } from "@/modules/media/cliente";
import { MAXIMO_POR_VARIANTE, TIPOS_ACEPTADOS } from "@/modules/media/tamanos";

/**
 * Las imágenes de una variante — RF-16, RF-17, §9.1, §9.5.
 *
 * Acá viven las cuatro piezas de RF-17 que F2.2 dejó pendientes porque no
 * tenían dónde probarse: **arrastre, progreso, reordenar y elegir la
 * principal**. Las tres primeras son de la subida; la cuarta es de la
 * galería, y las dos últimas son la misma operación:
 *
 * > **La principal es la que está en la posición 0.** No hay columna que lo
 * > diga. Una bandera `is_primary` daría dos respuestas para la misma
 * > pregunta y dos estados imposibles —ninguna principal, o dos— que igual
 * > habría que programar. Elegir la principal es mover una imagen al frente,
 * > que es exactamente lo que se ve en la pantalla.
 *
 * **El menú de cada imagen no es decoración.** El arrastre no existe en un
 * teléfono ni para quien navega con el teclado: «mover antes», «mover
 * después» y «hacer principal» son el mismo trabajo por otra vía, no un
 * atajo (RNF-02).
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
  /** Cuando reutiliza las de otra variante, se ven pero no se tocan (§9.5). */
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

  /**
   * El orden que se está viendo, que durante un arrastre no es todavía el de
   * la base: mover una imagen tiene que verse al instante y no después de la
   * ida y vuelta al servidor.
   *
   * Se resincroniza DURANTE EL RENDER y no en un efecto: un efecto pintaría
   * primero el orden viejo y lo corregiría después, que es exactamente el
   * parpadeo que se quiere evitar.
   */
  const idsDelServidor = imagenes.map((i) => i.id).join("|");
  const [orden, setOrden] = useState<string[]>(() => imagenes.map((i) => i.id));
  const [ultimoVisto, setUltimoVisto] = useState(idsDelServidor);

  if (ultimoVisto !== idsDelServidor) {
    setUltimoVisto(idsDelServidor);
    setOrden(imagenes.map((i) => i.id));
  }

  /** Qué se está arrastrando. En un ref: cambia decenas de veces por segundo. */
  const arrastrada = useRef<string | null>(null);

  /**
   * El orden que va quedando MIENTRAS se arrastra, en un ref además de en el
   * estado.
   *
   * No es duplicar por las dudas: `dragover` y `drop` pueden llegar en la
   * misma tanda de eventos, y React agrupa las actualizaciones de estado hasta
   * el final. Cuando eso pasa, el manejador de `drop` lee el `orden` ANTERIOR
   * al arrastre, lo compara con el del servidor, los encuentra iguales y no
   * guarda nada: la galería se ve reordenada y al recargar vuelve como estaba.
   * Se descubrió así, arrastrando, y no leyendo el código.
   */
  const ordenPendiente = useRef<string[] | null>(null);
  /** Las vistas previas vivas, para soltarlas si el componente se va. */
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

  // ── Subir ─────────────────────────────────────────────────────────────

  const agregar = (elegidos: File[]) => {
    setError(null);
    if (!elegidos.length) return;

    if (espacio <= 0) {
      setError(
        `Ya hay ${MAXIMO_POR_VARIANTE} imágenes, que son las que entran. Borrá una para subir otra.`,
      );
      return;
    }

    // El rechazo es ANTES de subir (RF-17): esperar diez megabytes para
    // decir que el archivo no era una imagen es hacer perder el tiempo.
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

  /**
   * De a una y no todas juntas. Cada subida ocupa a sharp con tres
   * conversiones (§9.1); cinco fotos de 8 MB en paralelo le piden al servidor
   * de 4 GB (§20) que haga quince a la vez.
   */
  const correr = async (cola: Subida[]) => {
    let alguna = false;
    let fallo: string | null = null;

    for (const item of cola) {
      const resultado = await subirImagen(
        { destino: "variante", productId, variantId },
        item.archivo,
        (avance) =>
          setSubiendo((previo) =>
            previo.map((s) => (s.clave === item.clave ? { ...s, ...avance } : s)),
          ),
      );

      URL.revokeObjectURL(item.vistaPrevia);
      previas.current.delete(item.vistaPrevia);
      setSubiendo((previo) => previo.filter((s) => s.clave !== item.clave));

      if (resultado.ok) alguna = true;
      else fallo ??= `«${item.nombre}»: ${resultado.message}`;
    }

    if (fallo) setError(fallo);

    // La otra mitad del refresco: el Route Handler invalida la caché del
    // servidor, pero un envío por XHR no trae la vista nueva de vuelta. Sin
    // esto la imagen está guardada y la galería sigue vacía.
    if (alguna) router.refresh();
  };

  // ── Ordenar ───────────────────────────────────────────────────────────

  const aplicar = (nuevo: string[]) => {
    setOrden(nuevo);
    setError(null);

    iniciar(async () => {
      const r = await ordenarImagenes({ variantId, ids: nuevo });
      if (!r.ok) {
        setError(r.message);
        // Se vuelve a lo que dice el SERVIDOR, no a lo que había en pantalla:
        // si el guardado no ocurrió, el orden bueno es el de la base.
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

  // ── Arrastre para reordenar ───────────────────────────────────────────

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

  // ── Arrastre de archivos desde el escritorio (RF-17) ──────────────────

  /**
   * ¿Esto que se está soltando son archivos de afuera?
   *
   * **La comprobación del ref no es defensiva, es el arreglo de un error que
   * se vio arrastrando.** Chrome adjunta el archivo de la imagen cuando se
   * arrastra un `<img>`, así que una miniatura movida para reordenar llega
   * con `Files` igual que una foto traída del escritorio. Sin esta guarda,
   * soltarla sobre la galería la SUBÍA DE NUEVO —una cuarta imagen que era la
   * miniatura de la primera— en vez de moverla.
   *
   * Se ataca de los dos lados: acá, y con `draggable={false}` en la imagen,
   * que evita que sea ella la que arranca el arrastre en vez de su recuadro.
   */
  const traeArchivos = (e: React.DragEvent) =>
    arrastrada.current === null &&
    Array.from(e.dataTransfer.types).includes("Files");

  if (soloLectura) {
    // El aviso va FUERA de la lista: un `<p>` suelto dentro de un `<ul>` no es
    // HTML válido, y un lector de pantalla lo anuncia como una lista rota.
    return visibles.length === 0 ? (
      <p className="text-caption text-ink-secondary">
        El color del que reutiliza las fotos todavía no tiene ninguna.
      </p>
    ) : (
      <Galeria>
        {visibles.map((imagen, i) => (
          <li key={imagen.id} className="w-28 sm:w-24">
            <Recuadro>
              <Foto imagen={imagen} etiqueta={etiqueta} />
            </Recuadro>
            <Posicion i={i} />
          </li>
        ))}
      </Galeria>
    );
  }

  return (
    <div
      onDragEnter={(e) => {
        if (traeArchivos(e)) setSobreLaZona(true);
      }}
      onDragOver={(e) => {
        // Sin esto el navegador abre el archivo soltado en una pestaña nueva
        // y se pierde el formulario entero.
        if (traeArchivos(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        // Solo cuando el puntero sale del contenedor de verdad: pasar de una
        // miniatura a la de al lado dispara `dragleave` en la primera.
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
            {/* El navegador ya dibuja la imagen «fantasma» que sigue al
                cursor: pintar acá cuál se está arrastrando sería un estado
                más que mantener para decir lo mismo dos veces. */}
            <Recuadro className="cursor-grab active:cursor-grabbing">
              <Foto imagen={imagen} etiqueta={etiqueta} />

              {/* El menú va ENCIMA de su miniatura y no debajo. Debajo, con
                  las miniaturas a 8px una de otra, el botón de una quedaba
                  más cerca del número de la siguiente que del suyo: no había
                  forma de saber a cuál foto pertenecía sin probarlo. */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={guardando}
                  className="absolute right-0.5 top-0.5 grid size-11 place-items-center rounded-panel-control text-ink-secondary transition-colors hover:text-ink disabled:opacity-40 sm:size-9"
                >
                  {/* Lleva borde además de fondo: sobre una foto de fondo
                      claro —que es casi toda foto de periférico— un chip
                      blanco sin contorno desaparece y los tres puntos quedan
                      flotando sobre la imagen, sin leerse como un botón. */}
                  <span className="grid size-7 place-items-center rounded-panel-control border border-border bg-surface/85 shadow-sm backdrop-blur-sm">
                    <MoreVertical aria-hidden className="size-4" />
                  </span>
                  <span className="sr-only">
                    Opciones de la imagen {i + 1} de {etiqueta}
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
              {/* `unoptimized`: es un `blob:` del navegador, no hay nada que
                  optimizar y `next/image` no puede ir a buscarlo. */}
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

      {/* El input va oculto pero alcanzable: `display:none` lo sacaría del
          alcance del `click()` y de los lectores de pantalla. */}
      <input
        ref={campoDeArchivo}
        type="file"
        multiple
        accept={TIPOS_ACEPTADOS.join(",")}
        className="sr-only"
        onChange={(e) => {
          agregar(Array.from(e.target.files ?? []));
          // Sin esto, volver a elegir EL MISMO archivo no dispara `change` y
          // parece que el botón dejó de andar.
          e.target.value = "";
        }}
      />

      {/* La explicación de qué entra y cómo se ordena vive UNA vez, arriba de
          la sección: repetida en cada color son dos renglones por tarjeta que
          nadie vuelve a leer y que empujan las fotos fuera de la pantalla. */}
      <FieldError>{error}</FieldError>
    </div>
  );
}

/** La grilla, igual en los dos modos. Fuera del componente: es estática. */
function Galeria({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-wrap items-start gap-2">{children}</ul>;
}

/**
 * En qué lugar de la galería está esta foto.
 *
 * La primera lleva la PALABRA «Principal» y no un color ni un ícono: §9 no
 * admite que el color sea el único portador de la información, y «la que se ve
 * en el catálogo» es justamente la que hay que poder distinguir de un vistazo.
 */
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

/**
 * El recuadro de la miniatura. Cuadrado y con `object-contain` sobre un fondo
 * claro por lo mismo que §6.8: un periférico suele venir fotografiado sobre
 * blanco, y recortarlo para llenar el cuadrado lo mutila.
 */
function Recuadro({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
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
      // El texto alternativo del catálogo lo va a poner la ficha (F3.5). Acá
      // el nombre del color ya está escrito al lado, así que repetirlo sería
      // ruido para un lector de pantalla.
      alt={imagen.altText ?? ""}
      width={96}
      height={96}
      // Que el arrastre lo maneje el recuadro y no la imagen: una `<img>` es
      // arrastrable por omisión y arrastrarla adjunta su archivo, con lo cual
      // reordenar terminaba pareciéndose a subir una foto nueva.
      draggable={false}
      className="size-full object-contain p-1"
      title={etiqueta}
    />
  );
}
