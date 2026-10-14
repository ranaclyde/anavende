"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";

import { RELACIONADAS } from "@/components/admin/catalogo/copy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldHint, Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type {
  CategoriaRelacionable,
  CategoriaRelacionada,
} from "@/modules/catalog/queries";

/**
 * Las categorías relacionadas de una categoría — RF-31.
 *
 * Es controlado: la lista vive en el diálogo, que la manda junto con el
 * nombre al guardar. Nada se escribe hasta entonces, y por eso los efectos
 * sobre la OTRA categoría —quitar una recíproca, o destildarla— se anuncian
 * acá, al lado de lo que los provoca, antes de apretar «Guardar» (RF-31:
 * «informándolo antes»).
 *
 * Elegir es un `<select>` que agrega, no un multiselect con casillas: la
 * lista tiene orden y cada renglón lleva su «Recíproca», así que lo elegido
 * se tiene que ver como renglones de todas maneras. El selector solo ofrece
 * lo que se puede agregar —activas, ni la propia ni las ya puestas—.
 */
export function RelacionadasDeCategoria({
  id,
  propia,
  nombre,
  lista,
  originales,
  relacionables,
  alCambiar,
  deshabilitado,
}: {
  id: string;
  /** La categoría que se edita; `null` en el alta. */
  propia: string | null;
  /** El nombre como está escrito ahora, para los avisos. */
  nombre: string;
  lista: CategoriaRelacionada[];
  /** Cómo estaba guardada: de acá salen los avisos sobre el otro lado. */
  originales: CategoriaRelacionada[];
  relacionables: CategoriaRelacionable[];
  alCambiar: (lista: CategoriaRelacionada[]) => void;
  deshabilitado: boolean;
}) {
  const esta = nombre.trim() || "esta categoría";
  const elegidas = new Set(lista.map((r) => r.id));
  const disponibles = relacionables.filter(
    (c) => c.id !== propia && !elegidas.has(c.id),
  );
  const eraReciproca = new Map(originales.map((r) => [r.id, r.reciproca]));
  // Las recíprocas que se sacaron de la lista: al guardar se van también del
  // otro lado, y ese renglón ya no está para avisarlo.
  const quitadas = originales.filter((r) => r.reciproca && !elegidas.has(r.id));

  const agregar = (idElegida: string) => {
    const c = relacionables.find((r) => r.id === idElegida);
    if (!c) return;
    alCambiar([
      ...lista,
      {
        id: c.id,
        name: c.name,
        isActive: true,
        activos: c.activos,
        reciproca: true,
      },
    ]);
  };

  const mover = (desde: number, hacia: number) => {
    const nueva = [...lista];
    const [r] = nueva.splice(desde, 1);
    nueva.splice(hacia, 0, r);
    alCambiar(nueva);
  };

  const cambiar = (idRelacion: string, reciproca: boolean) =>
    alCambiar(
      lista.map((r) => (r.id === idRelacion ? { ...r, reciproca } : r)),
    );

  const quitar = (idRelacion: string) =>
    alCambiar(lista.filter((r) => r.id !== idRelacion));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-body-sm font-medium text-ink">
        {RELACIONADAS.etiqueta}
      </legend>
      <FieldHint id={`${id}-ayuda`} className="-mt-1">
        {RELACIONADAS.ayuda}
      </FieldHint>

      {lista.length > 0 ? (
        <ol className="flex flex-col divide-y divide-border rounded-panel-control border border-border">
          {lista.map((r, i) => (
            <li key={r.id} className="flex flex-col gap-1 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-ink">{r.name}</span>
                    {!r.isActive ? (
                      <Badge tone="neutral">{RELACIONADAS.inactiva}</Badge>
                    ) : null}
                  </span>
                  <span
                    className={
                      r.activos === 0
                        ? "block text-caption text-warning"
                        : "block text-caption text-ink-secondary"
                    }
                  >
                    {RELACIONADAS.aporta(r.activos)}
                  </span>
                </span>

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
                  onClick={() => quitar(r.id)}
                  disabled={deshabilitado}
                  title={`Quitar ${r.name}`}
                >
                  <X aria-hidden />
                  <span className="sr-only">Quitar {r.name}</span>
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id={`${id}-${r.id}`}
                  checked={r.reciproca}
                  onCheckedChange={(v) => cambiar(r.id, v === true)}
                  disabled={deshabilitado}
                />
                <Label
                  htmlFor={`${id}-${r.id}`}
                  className="text-body-sm font-normal"
                >
                  {RELACIONADAS.reciproca(r.name, esta)}
                </Label>
              </div>
              {eraReciproca.get(r.id) === true && !r.reciproca ? (
                <p className="text-caption text-warning">
                  {RELACIONADAS.dejaDeRecomendar(r.name, esta)}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-body-sm text-ink-secondary">{RELACIONADAS.vacio}</p>
      )}

      {quitadas.length > 0 ? (
        <p className="text-caption text-warning">
          {RELACIONADAS.seQuitaDelOtroLado(
            quitadas.map((r) => r.name),
            esta,
          )}
        </p>
      ) : null}

      {disponibles.length > 0 ? (
        <Select
          aria-label={RELACIONADAS.agregar}
          aria-describedby={`${id}-ayuda`}
          value=""
          onChange={(e) => agregar(e.target.value)}
          disabled={deshabilitado}
        >
          <option value="" disabled>
            {RELACIONADAS.agregar}
          </option>
          {disponibles.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {RELACIONADAS.aporta(c.activos)}
            </option>
          ))}
        </Select>
      ) : null}
    </fieldset>
  );
}
