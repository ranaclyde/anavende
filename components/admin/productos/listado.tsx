"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

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

/**
 * Listado de productos del panel — RF-15, RF-20, DESIGN-REFERENCE §6.9.
 *
 * La búsqueda, los filtros y el orden los escribe `BarraDeFiltros` en la
 * URL; acá solo se pintan los resultados y se ofrecen las acciones de cada
 * fila. Las cabeceras ordenan porque en escritorio es donde se mira la
 * columna, y son ENLACES y no botones: la misma dirección que produce la
 * barra, así que ordenar se puede compartir y volver atrás.
 *
 * En móvil la tabla se vuelve tarjetas, no scroll horizontal (§6.9).
 */
export function ListadoDeProductos({
  items,
  filtros,
  umbral,
}: {
  items: ProductoDelListado[];
  filtros: FiltrosDeProductos;
  /** Stock bajo: `disponible <= umbral` (RF-20). */
  umbral: number;
}) {
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
        <SinResultados filtros={filtros} />
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden overflow-hidden rounded-panel-card border border-border bg-surface md:block">
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
                  <Cabecera
                    filtros={filtros}
                    orden="stock"
                    align="right"
                    className="w-40"
                  >
                    Disponible
                  </Cabecera>
                  {/* Ancha para que «Activo» y la etiqueta de stock entren
                      en la misma línea: apiladas, la fila crece 10px y la
                      tabla pierde el renglón parejo de 44px (§6.9). */}
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
                      <Stock producto={p} umbral={umbral} />
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

          {/* Móvil */}
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Nombre producto={p} />
                  <Estado producto={p} umbral={umbral} />
                </div>
                {/* Arriba: el precio y el disponible arrancan en la misma
                    línea, y cada uno explica debajo. Alineados abajo, el
                    número grande del stock quedaba flotando sobre el
                    precio. */}
                <div className="flex items-start justify-between gap-3">
                  <Precio producto={p} />
                  <Stock producto={p} umbral={umbral} />
                </div>
                <div className="flex justify-end">
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

/**
 * Cabecera que ordena. El primer clic ordena por su columna; el segundo, ya
 * estando en ella, da vuelta la dirección — que es lo que hace cualquier
 * tabla y lo que la flecha promete.
 */
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
      // Lo lee el lector de pantalla: por qué columna está ordenada la tabla
      // y hacia dónde, sin depender de ver la flecha (§9).
      aria-sort={
        activa ? (ascendente ? "ascending" : "descending") : "none"
      }
      className={cn("p-0", className)}
    >
      <Link
        href={urlDeOrden(filtros, orden)}
        className={cn(
          "group flex h-9 w-full items-center gap-1 px-3",
          "transition-colors duration-150 hover:text-ink",
          // En las columnas de números la flecha va ADELANTE del título: el
          // hueco que ocupa cuando no se ve corría el título 18px a la
          // izquierda del borde donde terminan las cifras.
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
          // La flecha doble aparece al pasar por encima: dice que la columna
          // ordena sin ensuciar la cabecera de flechas todo el tiempo.
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
        {producto.brandName} · {producto.categoryName}
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

/**
 * Los tres números de stock del producto (RF-15, RF-16).
 *
 * El grande es el DISPONIBLE, que es el único que responde «¿esto se puede
 * vender?»; el total y el reservado van debajo porque explican de dónde sale
 * y por qué no coincide con lo que hay en la caja.
 *
 * El color acompaña, no informa: lo que dice el estado es la etiqueta de al
 * lado (§9).
 */
function Stock({
  producto,
  umbral,
}: {
  producto: ProductoDelListado;
  umbral: number;
}) {
  // Un producto sin colores no tiene números que mostrar, y por qué lo dice
  // la etiqueta de al lado: repetir «Sin colores» acá sería decir dos veces
  // lo mismo en dos columnas contiguas.
  if (producto.variantes === 0) {
    return <span className="text-ink-tertiary">—</span>;
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
      <span className="text-caption text-ink-tertiary">
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
 * Lo que hay que saber del stock de un vistazo — DESIGN-REFERENCE §6.4.
 *
 * Es UNA etiqueta y no tres: son estados excluyentes, y apilarlas dejaría
 * «Sin colores» al lado de «Sin stock» diciendo dos veces lo mismo con
 * palabras distintas.
 *
 *   Sin colores      el producto está cargado y no tiene nada que vender.
 *                    No es falta de stock: es que todavía no hay dónde
 *                    ponerlo (F2.4 dejó el alta en dos pasos).
 *   Stock negativo   alguna variante quedó por debajo de cero. Lo produce
 *                    una venta registrada sobre unidades que el sistema no
 *                    tenía (RF-24, §5.4): es una discrepancia a corregir,
 *                    no una compra pendiente, y por eso no dice «sin stock».
 *   Sin stock        no queda nada disponible para vender.
 *   Quedan N         por debajo del umbral de RF-20.
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

/**
 * Sin resultados (§8), que no es lo mismo que vacío: acá hay productos y
 * ninguno coincide. Se repite el término buscado —para ver el error de
 * tipeo sin volver al campo—, se sugiere aflojar los filtros y se ofrece
 * limpiarlos de una.
 */
function SinResultados({ filtros }: { filtros: FiltrosDeProductos }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-body-sm text-ink">
        {filtros.q
          ? `No encontramos ningún producto para «${filtros.q}».`
          : "Ningún producto coincide con los filtros."}
      </p>
      <p className="text-caption text-ink-secondary">
        Probá con menos filtros, o revisá cómo quedó escrito.
      </p>
      <Button asChild variant="secondary" size="sm" className="mt-2">
        <Link href={urlDeFiltros(sinFiltros(filtros))}>Limpiar todo</Link>
      </Button>
    </div>
  );
}

/** Estado vacío (§8): dice qué falta y ofrece el primer paso. */
export function SinProductos() {
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
