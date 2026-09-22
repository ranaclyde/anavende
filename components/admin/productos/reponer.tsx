"use client";

import { PackagePlus } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
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

/**
 * Reponer el stock sin salir del listado — RF-16, RF-20 · DR §6.9.
 *
 * **Por qué existe.** El tablero dice «5 productos para reponer» y enlaza al
 * listado filtrado; desde ahí, hasta el 2026-09-21, cargar stock costaba seis
 * pasos por producto —abrir la ficha, scrollear 480px hasta «Colores y
 * stock», abrir el diálogo del color, escribir, guardar, volver— y no
 * confirmaba nada. Con esto es uno, y la lista de lo que falta no se pierde
 * de vista en el medio.
 *
 * **Globo y no diálogo**, a propósito: un diálogo oscurece la pantalla y se
 * queda con el foco, y acá la operación se repite fila tras fila. Perder de
 * vista cuáles faltan entre un producto y el siguiente es justo lo que se
 * viene a evitar.
 *
 * **Se escribe el total, no lo disponible**, y por eso cada renglón muestra
 * la cuenta al lado. La columna del listado dice lo disponible —lo que se
 * puede vender— y el campo pide el total; sin decirlo, alguien que ve «0
 * disponibles» y escribe 10 esperaría vender diez cuando hay dos reservadas.
 *
 * **Guardar explícito** (decisión tuya del 2026-09-21): se corrigen los
 * números que haga falta y se guarda una vez. Un campo que se guarda solo al
 * salir del foco mueve stock sin que nadie lo haya pedido.
 */
export function ReponerStock({
  productId,
  nombre,
  variantes: cuantas,
}: {
  productId: string;
  nombre: string;
  /** Cuántos colores tiene. Sin ninguno no hay nada que reponer. */
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
    // Se lee al abrir y no con el listado: son cuarenta productos por página
    // y se repone uno o dos.
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
        // `Number.parseInt` explícito, que es lo que pide la regla de lint
        // de los montos: el genérico `Number` está prohibido en todo el
        // repositorio para que nadie convierta un `numeric(12,2)` sin
        // pensarlo. Acá son unidades enteras, no pesos.
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
      // El globo se acaba de cerrar y la fila cambia de números sin decir
      // por qué: es el caso de DR §6.15. Antes esto era un renglón arriba del
      // listado, a una pantalla de distancia de la fila que cambió.
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
                        <span
                          aria-hidden
                          style={{ backgroundColor: v.colorHex }}
                          className="size-4 shrink-0 rounded-pill border border-border"
                        />
                      ) : null}
                      <span className="truncate">
                        {v.colorName ?? "Sin color"}
                      </span>
                    </label>
                    {/* `inputMode` y no `type="number"`, por la misma razón
                        que el umbral de Configuración: el campo numérico del
                        navegador sube y baja con la rueda del mouse encima, y
                        acá eso cambiaría el stock mientras alguien scrollea. */}
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
                  {/* La cuenta, para que el total que se escribe y lo
                      disponible que muestra el listado no se lean como dos
                      números en desacuerdo. */}
                  <p
                    className={cn(
                      "pl-6 text-caption tabular-nums",
                      v.disponible <= 0 ? "text-danger" : "text-ink-tertiary",
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
