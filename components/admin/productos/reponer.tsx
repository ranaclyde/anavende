"use client";

import { PackagePlus } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { EsferaDeColor } from "@/components/ui/esfera-de-color";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  leerParaReponer,
  reponerStock,
} from "@/modules/catalog/variants/actions";
import type { VarianteParaReponer } from "@/modules/catalog/variants/queries";

/** Ver «Reponer desde el listado» en `DESIGN.md`. */
export function ReponerStock({
  productId,
  nombre,
  variantes: cuantas,
}: {
  productId: string;
  nombre: string;
  /** Cuántos colores tiene. */
  variantes: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [filas, setFilas] = useState<VarianteParaReponer[] | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [enCurso, iniciar] = useTransition();
  const id = useId();

  if (cuantas === 0) return null;

  const abrir = (v: boolean) => {
    setAbierto(v);
    setError(null);
    if (!v) return;
    // Se lee al abrir y no con el listado: se repone uno de cuarenta.
    setFilas(null);
    iniciar(async () => {
      const r = await leerParaReponer({ productId });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setFilas(r.data.variantes);
      setValores(
        Object.fromEntries(
          r.data.variantes.map((v) => [v.id, String(v.stockTotal)]),
        ),
      );
    });
  };

  const cambio =
    filas?.some((v) => valores[v.id] !== String(v.stockTotal)) ?? false;

  const guardar = () => {
    if (!filas) return;
    setError(null);
    iniciar(async () => {
      const r = await reponerStock({
        productId,
        // `Number.parseInt`: la regla de lint prohíbe `Number` por los montos.
        ajustes: filas.map((v) => ({
          variantId: v.id,
          nuevoTotal: Number.parseInt(valores[v.id] || "0", 10),
        })),
      });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setAbierto(false);
      const total = filas.reduce(
        (n, v) => n + Number.parseInt(valores[v.id] || "0", 10),
        0,
      );
      // Con el globo cerrado, la fila cambia sin decir por qué (DR §6.15).
      avisar(
        `«${nombre}» quedó con ${total === 1 ? "1 unidad" : `${total} unidades`} en total.`,
      );
    });
  };

  return (
    <Popover open={abierto} onOpenChange={abrir}>
      <PopoverTrigger asChild>
        <Button variant="secondary" size="sm" className="shrink-0">
          <PackagePlus aria-hidden />
          Reponer
          <span className="sr-only">el stock de {nombre}</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-body font-medium text-ink">Reponer stock</p>
            <p className="text-caption text-ink-secondary">
              Es el total de unidades, no lo que queda disponible.
            </p>
          </div>

          {error === null ? null : (
            <p role="alert" className="text-body-sm text-danger">
              {error}
            </p>
          )}

          {filas === null ? (
            <div className="flex flex-col gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-5 flex-1" />
                  <Skeleton className="h-10 w-20 rounded-panel-control" />
                </div>
              ))}
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {filas.map((v) => (
                <li key={v.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <label
                      htmlFor={`${id}-${v.id}`}
                      className="flex min-w-0 flex-1 items-center gap-2 text-body-sm text-ink"
                    >
                      {v.colorHex ? (
                        <EsferaDeColor
                          hex={v.colorHex}
                          hex2={v.colorHex2}
                          className="size-4"
                        />
                      ) : null}
                      <span className="truncate">
                        {v.colorName ?? "Sin color"}
                      </span>
                    </label>
                    {/* No `type="number"`: la rueda del mouse cambiaría el
                        stock al scrollear. */}
                    <Input
                      id={`${id}-${v.id}`}
                      inputMode="numeric"
                      value={valores[v.id] ?? ""}
                      onChange={(e) =>
                        setValores((v0) => ({
                          ...v0,
                          [v.id]: e.target.value.replace(/[^\d]/g, ""),
                        }))
                      }
                      className="w-20 shrink-0 text-right tabular-nums"
                    />
                  </div>
                  {/* La cuenta: el total escrito y lo disponible del listado
                      no son el mismo número. */}
                  <p
                    className={cn(
                      "pl-6 text-caption tabular-nums",
                      v.disponible <= 0 ? "text-danger" : "text-ink-secondary",
                    )}
                  >
                    {v.reservedStock === 0
                      ? `${v.disponible} disponibles`
                      : `${v.reservedStock} reservadas · ${v.disponible} disponibles`}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="tertiary"
              size="sm"
              onClick={() => setAbierto(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="brand"
              size="sm"
              disabled={!cambio}
              loading={enCurso && filas !== null}
              loadingLabel="Guardando"
              onClick={guardar}
            >
              Guardar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
