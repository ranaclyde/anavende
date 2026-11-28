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
import { FotoAmpliada } from "@/components/admin/usuarios/foto-ampliada";
import { RestablecerContrasena } from "@/components/admin/usuarios/restablecer";
import { RolDelUsuarioEditable } from "@/components/admin/usuarios/rol";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IconoWhatsApp } from "@/components/ui/icono-whatsapp";
import { dateWithTime, shortDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getSession, requireAdmin } from "@/lib/session";
import { whatsappLink } from "@/lib/whatsapp";
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
  await requireAdmin();
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Usuario" };

  const usuario = await leerUsuarioDelPanel(id);
  return { title: usuario ? usuario.nombre : "Usuario" };
}

/**
 * Ficha de un usuario (RF-26, RF-27, RF-34). No hay «eliminar» a propósito:
 * un comprador con órdenes no se puede borrar (§5.6).
 */
export default async function FichaDeUsuario({ params }: Props) {
  await requireAdmin();

  const { id } = await params;

  // Un `id` que no es UUID daría un error de Postgres en vez de un 404.
  if (!UUID.test(id)) notFound();

  // `getSession` está cacheada por petición: el layout ya la pidió.
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
        retrato={<Retrato usuario={usuario} />}
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
                href={whatsappLink(
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
        {usuario.email} · cuenta creada el {shortDate(usuario.creadoEn)}
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
                    ? ` el ${dateWithTime(usuario.bloqueadoEn)}`
                    : ""}
                  {usuario.bloqueadoPor ? ` por ${usuario.bloqueadoPor}` : ""}.
                </p>
                {/* Un CHECK garantiza el motivo si hay bloqueo (RF-27). */}
                <p className="text-body-sm text-ink-secondary">
                  <span className="text-ink-secondary">Motivo: </span>
                  {usuario.motivoDelBloqueo}
                </p>
                <p className="text-caption text-ink-secondary">
                  No puede entrar, y eso es lo que ve al intentarlo.
                </p>
              </div>
            ) : (
              // Con una baja encima, «compra con normalidad» contradiría al
              // bloque de la baja.
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

/** Con foto propia se amplía al tocarla; el blobatar no es un botón. */
function Retrato({ usuario }: { usuario: UsuarioDelPanel }) {
  if (!usuario.tieneFoto)
    return <Avatar src={usuario.cara} tamano={64} arriba />;

  return (
    <FotoAmpliada
      src={usuario.cara}
      nombre={`${usuario.firstName} ${usuario.lastName}`}
    />
  );
}

/**
 * Sin baja no se dibuja (la pide la persona, no se ofrece). Pedida, el botón
 * la ejecuta; ejecutada, la revierte (RF-34).
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
              ? ` el ${dateWithTime(usuario.dadoDeBajaEn)}`
              : ""}
            {usuario.dadoDeBajaPor ? ` por ${usuario.dadoDeBajaPor}` : ""}, a
            pedido suyo
            {usuario.bajaPedidaEn
              ? ` del ${shortDate(usuario.bajaPedidaEn)}`
              : ""}
            .
          </p>
        ) : (
          <p className="text-body-sm text-ink">
            Pidió la baja de su cuenta
            {usuario.bajaPedidaEn
              ? ` el ${dateWithTime(usuario.bajaPedidaEn)}`
              : ""}
            .
          </p>
        )}

        {/* Un CHECK garantiza el motivo si hay baja (RF-34). */}
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

const MOVIMIENTOS: Record<MovimientoDeEstado["evento"], string> = {
  bloqueo: "Bloqueada",
  desbloqueo: "Desbloqueada",
  baja: "Dada de baja",
  reversion_de_baja: "Baja revertida",
};

/**
 * Quién y cuándo, como pide §13.5. Es lo único que queda de una baja
 * revertida, que borra el pedido y su motivo.
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
              <time dateTime={m.fecha}>{dateWithTime(m.fecha)}</time>
              {/* `actor_user_id` es SET NULL: si se borró esa cuenta, no hay
                  autor. */}
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

/** Las últimas cinco y un enlace al listado (RF-26). */
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
            {/* Al listado, buscando por su email. */}
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
                  {shortDate(orden.creadaEn)}
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
