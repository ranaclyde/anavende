"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  CreditCard,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { VacioDelPanel } from "@/components/admin/vacio";
import { EdicionDeMedioDePago } from "@/components/admin/pagos/edicion";
import { PromocionesDeMedioDePago } from "@/components/admin/pagos/promociones";
import { PaginacionDelPanel, tramo } from "@/components/admin/paginacion";
import { Badge } from "@/components/ui/badge";
import { avisar } from "@/components/ui/aviso";
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
import {
  cambiarEstadoDeMedioDePago,
  eliminarUnMedioDePago,
  moverMedioDePago,
} from "@/modules/settings/actions";
import { POR_PAGINA, urlDePagina } from "@/modules/catalog/filtros-panel";
import type { MedioDePagoDelPanel } from "@/modules/settings/queries";

/**
 * Medios de pago — RF-19, RN-01, DR §6.9. El orden de las filas es el de la
 * tienda: se mueve con flechas, sin columna de posición.
 */
export function ListadoDeMediosDePago({
  items,
  total,
  pagina,
  paginas,
  base,
}: {
  /** Los de esta página. Para contar, el estado vacío y el botón va `total`. */
  items: MedioDePagoDelPanel[];
  total: number;
  pagina: number;
  paginas: number;
  /**
   * La ruta de la solapa: el enlace se arma acá porque una función no cruza
   * de servidor a cliente.
   */
  base: string;
}) {
  // «Bajar» se apaga solo en el último de todos: el último de la página 1
  // pasa a la 2.
  const esElUltimo = (i: number) =>
    pagina === paginas && i === items.length - 1;

  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<MedioDePagoDelPanel | null>(null);
  const [porBorrar, setPorBorrar] = useState<MedioDePagoDelPanel | null>(null);
  // El id y no el medio: así el drawer muestra las promociones de la última
  // revalidación.
  const [conPromociones, setConPromociones] = useState<string | null>(null);
  const medioConPromociones =
    items.find((m) => m.id === conPromociones) ?? null;

  const correr = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? null);
    });
  };

  const mover = (medio: MedioDePagoDelPanel, direccion: "arriba" | "abajo") =>
    correr(() => moverMedioDePago({ id: medio.id, direccion }));

  const alternarEstado = (medio: MedioDePagoDelPanel) =>
    correr(() =>
      cambiarEstadoDeMedioDePago({ id: medio.id, activo: !medio.isActive }),
    );

  // Avisa el borrado y nada más: borrar se lleva la fila y no queda dónde
  // poner la respuesta (DR §6.15).
  const borrar = (medio: MedioDePagoDelPanel) => {
    setPorBorrar(null);
    correr(async () => {
      const r = await eliminarUnMedioDePago({ id: medio.id });
      if (r.ok) avisar(`Borraste «${medio.name}».`);
      return r;
    });
  };

  const desactivarEnSuLugar = (medio: MedioDePagoDelPanel) => {
    setPorBorrar(null);
    correr(() => cambiarEstadoDeMedioDePago({ id: medio.id, activo: false }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-ink-secondary">
          {total === 0
            ? "Sin medios de pago"
            : tramo({
                pagina,
                porPagina: POR_PAGINA,
                total,
                cosa: { singular: "medio de pago", plural: "medios de pago" },
              })}
        </p>
        {/* Con la lista vacía el botón lo ofrece el estado vacío: uno de marca
            por pantalla (§6.3). */}
        {total === 0 ? null : (
          <Button variant="brand" size="sm" onClick={() => setCreando(true)}>
            <Plus aria-hidden />
            Nuevo medio de pago
          </Button>
        )}
      </div>

      {error === null ? null : (
        <p role="alert" className="text-body-sm text-danger">
          {error}
        </p>
      )}

      {total === 0 ? (
        <Vacio alCrear={() => setCreando(true)} />
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden overflow-hidden rounded-panel-card border border-border bg-surface md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-surface-sunken">
                  <TableHead>Medio de pago</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  {/* Seis botones de 36px y el separador: `w-64`. */}
                  <TableHead className="w-64 text-right">
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((medio, i) => (
                  <TableRow key={medio.id}>
                    <TableCell>
                      <Nombre medio={medio} />
                    </TableCell>
                    <TableCell>
                      <Estado activo={medio.isActive} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Acciones
                        medio={medio}
                        primero={i === 0}
                        ultimo={esElUltimo(i)}
                        ocupado={enCurso}
                        alSubir={() => mover(medio, "arriba")}
                        alBajar={() => mover(medio, "abajo")}
                        alEditar={() => setEditando(medio)}
                        alPromociones={() => setConPromociones(medio.id)}
                        alAlternar={() => alternarEstado(medio)}
                        alBorrar={() => setPorBorrar(medio)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Móvil */}
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((medio, i) => (
              <li
                key={medio.id}
                className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Nombre medio={medio} />
                  <Estado activo={medio.isActive} />
                </div>
                <div className="flex justify-end">
                  <Acciones
                    medio={medio}
                    primero={i === 0}
                    ultimo={esElUltimo(i)}
                    ocupado={enCurso}
                    alSubir={() => mover(medio, "arriba")}
                    alBajar={() => mover(medio, "abajo")}
                    alEditar={() => setEditando(medio)}
                    alPromociones={() => setConPromociones(medio.id)}
                    alAlternar={() => alternarEstado(medio)}
                    alBorrar={() => setPorBorrar(medio)}
                  />
                </div>
              </li>
            ))}
          </ul>

          <PaginacionDelPanel
            pagina={pagina}
            paginas={paginas}
            href={(n) => urlDePagina(base, n)}
          />
        </>
      )}

      {/* El drawer no existe mientras está cerrado: así abre en blanco (ver
          `EdicionDeMedioDePago`). */}
      {creando ? (
        <EdicionDeMedioDePago
          medio={null}
          abierto
          alCerrar={() => setCreando(false)}
        />
      ) : null}
      {editando ? (
        <EdicionDeMedioDePago
          medio={editando}
          abierto
          alCerrar={() => setEditando(null)}
        />
      ) : null}

      {medioConPromociones ? (
        <PromocionesDeMedioDePago
          medio={medioConPromociones}
          alCerrar={() => setConPromociones(null)}
        />
      ) : null}

      <Dialog
        open={porBorrar !== null}
        onOpenChange={(abierto) => (abierto ? null : setPorBorrar(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar «{porBorrar?.name}»</DialogTitle>
            {/* Acá borrar siempre se puede: nada referencia a un medio de pago. */}
            <DialogDescription>
              Se borra con su logo y no hay vuelta atrás. Si solo querés dejar
              de ofrecerlo por un tiempo, desactivalo: queda guardado y no se
              muestra en la tienda.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPorBorrar(null)}>
              Cancelar
            </Button>
            {porBorrar?.isActive ? (
              <Button
                variant="secondary"
                onClick={() => porBorrar && desactivarEnSuLugar(porBorrar)}
              >
                Desactivar
              </Button>
            ) : null}
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

function Nombre({ medio }: { medio: MedioDePagoDelPanel }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {/* Chip claro en los dos modos (DR §6.10). El hueco se reserva siempre,
          apaisado: los logos de pago son anchos. */}
      <span className="relative grid h-8 w-14 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-border bg-logo-chip">
        {medio.logoUrl ? (
          // Absoluta: en la celda de la grilla la altura al 100% no se resolvía
          // y un logo más alto que ancho salía cortado.
          <Image
            src={medio.logoUrl}
            alt=""
            width={112}
            height={64}
            className="absolute inset-0 size-full object-contain p-[3px]"
          />
        ) : (
          <CreditCard aria-hidden className="size-4 text-logo-chip-ink" />
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-medium text-ink">{medio.name}</span>
        {medio.description ? (
          <span className="truncate text-caption text-ink-secondary">
            {medio.description}
          </span>
        ) : null}
        <Vigentes medio={medio} />
      </span>
    </div>
  );
}

/** Cuántas promociones de cuotas se ven hoy (RF-40). Sin ninguna vigente no dice nada. */
function Vigentes({ medio }: { medio: MedioDePagoDelPanel }) {
  const n = medio.promociones.filter(
    (p) => p.activa && p.estado === "vigente",
  ).length;
  if (n === 0) return null;
  return (
    <span className="text-caption text-success">
      {n === 1 ? "1 promoción vigente" : `${n} promociones vigentes`}
    </span>
  );
}

function Estado({ activo }: { activo: boolean }) {
  return activo ? (
    <Badge tone="success">Activo</Badge>
  ) : (
    <Badge tone="neutral">Inactivo</Badge>
  );
}

function Acciones({
  medio,
  primero,
  ultimo,
  ocupado,
  alSubir,
  alBajar,
  alEditar,
  alPromociones,
  alAlternar,
  alBorrar,
}: {
  medio: MedioDePagoDelPanel;
  primero: boolean;
  ultimo: boolean;
  ocupado: boolean;
  alSubir: () => void;
  alBajar: () => void;
  alEditar: () => void;
  alPromociones: () => void;
  alAlternar: () => void;
  alBorrar: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* Las flechas de las puntas quedan deshabilitadas y no ocultas, o los
          botones de al lado se correrían de fila en fila. */}
      <Button
        variant="tertiary"
        size="icon"
        disabled={ocupado || primero}
        onClick={alSubir}
        title={primero ? "Ya es el primero" : "Subir en la lista"}
      >
        <ArrowUp aria-hidden />
        <span className="sr-only">Subir {medio.name} en la lista</span>
      </Button>
      <Button
        variant="tertiary"
        size="icon"
        disabled={ocupado || ultimo}
        onClick={alBajar}
        title={ultimo ? "Ya es el último" : "Bajar en la lista"}
      >
        <ArrowDown aria-hidden />
        <span className="sr-only">Bajar {medio.name} en la lista</span>
      </Button>

      <span aria-hidden className="mx-1 h-5 w-px bg-border" />

      <Button
        variant="tertiary"
        size="icon"
        disabled={ocupado}
        onClick={alEditar}
        title="Editar"
      >
        <Pencil aria-hidden />
        <span className="sr-only">Editar {medio.name}</span>
      </Button>
      <Button
        variant="tertiary"
        size="icon"
        disabled={ocupado}
        onClick={alPromociones}
        title="Promociones de cuotas"
      >
        <BadgePercent aria-hidden />
        <span className="sr-only">Promociones de cuotas de {medio.name}</span>
      </Button>
      <Button
        variant="tertiary"
        size="icon"
        disabled={ocupado}
        onClick={alAlternar}
        title={medio.isActive ? "Desactivar" : "Activar"}
      >
        {medio.isActive ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        <span className="sr-only">
          {medio.isActive ? "Desactivar" : "Activar"} {medio.name}
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
        <span className="sr-only">Borrar {medio.name}</span>
      </Button>
    </div>
  );
}

/** Estado vacío (§8): dice qué falta y ofrece la acción. */
function Vacio({ alCrear }: { alCrear: () => void }) {
  return (
    <VacioDelPanel
      icono={CreditCard}
      titulo="Todavía no cargaste ningún medio de pago."
      accion={
        <Button variant="brand" size="sm" onClick={alCrear}>
          <Plus aria-hidden />
          Cargar el primero
        </Button>
      }
    >
      Son los que ve el comprador para saber cómo puede pagar.
    </VacioDelPanel>
  );
}
