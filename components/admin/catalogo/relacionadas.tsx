"use client";

import { ArrowDown, ArrowUp, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";

import { Seccion } from "@/components/admin/formulario";
import { RELACIONADAS } from "@/components/admin/catalogo/copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetBody, SheetFooter } from "@/components/ui/sheet";
import type {
  CategoriaRelacionable,
  CategoriaRelacionada,
} from "@/modules/catalog/queries";

/**
 * Las categorías relacionadas de una categoría — RF-31.
 *
 * Son dos piezas del mismo drawer, que nunca se ven a la vez (§6.14.2: si
 * elegir lleva a un segundo paso, el paso va adentro, nunca un diálogo encima
 * de otro):
 *
 *   · `ListaDeRelacionadas`, la sección del formulario: lo elegido, en orden,
 *     con su «Recíproca», subir, bajar y quitar.
 *   · `EleccionDeRelacionadas`, el paso de elegir: un buscador y todas las
 *     activas con casillas, para marcar varias de una vez. Las nuevas entran
 *     al final de la lista y se ordenan después, en el formulario.
 *
 * Las dos son controladas: la lista vive en el formulario, que la manda junto
 * con el nombre al guardar. Nada se escribe antes, y por eso lo que le pasa a
 * la OTRA categoría se avisa al lado de lo que lo provoca (RF-31: «informándolo
 * antes»).
 */

export function ListaDeRelacionadas({
  id,
  nombre,
  lista,
  originales,
  hayParaElegir,
  alCambiar,
  alElegir,
  deshabilitado,
  refDelBoton,
}: {
  id: string;
  /** El nombre como está escrito ahora, para los avisos. */
  nombre: string;
  lista: CategoriaRelacionada[];
  /** Cómo estaba guardada: de acá salen los avisos sobre el otro lado. */
  originales: CategoriaRelacionada[];
  hayParaElegir: boolean;
  alCambiar: (lista: CategoriaRelacionada[]) => void;
  alElegir: () => void;
  deshabilitado: boolean;
  /** Para devolverle el foco a «Elegir» al volver del paso de elegir. */
  refDelBoton: React.Ref<HTMLButtonElement>;
}) {
  const esta = nombre.trim() || "esta categoría";
  const elegidas = new Set(lista.map((r) => r.id));
  const eraReciproca = new Map(originales.map((r) => [r.id, r.reciproca]));
  // Las recíprocas que se sacaron de la lista: al guardar se van también del
  // otro lado, y ese renglón ya no está para avisarlo.
  const quitadas = originales.filter((r) => r.reciproca && !elegidas.has(r.id));

  const mover = (desde: number, hacia: number) => {
    const nueva = [...lista];
    const [r] = nueva.splice(desde, 1);
    nueva.splice(hacia, 0, r);
    alCambiar(nueva);
  };

  return (
    <Seccion
      titulo={RELACIONADAS.etiqueta}
      descripcion={RELACIONADAS.ayuda}
      accion={
        hayParaElegir ? (
          <Button
            ref={refDelBoton}
            type="button"
            variant="secondary"
            size="sm"
            onClick={alElegir}
            disabled={deshabilitado}
          >
            {RELACIONADAS.elegir}
          </Button>
        ) : null
      }
    >
      {!hayParaElegir && lista.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">
          {RELACIONADAS.noHayOtras}
        </p>
      ) : null}

      {lista.length > 0 ? (
        <ol className="flex flex-col divide-y divide-border rounded-panel-control border border-border px-3">
          {lista.map((r, i) => (
            <li key={r.id} className="flex flex-col gap-1 py-2">
              <div className="flex items-center gap-3">
                {/* En el teléfono «Recíproca» baja debajo del nombre: en una
                    sola línea, con tres botones de 44px, el nombre se quedaba
                    con 90px. */}
                <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-body-sm font-medium text-ink">
                        {r.name}
                      </span>
                      {!r.isActive ? (
                        <Badge tone="neutral">{RELACIONADAS.inactiva}</Badge>
                      ) : null}
                    </span>
                    <span
                      className={
                        r.activos === 0
                          ? "text-caption text-warning"
                          : "text-caption text-ink-secondary"
                      }
                    >
                      {RELACIONADAS.aporta(r.activos)}
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Checkbox
                      id={`${id}-${r.id}`}
                      checked={r.reciproca}
                      onCheckedChange={(v) =>
                        alCambiar(
                          lista.map((x) =>
                            x.id === r.id ? { ...x, reciproca: v === true } : x,
                          ),
                        )
                      }
                      disabled={deshabilitado}
                      // La etiqueta visible es corta; lo que hace, con los
                      // dos nombres, va en el nombre accesible.
                      aria-label={RELACIONADAS.reciproca(r.name, esta)}
                    />
                    <Label
                      htmlFor={`${id}-${r.id}`}
                      className="text-body-sm font-normal text-ink-secondary"
                    >
                      {RELACIONADAS.reciprocaCorta}
                    </Label>
                  </div>
                </div>

                <div className="flex shrink-0 items-center">
                  <Button
                    type="button"
                    variant="tertiary"
                    size="icon"
                    onClick={() => mover(i, i - 1)}
                    disabled={deshabilitado || i === 0}
                    title={`Subir ${r.name}`}
                  >
                    <ArrowUp aria-hidden />
                    <span className="sr-only">Subir {r.name}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="tertiary"
                    size="icon"
                    onClick={() => mover(i, i + 1)}
                    disabled={deshabilitado || i === lista.length - 1}
                    title={`Bajar ${r.name}`}
                  >
                    <ArrowDown aria-hidden />
                    <span className="sr-only">Bajar {r.name}</span>
                  </Button>
                  <Button
                    type="button"
                    variant="destructive-ghost"
                    size="icon"
                    onClick={() =>
                      alCambiar(lista.filter((x) => x.id !== r.id))
                    }
                    disabled={deshabilitado}
                    title={`Quitar ${r.name}`}
                  >
                    <X aria-hidden />
                    <span className="sr-only">Quitar {r.name}</span>
                  </Button>
                </div>
              </div>

              {eraReciproca.get(r.id) === true && !r.reciproca ? (
                <p className="text-caption text-warning">
                  {RELACIONADAS.dejaDeRecomendar(r.name, esta)}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}

      {quitadas.length > 0 ? (
        <p className="text-caption text-warning">
          {RELACIONADAS.seQuitaDelOtroLado(
            quitadas.map((r) => r.name),
            esta,
          )}
        </p>
      ) : null}
    </Seccion>
  );
}

/** Sin tildes ni mayúsculas: «periféricos» se encuentra con «perifericos». */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function EleccionDeRelacionadas({
  id,
  disponibles,
  elegidas,
  alListo,
  alVolver,
}: {
  id: string;
  /** Las activas, sin la propia. */
  disponibles: CategoriaRelacionable[];
  /** Las que ya están en la lista, para arrancar con su casilla marcada. */
  elegidas: string[];
  /** Los ids marcados, en el orden en que se marcaron. */
  alListo: (marcadas: string[]) => void;
  alVolver: () => void;
}) {
  const [termino, setTermino] = useState("");
  const [marcadas, setMarcadas] = useState(() => {
    const posibles = new Set(disponibles.map((c) => c.id));
    return elegidas.filter((e) => posibles.has(e));
  });
  // Son pocas y están todas en memoria: filtrar es instantáneo, pero con 100
  // renglones el diferido deja que el campo responda primero.
  const busqueda = normalizar(useDeferredValue(termino));
  const visibles = busqueda
    ? disponibles.filter((c) => normalizar(c.name).includes(busqueda))
    : disponibles;
  const marcada = new Set(marcadas);

  const alternar = (idCategoria: string, v: boolean) =>
    setMarcadas((m) =>
      v ? [...m, idCategoria] : m.filter((x) => x !== idCategoria),
    );

  return (
    <>
      <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-6 py-4">
        <Label htmlFor={`${id}-buscar`}>{RELACIONADAS.buscar}</Label>
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-secondary"
          />
          <Input
            id={`${id}-buscar`}
            type="search"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            autoFocus
            autoComplete="off"
            // `admin:pl-9` y no `pl-9`: el campo trae `admin:px-3`, que con
            // la variante gana y dejaba la lupa encima del texto.
            className="admin:pl-9"
          />
        </div>
      </div>

      <SheetBody className="px-3 py-2">
        {visibles.length > 0 ? (
          <ul aria-label={RELACIONADAS.etiqueta} className="flex flex-col">
            {visibles.map((c) => (
              <li key={c.id}>
                <label
                  htmlFor={`${id}-${c.id}`}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-panel-control px-3 py-2 transition-colors duration-150 hover:bg-surface-sunken"
                >
                  <Checkbox
                    id={`${id}-${c.id}`}
                    checked={marcada.has(c.id)}
                    onCheckedChange={(v) => alternar(c.id, v === true)}
                  />
                  <span className="min-w-0 flex-1 truncate text-body-sm text-ink">
                    {c.name}
                  </span>
                  <span
                    className={
                      c.activos === 0
                        ? "shrink-0 text-caption text-warning"
                        : "shrink-0 text-caption text-ink-secondary tabular-nums"
                    }
                  >
                    {RELACIONADAS.productos(c.activos)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-3 py-4 text-body-sm text-ink-secondary">
            {RELACIONADAS.sinCoincidencias(termino.trim())}
          </p>
        )}
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="secondary" onClick={alVolver}>
          Volver
        </Button>
        <Button type="button" variant="brand" onClick={() => alListo(marcadas)}>
          {RELACIONADAS.listo(marcadas.length)}
        </Button>
      </SheetFooter>
    </>
  );
}
