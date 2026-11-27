"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Package,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

import { ReponerStock } from "@/components/admin/productos/reponer";
import { VacioDelPanel } from "@/components/admin/vacio";
import { dondeEsta } from "@/components/admin/productos/donde-esta";
import { Badge } from "@/components/ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  sinFiltros,
  urlDeFiltros,
  urlDeOrden,
  type FiltrosDeProductos,
  type OrdenDeProductos,
} from "@/modules/catalog/products/filtros";
import {
  cambiarDestacadoDeProducto,
  cambiarEstadoDeProducto,
  eliminarUnProducto,
} from "@/modules/catalog/products/actions";
import type { ProductoDelListado } from "@/modules/catalog/products/queries";

/** Filtros y orden viven en la URL (`BarraDeFiltros`); acá solo se pinta. */
export function ListadoDeProductos({
  items,
  filtros,
  umbral,
}: {
  items: ProductoDelListado[];
  filtros: FiltrosDeProductos;
  /** Stock bajo: `disponible <= umbral`. */
  umbral: number;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<ProductoDelListado | null>(null);

  // Destacar y desactivar no avisan a propósito: el cambio se ve en la fila.
  const correr = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? null);
    });
  };

  const alternarEstado = (p: ProductoDelListado) =>
    correr(() => cambiarEstadoDeProducto({ id: p.id, activo: !p.isActive }));

  const alternarDestacado = (p: ProductoDelListado) =>
    correr(() =>
      cambiarDestacadoDeProducto({ id: p.id, destacado: !p.isFeatured }),
    );

  const borrar = (p: ProductoDelListado) => {
    setPorBorrar(null);
    setError(null);
    iniciar(async () => {
      const r = await eliminarUnProducto({ id: p.id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      // Borrar sí avisa: la fila ya no está. Desactivar va con `avisarConPero`
      // para que no se lea como «listo, borrado».
      if (r.data.resultado === "borrado") {
        avisar(`Borraste «${p.name}».`);
      } else {
        avisarConPero(
          `«${p.name}» está en ${dondeEsta(r.data.ordenes, r.data.carritos)}, así que no se puede borrar: lo desactivamos y ya no se ve en la tienda.`,
        );
      }
    });
  };

  return (
    <div className="@container flex flex-col gap-4">
      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <SinResultados filtros={filtros} />
      ) : (
        <>
          {/* 62rem: las columnas fijas suman 784px y dejan ~200 al nombre. */}
          <div className="hidden overflow-hidden rounded-panel-card border border-border bg-surface @min-[62rem]:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-surface-sunken">
                  <Cabecera filtros={filtros} orden="nombre">
                    Producto
                  </Cabecera>
                  <Cabecera
                    filtros={filtros}
                    orden="precio"
                    align="right"
                    className="w-36"
                  >
                    Precio
                  </Cabecera>
                  {/* Ancha: entra también el botón de reponer. */}
                  <Cabecera
                    filtros={filtros}
                    orden="stock"
                    align="right"
                    className="w-72"
                  >
                    Disponible
                  </Cabecera>
                  {/* Ancha: «Activo» y la etiqueta en una línea. */}
                  <TableHead className="w-48">Estado</TableHead>
                  <TableHead className="w-40 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Nombre producto={p} />
                    </TableCell>
                    <TableCell data-align="right">
                      <Precio producto={p} />
                    </TableCell>
                    <TableCell data-align="right">
                      {/* El botón antes de las cifras, para que caigan bajo
                          «Disponible». */}
                      <div className="flex items-center justify-end gap-3">
                        <ReponerStock
                          productId={p.id}
                          nombre={p.name}
                          variantes={p.variantes}
                        />
                        {/* Ancho mínimo: «Reponer» en la misma vertical. */}
                        <div className="min-w-32">
                          <Stock producto={p} umbral={umbral} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Estado producto={p} umbral={umbral} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Acciones
                        producto={p}
                        ocupado={enCurso}
                        alDestacar={() => alternarDestacado(p)}
                        alAlternar={() => alternarEstado(p)}
                        alBorrar={() => setPorBorrar(p)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* `grid-cols-1` y no la columna automática: esa crece hasta el
              texto más largo y a 320px la tarjeta se sale de la pantalla. */}
          <ul className="grid grid-cols-1 gap-2 @min-[40rem]:grid-cols-2 @min-[62rem]:hidden">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Nombre producto={p} />
                  <Estado producto={p} umbral={umbral} />
                </div>
                {/* Precio y disponible alineados arriba. */}
                <div className="flex items-start justify-between gap-3">
                  <Precio producto={p} />
                  <Stock producto={p} umbral={umbral} />
                </div>
                {/* `flex-wrap`: a 320px, «Reponer» y los íconos no entran en
                    un renglón. */}
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                  <ReponerStock
                    productId={p.id}
                    nombre={p.name}
                    variantes={p.variantes}
                  />
                  <div className="ml-auto">
                    <Acciones
                      producto={p}
                      ocupado={enCurso}
                      alDestacar={() => alternarDestacado(p)}
                      alAlternar={() => alternarEstado(p)}
                      alBorrar={() => setPorBorrar(p)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={porBorrar !== null}
        onOpenChange={(abierto) => (abierto ? null : setPorBorrar(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar «{porBorrar?.name}»</DialogTitle>
            <DialogDescription>
              Si el producto está en alguna orden no se borra: lo desactivamos,
              para que la orden se siga leyendo entera. Si no está en ninguna,
              se borra y no hay vuelta atrás.
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
    </div>
  );
}

/** El segundo clic en la columna activa da vuelta la dirección. */
function Cabecera({
  filtros,
  orden,
  align,
  className,
  children,
}: {
  filtros: FiltrosDeProductos;
  orden: OrdenDeProductos;
  align?: "right";
  className?: string;
  children: React.ReactNode;
}) {
  const activa = filtros.orden === orden;
  const ascendente = filtros.dir === "asc";

  return (
    <TableHead
      data-align={align}
      aria-sort={activa ? (ascendente ? "ascending" : "descending") : "none"}
      className={cn("p-0", className)}
    >
      <Link
        href={urlDeOrden(filtros, orden)}
        className={cn(
          "group flex h-9 w-full items-center gap-1 px-3",
          "transition-colors duration-150 hover:text-ink",
          // En columnas de números la flecha va adelante: su hueco invisible
          // corría el título respecto de las cifras.
          align === "right" ? "flex-row-reverse justify-start" : "",
          activa ? "text-ink" : "",
        )}
      >
        {children}
        {activa ? (
          ascendente ? (
            <ArrowUp aria-hidden className="size-3.5" />
          ) : (
            <ArrowDown aria-hidden className="size-3.5" />
          )
        ) : (
          <ChevronsUpDown
            aria-hidden
            className="size-3.5 opacity-0 transition-opacity duration-150 group-hover:opacity-60 group-focus-visible:opacity-60"
          />
        )}
      </Link>
    </TableHead>
  );
}

function Nombre({ producto }: { producto: ProductoDelListado }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {/* Sin estrella: «destacado» lo dice la de acciones. */}
      <div className="flex min-w-0 items-center gap-1.5">
        <Link
          href={`/admin/productos/${producto.id}`}
          className="truncate font-medium text-ink hover:text-brand"
        >
          {producto.name}
        </Link>
      </div>
      <span className="truncate text-caption text-ink-secondary">
        {producto.brandName} · {producto.categoryName}
      </span>
    </div>
  );
}

function Precio({ producto }: { producto: ProductoDelListado }) {
  const hayOferta = producto.finalPrice !== producto.price;

  return (
    // Comprimido, parte en dos renglones y despareja la altura de las filas.
    <div className="flex shrink-0 flex-col items-end gap-0.5 whitespace-nowrap tabular-nums">
      <span className="font-medium text-ink">
        {formatMoney(producto.finalPrice)}
      </span>
      {hayOferta ? (
        <span className="text-caption text-ink-secondary line-through">
          {formatMoney(producto.price)}
        </span>
      ) : null}
    </div>
  );
}

/** El color acompaña: el estado lo dice la etiqueta de al lado. */
function Stock({
  producto,
  umbral,
}: {
  producto: ProductoDelListado;
  umbral: number;
}) {
  // «Sin colores» ya lo dice la etiqueta de al lado.
  if (producto.variantes === 0) {
    return <span className="text-ink-secondary">—</span>;
  }

  const tono =
    producto.variantesEnNegativo > 0 || producto.disponible <= 0
      ? "text-danger"
      : producto.disponible <= umbral
        ? "text-warning"
        : "text-ink";

  return (
    <div className="flex flex-col items-end gap-0.5 tabular-nums">
      <span className={cn("font-medium", tono)}>{producto.disponible}</span>
      <span className="text-caption text-ink-secondary">
        de {producto.stockTotal} ·{" "}
        {producto.reservado === 1
          ? "1 reservada"
          : `${producto.reservado} reservadas`}
      </span>
    </div>
  );
}

function Estado({
  producto,
  umbral,
}: {
  producto: ProductoDelListado;
  umbral: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <Badge tone={producto.isActive ? "success" : "neutral"}>
        {producto.isActive ? "Activo" : "Inactivo"}
      </Badge>
      <EtiquetaDeStock producto={producto} umbral={umbral} />
    </div>
  );
}

/**
 * Una sola etiqueta: los estados son excluyentes. «Stock negativo» es una
 * discrepancia a corregir (RF-24), no falta de stock.
 */
function EtiquetaDeStock({
  producto,
  umbral,
}: {
  producto: ProductoDelListado;
  umbral: number;
}) {
  if (producto.variantes === 0) {
    return <Badge tone="warning">Sin colores</Badge>;
  }
  if (producto.variantesEnNegativo > 0) {
    return <Badge tone="danger">Stock negativo</Badge>;
  }
  if (producto.disponible <= 0) {
    return <Badge tone="danger">Sin stock</Badge>;
  }
  if (producto.disponible <= umbral) {
    return <Badge tone="warning">Quedan {producto.disponible}</Badge>;
  }
  return null;
}

function Acciones({
  producto,
  ocupado,
  alDestacar,
  alAlternar,
  alBorrar,
}: {
  producto: ProductoDelListado;
  ocupado: boolean;
  alDestacar: () => void;
  alAlternar: () => void;
  alBorrar: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      <Button asChild variant="tertiary" size="icon" title="Editar">
        <Link href={`/admin/productos/${producto.id}`}>
          <Pencil aria-hidden />
          <span className="sr-only">Editar {producto.name}</span>
        </Link>
      </Button>
      <Button
        variant="tertiary"
        size="icon"
        disabled={ocupado}
        onClick={alDestacar}
        aria-pressed={producto.isFeatured}
        title={producto.isFeatured ? "Quitar de destacados" : "Destacar"}
      >
        {/* Relleno y sin color: en burdeos se confundía con el tacho rojo. */}
        <Star
          aria-hidden
          className={producto.isFeatured ? "fill-ink text-ink" : ""}
        />
        <span className="sr-only">
          {producto.isFeatured ? "Quitar de destacados" : "Destacar"}{" "}
          {producto.name}
        </span>
      </Button>
      <Button
        variant="tertiary"
        size="icon"
        disabled={ocupado}
        onClick={alAlternar}
        title={producto.isActive ? "Desactivar" : "Activar"}
      >
        {producto.isActive ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        <span className="sr-only">
          {producto.isActive ? "Desactivar" : "Activar"} {producto.name}
        </span>
      </Button>
      <Button
        variant="destructive-ghost"
        size="icon"
        disabled={ocupado}
        onClick={alBorrar}
        title="Borrar"
      >
        <Trash2 aria-hidden />
        <span className="sr-only">Borrar {producto.name}</span>
      </Button>
    </div>
  );
}

function SinResultados({ filtros }: { filtros: FiltrosDeProductos }) {
  return (
    <VacioDelPanel
      titulo={
        filtros.q
          ? `No encontramos ningún producto para «${filtros.q}».`
          : "Ningún producto coincide con los filtros."
      }
      accion={
        <Button asChild variant="secondary" size="sm">
          <Link href={urlDeFiltros(sinFiltros(filtros))}>Limpiar todo</Link>
        </Button>
      }
    >
      Probá con menos filtros, o revisá cómo quedó escrito.
    </VacioDelPanel>
  );
}

export function SinProductos() {
  return (
    <VacioDelPanel
      icono={Package}
      titulo="Todavía no cargaste ningún producto."
      accion={
        <Button asChild variant="brand" size="sm">
          <Link href="/admin/productos/nuevo">
            <Plus aria-hidden />
            Cargar el primero
          </Link>
        </Button>
      }
    >
      Es lo que se ve en la tienda. Cada uno lleva una marca y una categoría,
      que se cargan desde Catálogo, y después los colores y el stock.
    </VacioDelPanel>
  );
}
