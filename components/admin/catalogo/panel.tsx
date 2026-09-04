"use client";

import { Eye, EyeOff, Pencil, Plus, Star, Tags, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";

import {
  DESTACADO,
  PALABRAS,
  type PalabrasDeItem,
} from "@/components/admin/catalogo/copy";
import { DialogoDeItem } from "@/components/admin/catalogo/dialogo";
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
  cambiarDestacada,
  cambiarEstado,
  eliminar,
} from "@/modules/catalog/actions";
import type { ItemDeCatalogo } from "@/modules/catalog/queries";
import type { TipoDeItem } from "@/modules/catalog/schemas";

type Confirmacion = { accion: "borrar" | "desactivar"; item: ItemDeCatalogo };

/**
 * Listado de marcas, categorías o colores — RF-18, DESIGN-REFERENCE §6.9.
 *
 * Los conteos de uso no son decorativos: son los que deciden qué se puede
 * hacer con cada fila. Se muestran en la tabla y se vuelven a usar para
 * anticipar el rechazo, de modo que el diálogo explique el porqué ANTES de
 * intentar en lugar de devolver un error después.
 *
 * Anticipar no es confiar: el servidor vuelve a verificar (RN-11, RN-11b) y
 * si su respuesta contradice a la tabla —porque alguien cargó un producto
 * mientras tanto—, se muestra la del servidor.
 *
 * En móvil la tabla se vuelve tarjetas, no scroll horizontal (§6.9).
 */
export function PanelDeCatalogo({
  tipo,
  items,
}: {
  tipo: TipoDeItem;
  items: ItemDeCatalogo[];
}) {
  const palabras = PALABRAS[tipo];
  // `isFeatured` es `null` en los tipos que no se destacan (RF-18): la vista
  // pregunta por el dato, no por el tipo.
  const sePuedeDestacar = items.some((i) => i.isFeatured !== null);
  const [enCurso, iniciar] = useTransition();
  const [editando, setEditando] = useState<ItemDeCatalogo | null>(null);
  const [creando, setCreando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [errorDelServidor, setErrorDelServidor] = useState<string | null>(null);

  const abrirConfirmacion = (c: Confirmacion) => {
    setErrorDelServidor(null);
    setConfirmacion(c);
  };

  const ejecutar = (c: Confirmacion) => {
    iniciar(async () => {
      const resultado =
        c.accion === "borrar"
          ? await eliminar({ tipo, id: c.item.id })
          : await cambiarEstado({ tipo, id: c.item.id, activo: false });

      if (!resultado.ok) {
        setErrorDelServidor(resultado.message);
        return;
      }
      setConfirmacion(null);
    });
  };

  // Destacar no pide confirmación: no se pierde nada y se deshace con el
  // mismo clic. Confirmar cada acción reversible entrena a confirmar sin
  // leer, que es justo lo que arruina la confirmación de borrar.
  const destacar = (item: ItemDeCatalogo) => {
    iniciar(async () => {
      const r = await cambiarDestacada({
        id: item.id,
        destacada: !item.isFeatured,
      });
      if (!r.ok) setErrorDelServidor(r.message);
    });
  };

  const activar = (item: ItemDeCatalogo) => {
    iniciar(async () => {
      const r = await cambiarEstado({ tipo, id: item.id, activo: true });
      if (!r.ok) setErrorDelServidor(r.message);
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-body-sm text-ink-secondary">
          {items.length === 0
            ? `Sin ${palabras.plural}`
            : items.length === 1
              ? `1 ${palabras.singular}`
              : `${items.length} ${palabras.plural}`}
        </p>
        {/* Con la lista vacía este botón no está: el estado vacío ya ofrece
            el mismo primer paso en el medio de la pantalla, y dos botones de
            marca iguales a 100px uno del otro se leen como un error (§6.3:
            una sola por pantalla). */}
        {items.length === 0 ? null : (
          <Button variant="brand" size="sm" onClick={() => setCreando(true)}>
            <Plus aria-hidden />
            {palabras.nuevo}
          </Button>
        )}
      </div>

      {errorDelServidor && !confirmacion && (
        <p role="alert" className="text-body-sm text-danger">
          {errorDelServidor}
        </p>
      )}

      {items.length === 0 ? (
        <Vacio tipo={tipo} alCrear={() => setCreando(true)} />
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden overflow-hidden rounded-panel-card border border-border bg-surface md:block">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-surface-sunken">
                  {/* El nombre se queda con el espacio sobrante; las demás
                      ocupan lo que necesitan y nada más, para que el ojo no
                      cruce media pantalla vacía entre el nombre y su conteo.
                      La de acciones se ensancha cuando aparece la estrella:
                      cuatro botones de 36px con 4px de separación piden 156px
                      de contenido, y `w-32` daba 104px descontando el
                      padding —ya justo para tres—. */}
                  <TableHead>Nombre</TableHead>
                  <TableHead className="w-28">Estado</TableHead>
                  <TableHead data-align="right" className="w-32">
                    Productos
                  </TableHead>
                  <TableHead
                    className={`text-right ${sePuedeDestacar ? "w-48" : "w-36"}`}
                  >
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Nombre item={item} tipo={tipo} />
                    </TableCell>
                    <TableCell>
                      <EstadoDelItem
                        activo={item.isActive}
                        palabras={palabras}
                      />
                    </TableCell>
                    <TableCell data-align="right">
                      <Uso item={item} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Acciones
                        item={item}
                        palabras={palabras}
                        ocupado={enCurso}
                        alEditar={() => setEditando(item)}
                        alDestacar={() => destacar(item)}
                        alActivar={() => activar(item)}
                        alDesactivar={() =>
                          abrirConfirmacion({ accion: "desactivar", item })
                        }
                        alBorrar={() =>
                          abrirConfirmacion({ accion: "borrar", item })
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Móvil */}
          <ul className="flex flex-col gap-2 md:hidden">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <Nombre item={item} tipo={tipo} />
                  <EstadoDelItem activo={item.isActive} palabras={palabras} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-body-sm text-ink-secondary">
                    <Uso item={item} />
                  </span>
                  <Acciones
                    item={item}
                    palabras={palabras}
                    ocupado={enCurso}
                    alEditar={() => setEditando(item)}
                    alDestacar={() => destacar(item)}
                    alActivar={() => activar(item)}
                    alDesactivar={() =>
                      abrirConfirmacion({ accion: "desactivar", item })
                    }
                    alBorrar={() => abrirConfirmacion({ accion: "borrar", item })}
                  />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* El diálogo NO existe mientras está cerrado, y eso no es un ahorro:
          es lo que garantiza que abra en blanco. Ver el comentario de
          `DialogoDeItem`. */}
      {creando ? (
        <DialogoDeItem
          tipo={tipo}
          item={null}
          abierto
          alCerrar={() => setCreando(false)}
        />
      ) : null}
      {editando ? (
        <DialogoDeItem
          tipo={tipo}
          item={editando}
          abierto
          alCerrar={() => setEditando(null)}
        />
      ) : null}

      {confirmacion && (
        <DialogoDeConfirmacion
          tipo={tipo}
          confirmacion={confirmacion}
          ocupado={enCurso}
          errorDelServidor={errorDelServidor}
          alCerrar={() => setConfirmacion(null)}
          alConfirmar={() => ejecutar(confirmacion)}
          alDesactivarEnSuLugar={() =>
            ejecutar({ accion: "desactivar", item: confirmacion.item })
          }
        />
      )}
    </div>
  );
}

function Nombre({ item, tipo }: { item: ItemDeCatalogo; tipo: TipoDeItem }) {
  return (
    <span className="flex items-center gap-2">
      {/* El logo es decorativo acá: el nombre está al lado, en texto, y
          repetirlo en el `alt` se lo haría leer dos veces a un lector de
          pantalla (§9). Las marcas sin logo no dejan un hueco: la fila no
          reserva lugar para algo que la mayoría no va a tener. */}
      {tipo === "marca" && item.logoUrl && (
        // Chip CLARO en los dos modos (§6.10). Un logo de marca es trazo
        // sobre transparente, casi siempre oscuro: sobre el panel en modo
        // oscuro desaparece. Y a diferencia del logo de AnaVende, el de una
        // marca ajena no se puede derivar en versión clara.
        <span className="grid size-6 shrink-0 place-items-center overflow-hidden rounded-[4px] border border-border bg-logo-chip">
          <Image
            src={item.logoUrl}
            alt=""
            width={24}
            height={24}
            className="size-full object-contain p-[2px]"
          />
        </span>
      )}
      {tipo === "color" && item.hexCode && (
        <span
          aria-hidden
          style={{ backgroundColor: item.hexCode }}
          className="size-4 shrink-0 rounded-full border border-border"
        />
      )}
      <span className="font-medium text-ink">{item.name}</span>
      {item.isFeatured && (
        // Tono `brand`: §6.4 lo reserva para identidad —destacado, oferta—.
        // Con texto y no solo con el ícono: el Badge no admite otra cosa (§9).
        <Badge tone="brand">
          <Star aria-hidden className="fill-current" />
          {DESTACADO.etiqueta}
        </Badge>
      )}
      {tipo === "color" && item.hexCode && (
        // El código va escrito, no solo pintado: la muestra sola no sirve a
        // quien no distingue ese matiz (§9).
        <span className="font-mono text-caption text-ink-tertiary">
          {item.hexCode}
        </span>
      )}
    </span>
  );
}

function EstadoDelItem({
  activo,
  palabras,
}: {
  activo: boolean;
  palabras: PalabrasDeItem;
}) {
  return activo ? (
    <Badge tone="success">{palabras.activo}</Badge>
  ) : (
    <Badge tone="neutral">{palabras.inactivo}</Badge>
  );
}

function Uso({ item }: { item: ItemDeCatalogo }) {
  const total = item.activos + item.inactivos;

  if (total === 0) {
    return <span className="text-ink-tertiary">Sin uso</span>;
  }

  return (
    <span className="tabular-nums">
      {item.activos > 0 && <span className="text-ink">{item.activos}</span>}
      {item.activos > 0 && item.inactivos > 0 && (
        <span className="text-ink-tertiary"> · </span>
      )}
      {item.inactivos > 0 && (
        <span className="text-ink-secondary">
          {item.inactivos} inactivo{item.inactivos === 1 ? "" : "s"}
        </span>
      )}
    </span>
  );
}

function Acciones({
  item,
  palabras,
  ocupado,
  alEditar,
  alDestacar,
  alActivar,
  alDesactivar,
  alBorrar,
}: {
  item: ItemDeCatalogo;
  palabras: PalabrasDeItem;
  ocupado: boolean;
  alEditar: () => void;
  alDestacar: () => void;
  alActivar: () => void;
  alDesactivar: () => void;
  alBorrar: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      {/*
        Un botón con `aria-pressed`, no un interruptor: la fila ya habla en
        botones de ícono, y meter un `switch` entre ellos serían dos lenguajes
        de control en la misma celda. `aria-pressed` dice el estado sin
        inventar un rol —lo que el lector de pantalla anuncia coincide con lo
        que la estrella muestra—.
      */}
      {item.isFeatured !== null && (
        <Button
          variant="tertiary"
          size="icon"
          onClick={alDestacar}
          disabled={ocupado}
          aria-pressed={item.isFeatured}
          title={
            item.isFeatured
              ? `${DESTACADO.quitar}: ${item.name}`
              : `${DESTACADO.destacar}: ${item.name}`
          }
          className={item.isFeatured ? "text-brand hover:text-brand" : undefined}
        >
          <Star aria-hidden className={item.isFeatured ? "fill-current" : ""} />
          <span className="sr-only">
            {item.isFeatured ? DESTACADO.quitar : DESTACADO.destacar}{" "}
            {item.name}
          </span>
        </Button>
      )}

      <Button
        variant="tertiary"
        size="icon"
        onClick={alEditar}
        disabled={ocupado}
        title={`Editar ${item.name}`}
      >
        <Pencil aria-hidden />
        <span className="sr-only">Editar {item.name}</span>
      </Button>

      <Button
        variant="tertiary"
        size="icon"
        onClick={item.isActive ? alDesactivar : alActivar}
        disabled={ocupado}
        title={
          item.isActive
            ? `Desactivar ${item.name}`
            : `Activar ${item.name}`
        }
      >
        {item.isActive ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        <span className="sr-only">
          {item.isActive ? "Desactivar" : "Activar"} {item.name}
        </span>
      </Button>

      <Button
        variant="tertiary"
        size="icon"
        onClick={alBorrar}
        disabled={ocupado}
        title={`Borrar ${palabras.singular} ${item.name}`}
        className="text-ink-secondary hover:text-danger"
      >
        <Trash2 aria-hidden />
        <span className="sr-only">
          Borrar {palabras.singular} {item.name}
        </span>
      </Button>
    </div>
  );
}

function Vacio({
  tipo,
  alCrear,
}: {
  tipo: TipoDeItem;
  alCrear: () => void;
}) {
  const palabras = PALABRAS[tipo];
  return (
    <div className="flex flex-col items-center gap-3 rounded-panel-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span
        aria-hidden
        className="grid size-12 place-items-center rounded-full bg-surface-sunken text-ink-tertiary"
      >
        <Tags className="size-5" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-body font-medium text-ink">{palabras.vacio}</p>
        <p className="max-w-sm text-body-sm text-ink-secondary">
          Se eligen al cargar un producto, así que conviene tener al menos una
          antes de empezar.
        </p>
      </div>
      <Button variant="brand" size="sm" onClick={alCrear}>
        <Plus aria-hidden />
        {palabras.nuevo}
      </Button>
    </div>
  );
}

/**
 * Confirmación de las acciones que no se deshacen solas.
 *
 * El diálogo distingue cuatro situaciones porque la respuesta honesta es
 * distinta en cada una: se puede, no se puede y hay salida, no se puede y hay
 * que hacer otra cosa primero, o el servidor dijo que no.
 */
function DialogoDeConfirmacion({
  tipo,
  confirmacion,
  ocupado,
  errorDelServidor,
  alCerrar,
  alConfirmar,
  alDesactivarEnSuLugar,
}: {
  tipo: TipoDeItem;
  confirmacion: Confirmacion;
  ocupado: boolean;
  errorDelServidor: string | null;
  alCerrar: () => void;
  alConfirmar: () => void;
  alDesactivarEnSuLugar: () => void;
}) {
  const { accion, item } = confirmacion;
  const palabras = PALABRAS[tipo];
  const total = item.activos + item.inactivos;

  const borrando = accion === "borrar";
  const bloqueadoPorUso = borrando ? total > 0 : item.activos > 0;

  // Al borrar algo que está en uso, desactivar es la salida que ofrece RN-11
  // —pero solo si desactivar es posible: con productos activos, RN-11b
  // también lo rechazaría, y ofrecer un botón que va a fallar es peor que no
  // ofrecerlo.
  const puedeDesactivarEnSuLugar =
    borrando && bloqueadoPorUso && item.isActive && item.activos === 0;

  const titulo = bloqueadoPorUso
    ? borrando
      ? `No se puede borrar «${item.name}»`
      : `No se puede desactivar «${item.name}»`
    : borrando
      ? `¿Borrar «${item.name}»?`
      : `¿Desactivar «${item.name}»?`;

  const uno = borrando ? total === 1 : item.activos === 1;

  const cuerpo = bloqueadoPorUso
    ? borrando
      ? `${uno ? "Hay 1 producto que usa" : `Hay ${total} productos que usan`} ${palabras.demostrativo} ${palabras.singular}. Borrar${palabras.pronombre} dejaría ${uno ? "ese producto" : "esos productos"} sin ${palabras.singular}.`
      : `${uno ? "Hay 1 producto activo que usa" : `Hay ${item.activos} productos activos que usan`} ${palabras.demostrativo} ${palabras.singular}. Desactiva${uno ? "lo" : "los"} primero: un producto a la venta no puede tener ${palabras.singular === "color" ? "un" : "una"} ${palabras.singular} ${palabras.inactivo.toLowerCase()}.`
    : borrando
      ? `Se borra para siempre y no se puede recuperar. No hay ningún producto que ${palabras.pronombre} use.`
      : palabras.desactivar;

  return (
    <Dialog open onOpenChange={(v) => !v && alCerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{cuerpo}</DialogDescription>
        </DialogHeader>

        {puedeDesactivarEnSuLugar && (
          <p className="text-body-sm text-ink-secondary">
            Podés desactivar{palabras.pronombre}: deja de ofrecerse al cargar
            productos, y los que ya {palabras.pronombre} usan no se tocan.
          </p>
        )}

        {errorDelServidor && (
          <p role="alert" className="text-body-sm text-danger">
            {errorDelServidor}
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={alCerrar} disabled={ocupado}>
            {bloqueadoPorUso && !puedeDesactivarEnSuLugar ? "Entendido" : "Cancelar"}
          </Button>

          {puedeDesactivarEnSuLugar && (
            <Button
              variant="secondary"
              onClick={alDesactivarEnSuLugar}
              loading={ocupado}
              loadingLabel="Desactivando"
            >
              Desactivar en su lugar
            </Button>
          )}

          {!bloqueadoPorUso && (
            <Button
              variant={borrando ? "destructive-solid" : "brand"}
              onClick={alConfirmar}
              loading={ocupado}
              loadingLabel={borrando ? "Borrando" : "Desactivando"}
            >
              {borrando ? "Borrar" : "Desactivar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
