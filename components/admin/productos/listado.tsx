"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import {
  cambiarDestacadoDeProducto,
  cambiarEstadoDeProducto,
  eliminarUnProducto,
} from "@/modules/catalog/products/actions";
import type { ProductoDelListado } from "@/modules/catalog/products/queries";

/**
 * Listado de productos del panel — RF-15.
 *
 * Es el listado MÍNIMO para llegar al formulario y volver. La búsqueda, los
 * filtros, el orden y el aviso de stock bajo son F2.5: están pedidos en
 * RF-15 y no se hacen acá porque una barra de filtros a medias es peor que
 * ninguna — se usa, no encuentra, y nadie sabe si el producto no está o el
 * filtro no anda.
 */
export function ListadoDeProductos({ items }: { items: ProductoDelListado[] }) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<ProductoDelListado | null>(null);

  const correr = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    setAviso(null);
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

  /**
   * «Eliminar» tiene dos finales (RF-15): si alguna orden lo nombra, el
   * producto se desactiva en vez de borrarse, porque la orden histórica lo
   * sigue mostrando. La vista cuenta cuál de los dos pasó en lugar de decir
   * «listo» sobre algo que sigue estando.
   */
  const borrar = (p: ProductoDelListado) => {
    setPorBorrar(null);
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const r = await eliminarUnProducto({ id: p.id });
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setAviso(
        r.data.resultado === "borrado"
          ? `Borramos «${p.name}».`
          : `«${p.name}» está en ${r.data.ordenes === 1 ? "1 orden" : `${r.data.ordenes} órdenes`}, así que no se puede borrar: lo desactivamos y ya no se ve en la tienda.`,
      );
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-ink-secondary">
          {items.length === 0
            ? "Sin productos"
            : items.length === 1
              ? "1 producto"
              : `${items.length} productos`}
        </p>
        <Button asChild variant="brand" size="sm">
          <Link href="/admin/productos/nuevo">
            <Plus aria-hidden />
            Nuevo producto
          </Link>
        </Button>
      </div>

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}
      {aviso === null ? null : (
        <p role="status" className="text-body-sm text-ink-secondary">
          {aviso}
        </p>
      )}

      {items.length === 0 ? (
        <Vacio />
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden overflow-hidden rounded-panel-card border border-border bg-surface md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-surface-sunken">
                  <TableHead>Producto</TableHead>
                  <TableHead className="w-40">Categoría</TableHead>
                  <TableHead data-align="right" className="w-36">
                    Precio
                  </TableHead>
                  <TableHead className="w-28">Estado</TableHead>
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
                    <TableCell className="truncate text-ink-secondary">
                      {p.categoryName}
                    </TableCell>
                    <TableCell data-align="right">
                      <Precio producto={p} />
                    </TableCell>
                    <TableCell>
                      <Estado activo={p.isActive} />
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

          {/* Móvil */}
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Nombre producto={p} />
                  <Estado activo={p.isActive} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Precio producto={p} />
                  <Acciones
                    producto={p}
                    ocupado={enCurso}
                    alDestacar={() => alternarDestacado(p)}
                    alAlternar={() => alternarEstado(p)}
                    alBorrar={() => setPorBorrar(p)}
                  />
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
            <Button variant="tertiary" onClick={() => setPorBorrar(null)}>
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

function Nombre({ producto }: { producto: ProductoDelListado }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-1.5">
        {producto.isFeatured ? (
          <Star
            aria-label="Destacado"
            className="size-3.5 shrink-0 fill-brand text-brand"
          />
        ) : null}
        <Link
          href={`/admin/productos/${producto.id}`}
          className="truncate font-medium text-ink hover:text-brand"
        >
          {producto.name}
        </Link>
      </div>
      <span className="truncate text-caption text-ink-secondary">
        {producto.brandName}
      </span>
    </div>
  );
}

/** El precio final, y el original tachado solo si hay oferta (RN-04b). */
function Precio({ producto }: { producto: ProductoDelListado }) {
  const hayOferta = producto.finalPrice !== producto.price;

  return (
    <div className="flex flex-col items-end gap-0.5 tabular-nums">
      <span className="font-medium text-ink">
        {formatMoney(producto.finalPrice)}
      </span>
      {hayOferta ? (
        <span className="text-caption text-ink-tertiary line-through">
          {formatMoney(producto.price)}
        </span>
      ) : null}
    </div>
  );
}

function Estado({ activo }: { activo: boolean }) {
  return (
    <Badge tone={activo ? "success" : "neutral"}>
      {activo ? "Activo" : "Inactivo"}
    </Badge>
  );
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
        <Star aria-hidden className={producto.isFeatured ? "fill-brand text-brand" : ""} />
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
        variant="tertiary"
        size="icon"
        disabled={ocupado}
        onClick={alBorrar}
        title="Borrar"
        className="text-ink-secondary hover:text-danger"
      >
        <Trash2 aria-hidden />
        <span className="sr-only">Borrar {producto.name}</span>
      </Button>
    </div>
  );
}

/** Estado vacío (§8): dice qué falta y ofrece el primer paso. */
function Vacio() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-body-sm text-ink-secondary">
        Todavía no cargaste ningún producto.
      </p>
      <Button asChild variant="brand" size="sm">
        <Link href="/admin/productos/nuevo">
          <Plus aria-hidden />
          Cargar el primero
        </Link>
      </Button>
    </div>
  );
}
