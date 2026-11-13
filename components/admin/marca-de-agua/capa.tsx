"use client";

import Image from "next/image";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { useId } from "react";

import { Opcion } from "@/components/admin/formulario";
import {
  CUADRICULA,
  type CapaEnPantalla,
} from "@/components/admin/marca-de-agua/tipos";
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ImagenDeLaBiblioteca } from "@/modules/marca-de-agua/queries";
import { ANCLAS, type Ancla, type Modo } from "@/modules/media/capas-de-marca";

/**
 * Una capa de la marca de agua — RF-39, TS §9.6.
 *
 * Los controles que no aplican a la forma elegida **no se muestran**, en vez
 * de quedar apagados: «Margen» con «Cubrir» no significa nada, y un control
 * gris obliga a preguntarse por qué.
 */

const FORMAS: { modo: Modo; titulo: string; detalle: string }[] = [
  {
    modo: "posicion",
    titulo: "En un lugar",
    detalle: "Una esquina, un borde o el centro. Para el logo.",
  },
  {
    modo: "mosaico",
    titulo: "Repetida",
    detalle: "Se repite por toda la foto, como un patrón.",
  },
  {
    modo: "cubrir",
    titulo: "Cubrir",
    detalle: "Tapa toda la foto; si no tiene su forma, se recorta.",
  },
  {
    modo: "estirar",
    titulo: "Estirar",
    detalle: "Tapa toda la foto deformándose hasta entrar justo.",
  },
];

const NOMBRE_DEL_LUGAR: Record<Ancla, string> = {
  "arriba-izquierda": "Arriba a la izquierda",
  arriba: "Arriba al centro",
  "arriba-derecha": "Arriba a la derecha",
  izquierda: "Al medio a la izquierda",
  centro: "En el centro",
  derecha: "Al medio a la derecha",
  "abajo-izquierda": "Abajo a la izquierda",
  abajo: "Abajo al centro",
  "abajo-derecha": "Abajo a la derecha",
};

/** Dónde va el puntito dentro de cada casilla de la grilla. */
const PUNTO: Record<Ancla, string> = {
  "arriba-izquierda": "items-start justify-start",
  arriba: "items-start justify-center",
  "arriba-derecha": "items-start justify-end",
  izquierda: "items-center justify-start",
  centro: "items-center justify-center",
  derecha: "items-center justify-end",
  "abajo-izquierda": "items-end justify-start",
  abajo: "items-end justify-center",
  "abajo-derecha": "items-end justify-end",
};

export function EditorDeCapa({
  capa,
  numero,
  total,
  biblioteca,
  plegable,
  alCambiar,
  alMover,
  alQuitar,
}: {
  capa: CapaEnPantalla;
  numero: number;
  total: number;
  biblioteca: ImagenDeLaBiblioteca[];
  /** Con dos capas o más, cada una se pliega y se abre de a una. */
  plegable: boolean;
  alCambiar: (cambios: Partial<CapaEnPantalla>) => void;
  alMover: (direccion: -1 | 1) => void;
  alQuitar: () => void;
}) {
  const id = useId();
  const imagen = biblioteca.find((i) => i.id === capa.imageId);
  const identidad = (
    <Identidad capa={capa} numero={numero} total={total} imagen={imagen} />
  );
  const acciones = (
    <Acciones
      numero={numero}
      total={total}
      alMover={alMover}
      alQuitar={alQuitar}
    />
  );
  const cuerpo = (
    <Cuerpo id={id} capa={capa} biblioteca={biblioteca} alCambiar={alCambiar} />
  );

  // Plegada, la cabecera dice lo justo para reconocerla sin abrirla:
  // la imagen, el número y dónde va. Mover y quitar quedan a mano igual.
  if (plegable) {
    return (
      <AccordionItem value={capa.clave} asChild>
        <li className="flex flex-col py-3 first:pt-0 last:pb-0">
          <AccordionHeader className="items-center gap-2">
            {/* `-m-1.5 p-1.5`: el área que se toca crece sin correr nada. */}
            <AccordionTrigger className="-m-1.5 min-h-11 min-w-0 rounded-panel-control p-1.5 hover:bg-canvas">
              {identidad}
            </AccordionTrigger>
            {acciones}
          </AccordionHeader>
          <AccordionContent className="pt-5 pb-3">{cuerpo}</AccordionContent>
        </li>
      </AccordionItem>
    );
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${id}-titulo`} className="flex min-w-0 flex-1">
          {identidad}
        </h3>
        {acciones}
      </div>
      {cuerpo}
    </section>
  );
}

/** Qué hace la capa, en un renglón: lo que se lee con la capa cerrada. */
function resumen(capa: CapaEnPantalla): string {
  const opacidad = `opacidad ${capa.opacityPct}%`;
  switch (capa.mode) {
    case "posicion":
      return `${NOMBRE_DEL_LUGAR[capa.anchor]} · tamaño ${capa.sizePct}% · ${opacidad}`;
    case "mosaico":
      return `Repetida · tamaño ${capa.sizePct}% · ${opacidad}`;
    case "cubrir":
      return `Cubre la foto · ${opacidad}`;
    case "estirar":
      return `Estirada sobre la foto · ${opacidad}`;
  }
}

function Identidad({
  capa,
  numero,
  total,
  imagen,
}: {
  capa: CapaEnPantalla;
  numero: number;
  total: number;
  imagen: ImagenDeLaBiblioteca | undefined;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        title={imagen?.nombre}
        className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-panel-control border border-border p-0.5"
        style={CUADRICULA}
      >
        {imagen ? (
          <Image
            src={imagen.url}
            alt=""
            width={imagen.ancho}
            height={imagen.alto}
            sizes="40px"
            className="max-h-full w-auto object-contain"
          />
        ) : null}
      </span>
      <span className="flex min-w-0 flex-col">
        {/* Cada pedazo entero: en angosto baja «queda abajo» y no el número. */}
        <span className="flex flex-wrap gap-x-1 text-body-sm font-semibold text-ink">
          <span className="whitespace-nowrap">Capa {numero}</span>
          {total > 1 && (numero === 1 || numero === total) ? (
            <span className="font-normal whitespace-nowrap text-ink-secondary">
              · queda {numero === 1 ? "abajo" : "arriba"}
            </span>
          ) : null}
        </span>
        <span className="text-caption font-normal text-pretty text-ink-secondary">
          {resumen(capa)}
        </span>
      </span>
    </span>
  );
}

function Acciones({
  numero,
  total,
  alMover,
  alQuitar,
}: {
  numero: number;
  total: number;
  alMover: (direccion: -1 | 1) => void;
  alQuitar: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {total > 1 ? (
        <>
          <Button
            variant="tertiary"
            size="icon"
            disabled={numero === 1}
            onClick={() => alMover(-1)}
            title="Mover abajo"
          >
            <ArrowDown aria-hidden />
            <span className="sr-only">Mover la capa {numero} abajo</span>
          </Button>
          <Button
            variant="tertiary"
            size="icon"
            disabled={numero === total}
            onClick={() => alMover(1)}
            title="Mover arriba"
          >
            <ArrowUp aria-hidden />
            <span className="sr-only">Mover la capa {numero} arriba</span>
          </Button>
        </>
      ) : null}
      <Button
        variant="destructive-ghost"
        size="icon"
        onClick={alQuitar}
        title="Quitar"
      >
        <Trash2 aria-hidden />
        <span className="sr-only">Quitar la capa {numero}</span>
      </Button>
    </div>
  );
}

/** Los controles de la capa. */
function Cuerpo({
  id,
  capa,
  biblioteca,
  alCambiar,
}: {
  id: string;
  capa: CapaEnPantalla;
  biblioteca: ImagenDeLaBiblioteca[];
  alCambiar: (cambios: Partial<CapaEnPantalla>) => void;
}) {
  const usaTamano = capa.mode === "posicion" || capa.mode === "mosaico";

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-body-sm font-medium text-ink">
          Imagen
        </legend>
        <div className="flex flex-wrap gap-2">
          {biblioteca.map((imagen) => (
            <label
              key={imagen.id}
              title={imagen.nombre}
              className={cn(
                "relative grid size-16 cursor-pointer place-items-center overflow-hidden rounded-panel-image border-2 border-border p-1",
                "transition-colors duration-150 hover:border-border-strong",
                "has-checked:border-accent has-focus-visible:shadow-focus",
              )}
              style={CUADRICULA}
            >
              <input
                type="radio"
                name={`${id}-imagen`}
                checked={capa.imageId === imagen.id}
                onChange={() => alCambiar({ imageId: imagen.id })}
                className="sr-only"
              />
              <Image
                src={imagen.url}
                alt=""
                width={imagen.ancho}
                height={imagen.alto}
                sizes="64px"
                className="max-h-full w-auto object-contain"
              />
              <span className="sr-only">{imagen.nombre}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-body-sm font-medium text-ink">
          Forma
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {FORMAS.map((f) => (
            <Opcion
              key={f.modo}
              nombre={`${id}-forma`}
              elegida={capa.mode === f.modo}
              alElegir={() => alCambiar({ mode: f.modo })}
              titulo={f.titulo}
              detalle={f.detalle}
            />
          ))}
        </div>
      </fieldset>

      {capa.mode === "posicion" ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-body-sm font-medium text-ink">
            Lugar{" "}
            <span className="font-normal text-ink-secondary">
              · {NOMBRE_DEL_LUGAR[capa.anchor].toLowerCase()}
            </span>
          </legend>
          {/* Una foto en chiquito con nueve lugares: se entiende mirándola,
              sin leer los nombres, que igual están para el lector de
              pantalla. Cada casilla mide 44px, el área táctil de §9. */}
          <div className="grid w-fit grid-cols-3 gap-1 rounded-panel-control border border-border bg-surface-sunken p-1">
            {ANCLAS.map((ancla) => (
              <label
                key={ancla}
                title={NOMBRE_DEL_LUGAR[ancla]}
                className={cn(
                  "flex size-11 cursor-pointer rounded-[6px] p-2 transition-colors duration-150",
                  "hover:bg-surface has-checked:bg-accent-tint has-focus-visible:shadow-focus",
                  PUNTO[ancla],
                )}
              >
                <input
                  type="radio"
                  name={`${id}-lugar`}
                  checked={capa.anchor === ancla}
                  onChange={() => alCambiar({ anchor: ancla })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="size-2.5 rounded-[2px] bg-border-strong peer-checked:size-3.5 peer-checked:bg-accent"
                />
                <span className="sr-only">{NOMBRE_DEL_LUGAR[ancla]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {usaTamano ? (
        <Deslizador
          etiqueta={
            capa.mode === "mosaico" ? "Tamaño de cada repetición" : "Tamaño"
          }
          valor={capa.sizePct}
          min={5}
          max={100}
          leyenda={`${capa.sizePct}% del ancho de la foto`}
          alCambiar={(v) => alCambiar({ sizePct: v })}
        />
      ) : null}

      {capa.mode === "posicion" ? (
        <Deslizador
          etiqueta="Separación del borde"
          valor={capa.marginPct}
          min={0}
          max={20}
          leyenda={`${capa.marginPct}% del ancho de la foto`}
          alCambiar={(v) => alCambiar({ marginPct: v })}
        />
      ) : null}

      <Deslizador
        etiqueta="Opacidad"
        valor={capa.opacityPct}
        min={5}
        max={100}
        leyenda={`${capa.opacityPct}%${capa.opacityPct === 100 ? ", como está la imagen" : ""}`}
        alCambiar={(v) => alCambiar({ opacityPct: v })}
      />
    </div>
  );
}

function Deslizador({
  etiqueta,
  valor,
  min,
  max,
  leyenda,
  alCambiar,
}: {
  etiqueta: string;
  valor: number;
  min: number;
  max: number;
  leyenda: string;
  alCambiar: (v: number) => void;
}) {
  return (
    // El tope va en el renglón entero y no en el deslizador: así el valor
    // de la derecha termina donde termina la barra.
    <div className="flex max-w-md flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-body-sm font-medium text-ink">{etiqueta}</span>
        <span className="text-caption tabular-nums text-ink-secondary">
          {leyenda}
        </span>
      </div>
      <Slider
        value={[valor]}
        min={min}
        max={max}
        step={1}
        etiquetas={[etiqueta]}
        onValueChange={([v]) => alCambiar(v)}
      />
    </div>
  );
}
