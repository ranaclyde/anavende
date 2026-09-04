"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  ArrowDown,
  ArrowUp,
  CreditCard,
  Eye,
  EyeOff,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import { DialogoDeMedioDePago } from "@/components/admin/pagos/dialogo";
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
import {
  cambiarEstadoDeMedioDePago,
  eliminarUnMedioDePago,
  moverMedioDePago,
} from "@/modules/settings/actions";
import type { MedioDePagoDelPanel } from "@/modules/settings/queries";

/**
 * Medios de pago — RF-19, RN-01, DESIGN-REFERENCE §6.9.
 *
 * **El orden de las filas ES el orden de la tienda.** Por eso se mueve con
 * flechas y no hay una columna con el número de posición: el número sería un
 * segundo lugar donde mirar lo que la lista ya está diciendo, y uno que
 * además hay que mantener a mano.
 *
 * En móvil la tabla se vuelve tarjetas, no scroll horizontal (§6.9).
 */
export function ListadoDeMediosDePago({
  items,
}: {
  items: MedioDePagoDelPanel[];
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<MedioDePagoDelPanel | null>(null);
  const [porBorrar, setPorBorrar] = useState<MedioDePagoDelPanel | null>(null);

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

  const borrar = (medio: MedioDePagoDelPanel) => {
    setPorBorrar(null);
    correr(() => eliminarUnMedioDePago({ id: medio.id }));
  };

  const desactivarEnSuLugar = (medio: MedioDePagoDelPanel) => {
    setPorBorrar(null);
    correr(() => cambiarEstadoDeMedioDePago({ id: medio.id, activo: false }));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-ink-secondary">
          {items.length === 0
            ? "Sin medios de pago"
            : items.length === 1
              ? "1 medio de pago"
              : `${items.length} medios de pago`}
        </p>
        {/* Con la lista vacía este botón no está: el estado vacío ya ofrece
            el mismo primer paso en el medio de la pantalla, y dos botones de
            marca iguales a 100px uno del otro se leen como un error (§6.3:
            una sola por pantalla). */}
        {items.length === 0 ? null : (
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

      {items.length === 0 ? (
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
                  {/* Cinco botones de 36px con 4px entre ellos piden 196px de
                      contenido; con el padding de la celda, `w-56`. */}
                  <TableHead className="w-56 text-right">
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
                        ultimo={i === items.length - 1}
                        ocupado={enCurso}
                        alSubir={() => mover(medio, "arriba")}
                        alBajar={() => mover(medio, "abajo")}
                        alEditar={() => setEditando(medio)}
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
                    ultimo={i === items.length - 1}
                    ocupado={enCurso}
                    alSubir={() => mover(medio, "arriba")}
                    alBajar={() => mover(medio, "abajo")}
                    alEditar={() => setEditando(medio)}
                    alAlternar={() => alternarEstado(medio)}
                    alBorrar={() => setPorBorrar(medio)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* El diálogo NO existe mientras está cerrado, y eso no es un ahorro:
          es lo que garantiza que abra en blanco. Ver el comentario de
          `DialogoDeMedioDePago`. */}
      {creando ? (
        <DialogoDeMedioDePago
          medio={null}
          abierto
          alCerrar={() => setCreando(false)}
        />
      ) : null}
      {editando ? (
        <DialogoDeMedioDePago
          medio={editando}
          abierto
          alCerrar={() => setEditando(null)}
        />
      ) : null}

      <Dialog
        open={porBorrar !== null}
        onOpenChange={(abierto) => (abierto ? null : setPorBorrar(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Borrar «{porBorrar?.name}»</DialogTitle>
            {/* A diferencia del catálogo, acá borrar siempre se puede: nada
                referencia a un medio de pago (RN-11 no le cabe). Por eso el
                diálogo no pregunta si se puede: avisa que no hay vuelta atrás
                y ofrece la salida que casi siempre es la buena. */}
            <DialogDescription>
              Se borra con su logo y no hay vuelta atrás. Si solo querés dejar
              de ofrecerlo por un tiempo, desactivalo: queda guardado y no se
              muestra en la tienda.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="tertiary" onClick={() => setPorBorrar(null)}>
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
      {/* Chip CLARO en los dos modos (§6.10), igual que el logo de marca: el
          de Mercado Pago o el de Visa vienen sobre transparente y no son
          nuestros para repintarlos. El hueco se reserva SIEMPRE, con o sin
          logo: acá la mayoría va a tener uno, y una fila sin él que corre el
          nombre 32px a la izquierda rompe la columna. */}
      <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-[6px] border border-border bg-logo-chip">
        {medio.logoUrl ? (
          <Image
            src={medio.logoUrl}
            alt=""
            width={32}
            height={32}
            className="size-full object-contain p-[3px]"
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
      </span>
    </div>
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
  alAlternar: () => void;
  alBorrar: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-0.5">
      {/* Las flechas de las puntas quedan DESHABILITADAS y no ocultas: si
          desaparecieran, los botones de al lado se correrían de fila en fila
          y habría que volver a buscar «Editar» en cada una. Su motivo lo dice
          el `title` (§6.3). */}
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
        onClick={alAlternar}
        title={medio.isActive ? "Desactivar" : "Activar"}
      >
        {medio.isActive ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        <span className="sr-only">
          {medio.isActive ? "Desactivar" : "Activar"} {medio.name}
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
        <span className="sr-only">Borrar {medio.name}</span>
      </Button>
    </div>
  );
}

/** Estado vacío (§8): dice qué falta y ofrece la acción. */
function Vacio({ alCrear }: { alCrear: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <p className="text-body-sm text-ink-secondary">
        Todavía no cargaste ningún medio de pago. Son los que ve el comprador
        para saber cómo puede pagar.
      </p>
      <Button variant="brand" size="sm" onClick={alCrear}>
        <Plus aria-hidden />
        Cargar el primero
      </Button>
    </div>
  );
}
