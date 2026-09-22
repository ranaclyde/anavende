import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { EstadoDeLaOrden } from "@/components/admin/ordenes/estado";
import { BajaDeLaCuenta } from "@/components/admin/usuarios/baja";
import { BloqueoDeLaCuenta } from "@/components/admin/usuarios/bloqueo";
import {
  EstadoDelUsuario,
  RolDelUsuario,
} from "@/components/admin/usuarios/estado";
import { EditarDatosDelUsuario } from "@/components/admin/usuarios/editar";
import { RestablecerContrasena } from "@/components/admin/usuarios/restablecer";
import { RolDelUsuarioEditable } from "@/components/admin/usuarios/rol";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { fechaConHora, fechaCorta } from "@/lib/fechas";
import { formatMoney } from "@/lib/money";
import { getSession } from "@/lib/session";
import { enlaceDeWhatsApp } from "@/lib/whatsapp";
import {
  contarAdministradoras,
  leerUsuarioDelPanel,
  type MovimientoDeEstado,
  type UsuarioDelPanel,
} from "@/modules/users/panel/queries";
import type { RolAsignable } from "@/modules/users/panel/schemas";

type Props = { params: Promise<{ id: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Usuario" };

  const usuario = await leerUsuarioDelPanel(id);
  return { title: usuario ? usuario.nombre : "Usuario" };
}

/**
 * Ficha de un usuario — FS RF-26, RF-27, RF-34. Tareas F7.6, F7.7 y F7.9.
 *
 * Es la hoja de trabajo de una cuenta: los datos que se corrigen, el rol que
 * se cambia, el email de contraseña nueva que se dispara, el bloqueo, la baja,
 * y **sus órdenes**, que es lo que contesta quién es esta persona para la
 * tienda.
 *
 * **La tarjeta de estado está siempre**, también cuando no pasa nada: es de
 * donde se bloquea (F7.7), así que esconderla mientras la cuenta está sana
 * escondería el botón. Antes aparecía sólo con algo que contar, porque no
 * había nada que hacer ahí.
 *
 * **El bloque de la baja aparece cuando hay una** —pedida o ejecutada—, y no
 * antes: no se puede dar de baja a quien no la pidió (F7.9), así que un botón
 * permanente prometería algo que no existe.
 *
 * **Y no hay «eliminar»**, que tampoco va a venir: un comprador con órdenes no
 * se borra ni se puede borrar (§5.6, F4.5b).
 */
export default async function FichaDeUsuario({ params }: Props) {
  const { id } = await params;

  // Un `id` con otra forma no llega a la base: el driver lo rechazaría con un
  // error de Postgres en vez de un 404 honesto.
  if (!UUID.test(id)) notFound();

  // Las tres son independientes: encadenarlas agregaría idas a la base por
  // cada carga. `getSession` está cacheada por petición —el layout ya la
  // pidió—, así que acá no cuesta nada.
  const [usuario, administradoras, sesion] = await Promise.all([
    leerUsuarioDelPanel(id),
    contarAdministradoras(),
    getSession(),
  ]);

  if (!usuario) notFound();

  const esMiCuenta = sesion?.profile.id === usuario.id;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePanel
        titulo={usuario.nombre}
        volver={{ href: "/admin/usuarios", etiqueta: "Usuarios" }}
        insignias={
          <>
            <RolDelUsuario rol={usuario.rol} />
            <EstadoDelUsuario
              bloqueado={usuario.bloqueado}
              bajaPedida={usuario.bajaPedida}
              dadoDeBaja={usuario.dadoDeBaja}
            />
            {esMiCuenta ? (
              <span className="text-caption text-ink-secondary">(sos vos)</span>
            ) : null}
          </>
        }
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <a
                href={enlaceDeWhatsApp(
                  usuario.telefono,
                  `¡Hola, ${usuario.firstName}! Te escribo de AnaVende.`,
                )}
                target="_blank"
                rel="noopener noreferrer"
              >
                <IconoWhatsApp className="size-4" />
                Escribirle por WhatsApp
              </a>
            </Button>

            <RestablecerContrasena
              id={usuario.id}
              nombre={usuario.firstName}
              email={usuario.email}
            />
          </div>
        }
      />

      <p className="text-body-sm text-ink-secondary">
        {usuario.email} · cuenta creada el {fechaCorta(usuario.creadoEn)}
      </p>

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex flex-col gap-4">
          <TarjetaDeSeccion id="datos" titulo="Datos">
            <EditarDatosDelUsuario usuario={usuario} />
          </TarjetaDeSeccion>

          <SusOrdenes usuario={usuario} />
        </div>

        <div className="flex flex-col gap-4">
          <TarjetaDeSeccion id="rol" titulo="Rol">
            <RolDelUsuarioEditable
              id={usuario.id}
              rolActual={usuario.rol as RolAsignable}
              nombre={usuario.firstName}
              esMiCuenta={esMiCuenta}
              esLaUnicaAdministradora={
                usuario.rol === "admin" && administradoras <= 1
              }
            />
          </TarjetaDeSeccion>

          <TarjetaDeSeccion id="estado" titulo="Estado de la cuenta">
            {usuario.bloqueado ? (
              <div className="flex flex-col gap-1">
                <p className="text-body-sm text-ink">
                  Bloqueada
                  {usuario.bloqueadoEn
                    ? ` el ${fechaConHora(usuario.bloqueadoEn)}`
                    : ""}
                  {usuario.bloqueadoPor ? ` por ${usuario.bloqueadoPor}` : ""}.
                </p>
                {/* RF-27: el motivo es obligatorio y lo garantiza un CHECK,
                    así que si hay bloqueo hay motivo. */}
                <p className="text-body-sm text-ink-secondary">
                  <span className="text-ink-secondary">Motivo: </span>
                  {usuario.motivoDelBloqueo}
                </p>
                <p className="text-caption text-ink-secondary">
                  No puede entrar, y eso es lo que ve al intentarlo.
                </p>
              </div>
            ) : (
              // Con una baja encima no se dice «entra y compra con
              // normalidad»: el bloque de abajo cuenta que no, y se
              // contradirían a tres renglones de distancia. Lo que sí se dice
              // es lo que esta mitad de la tarjeta contesta —si está
              // bloqueada—, porque si no el botón queda pegado al título sin
              // nada que lo ubique.
              <p className="text-body-sm text-ink-secondary">
                {usuario.dadoDeBaja || usuario.bajaPedida
                  ? "No está bloqueada."
                  : "Entra y compra con normalidad."}
              </p>
            )}

            <BloqueoDeLaCuenta
              id={usuario.id}
              nombre={usuario.firstName}
              bloqueado={usuario.bloqueado}
              dadoDeBaja={usuario.dadoDeBaja}
              esMiCuenta={esMiCuenta}
              esLaUnicaAdministradora={
                usuario.rol === "admin" && administradoras <= 1
              }
            />

            <LaBaja usuario={usuario} />
          </TarjetaDeSeccion>

          <HistorialDeEstado movimientos={usuario.historialDeEstado} />
        </div>
      </div>
    </div>
  );
}

/**
 * La baja de la cuenta — RF-34, RN-13. Tarea F7.9.
 *
 * **Tres situaciones y no dos.** Sin baja no se dibuja nada: la baja la pide
 * la persona, así que acá no hay nada que ofrecer. Pedida, se lee el motivo
 * que escribió y el botón la ejecuta. Ejecutada, se lee quién y cuándo, y el
 * botón la revierte.
 *
 * **El motivo se sigue mostrando después de ejecutarla**: es lo que contesta
 * por qué esa cuenta ya no está, y es lo primero que se va a querer saber
 * cuando alguien pregunte. Lo que lo borra es revertir.
 */
function LaBaja({ usuario }: { usuario: UsuarioDelPanel }) {
  if (!usuario.bajaPedida && !usuario.dadoDeBaja) return null;

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex flex-col gap-1">
        {usuario.dadoDeBaja ? (
          <p className="text-body-sm text-ink">
            Dada de baja
            {usuario.dadoDeBajaEn
              ? ` el ${fechaConHora(usuario.dadoDeBajaEn)}`
              : ""}
            {usuario.dadoDeBajaPor ? ` por ${usuario.dadoDeBajaPor}` : ""}, a
            pedido suyo
            {usuario.bajaPedidaEn
              ? ` del ${fechaCorta(usuario.bajaPedidaEn)}`
              : ""}
            .
          </p>
        ) : (
          <p className="text-body-sm text-ink">
            Pidió la baja de su cuenta
            {usuario.bajaPedidaEn
              ? ` el ${fechaConHora(usuario.bajaPedidaEn)}`
              : ""}
            .
          </p>
        )}

        {/* RF-34: el motivo es obligatorio y lo garantiza un CHECK, así que si
            hay baja hay motivo. */}
        <p className="text-body-sm text-ink-secondary">
          <span className="text-ink-secondary">Motivo: </span>
          {usuario.motivoDeLaBaja}
        </p>

        <p className="text-caption text-ink-secondary">
          {usuario.dadoDeBaja
            ? "No puede entrar, y eso es lo que ve al intentarlo. No se borró nada: revertirla la devuelve con todo lo suyo."
            : "Mientras tanto su cuenta es de solo lectura: puede entrar y mirar, no comprar. Puede retirar el pedido ella misma."}
        </p>
      </div>

      <BajaDeLaCuenta
        id={usuario.id}
        nombre={usuario.firstName}
        dadoDeBaja={usuario.dadoDeBaja}
      />
    </div>
  );
}

/** Cómo se lee cada fila del historial. */
const MOVIMIENTOS: Record<MovimientoDeEstado["evento"], string> = {
  bloqueo: "Bloqueada",
  desbloqueo: "Desbloqueada",
  baja: "Dada de baja",
  reversion_de_baja: "Baja revertida",
};

/**
 * Lo que le pasó a la cuenta — RF-27: «se puede desbloquear, quedando también
 * registrado», y RF-34, que pide lo mismo de la baja. Tareas F7.7 y F7.9.
 *
 * **Sin nada que contar no hay tarjeta.** Es el caso de casi todas las
 * cuentas, y un «todavía no pasó nada» ocupando lugar en la columna del
 * costado no le contesta nada a nadie. Distinto de la tarjeta de estado de
 * arriba, que está siempre porque tiene el botón.
 *
 * **Se lee del más nuevo al más viejo** y cada fila dice quién y cuándo, que
 * es lo que §13.5 pide auditar. El motivo se repite en la fila aunque arriba
 * también esté: arriba está el de lo que pasa hoy, y acá el de cada una de las
 * veces que pasó. **Es lo único que queda de una baja revertida**, que borra
 * el pedido y su motivo.
 */
function HistorialDeEstado({
  movimientos,
}: {
  movimientos: MovimientoDeEstado[];
}) {
  if (movimientos.length === 0) return null;

  return (
    <TarjetaDeSeccion id="historial-cuenta" titulo="Historial de la cuenta">
      <ul className="flex flex-col gap-3">
        {movimientos.map((m) => (
          <li key={m.fecha} className="flex flex-col gap-0.5">
            <p className="text-body-sm text-ink">
              {MOVIMIENTOS[m.evento]}
              {" el "}
              <time dateTime={m.fecha}>{fechaConHora(m.fecha)}</time>
              {/* El autor puede faltar: `actor_user_id` es SET NULL, así que
                  si esa cuenta se borró queda el hecho sin el nombre. */}
              {m.autor ? ` por ${m.autor}` : ""}.
            </p>
            {m.motivo ? (
              <p className="text-caption text-ink-secondary">
                <span className="text-ink-secondary">Motivo: </span>
                {m.motivo}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </TarjetaDeSeccion>
  );
}

/**
 * Las últimas cinco órdenes — RF-26: «ver las órdenes de un usuario desde su
 * ficha» (decisión tuya del 2026-09-16).
 *
 * **Cinco y un enlace, no el listado entero**: contesta «¿quién es esta
 * persona?» de un vistazo sin repetir acá las solapas, los filtros y la
 * paginación que `/admin/ordenes` ya tiene. El total va al lado del título,
 * porque «las últimas cinco» no dice si hay seis o seiscientas.
 */
function SusOrdenes({ usuario }: { usuario: UsuarioDelPanel }) {
  if (usuario.ordenes === 0) {
    return (
      <TarjetaDeSeccion id="sus-ordenes" titulo="Sus órdenes">
        <p className="text-body-sm text-ink-secondary">
          Todavía no compró nada por la tienda. Si le vendiste por WhatsApp,
          podés cargar esa venta como orden manual y asociársela.
        </p>
      </TarjetaDeSeccion>
    );
  }

  return (
    <TarjetaDeSeccion
      id="sus-ordenes"
      titulo={
        <>
          Sus órdenes{" "}
          <span className="text-caption text-ink-secondary">
            ({usuario.ordenes})
          </span>
        </>
      }
      acciones={
        usuario.ordenes > usuario.ultimasOrdenes.length ? (
          <Button asChild variant="tertiary" size="sm" className="-mr-2">
            {/* Al listado de órdenes, buscando por su email: es la búsqueda
                que RF-21 ya tiene, y así se llega con solapas y filtros. */}
            <Link
              href={`/admin/ordenes?estado=todas&q=${encodeURIComponent(usuario.email)}`}
            >
              Ver todas
            </Link>
          </Button>
        ) : null
      }
    >
      <ul className="flex flex-col">
        {usuario.ultimasOrdenes.map((orden) => (
          <li
            key={orden.numero}
            className="border-b border-border last:border-b-0"
          >
            <Link
              href={`/admin/ordenes/${orden.numero}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 transition-colors duration-150 hover:text-brand"
            >
              <span className="text-body-sm font-medium text-ink">
                #{orden.numero}
              </span>
              <EstadoDeLaOrden estado={orden.estado} />
              <span className="text-caption text-ink-secondary tabular-nums">
                <time dateTime={orden.creadaEn}>
                  {fechaCorta(orden.creadaEn)}
                </time>{" "}
                · {orden.unidades}{" "}
                {orden.unidades === 1 ? "unidad" : "unidades"}
              </span>
              <span className="ml-auto text-body-sm font-medium text-ink tabular-nums">
                {formatMoney(orden.total)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </TarjetaDeSeccion>
  );
}
