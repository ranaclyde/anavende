import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { EstadoDeLaOrden } from "@/components/admin/ordenes/estado";
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
 * Ficha de un usuario — FS RF-26. Tarea F7.6.
 *
 * Es la hoja de trabajo de una cuenta: los datos que se corrigen, el rol que
 * se cambia, el email de contraseña nueva que se dispara, y **sus órdenes**,
 * que es lo que contesta quién es esta persona para la tienda.
 *
 * **Lo que todavía no está, no está apagado: no está.** Bloquear es RF-27
 * (F7.7) y ejecutar una baja es RF-34 (F7.9); acá el estado **se ve** —con su
 * motivo y su fecha— porque enterarse de que una cuenta está bloqueada es
 * parte de entenderla, pero no hay botones que no hagan nada.
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
      <div>
        <Button asChild variant="tertiary" size="sm" className="-ml-3">
          <Link href="/admin/usuarios">
            <ChevronLeft aria-hidden />
            Usuarios
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-title text-ink">{usuario.nombre}</h1>
          <RolDelUsuario rol={usuario.rol} />
          <EstadoDelUsuario
            bloqueado={usuario.bloqueado}
            bajaPedida={usuario.bajaPedida}
          />
          {esMiCuenta ? (
            <span className="text-caption text-ink-tertiary">(sos vos)</span>
          ) : null}
        </div>

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
      </div>

      <p className="text-body-sm text-ink-secondary">
        {usuario.email} · cuenta creada el {fechaCorta(usuario.creadoEn)}
      </p>

      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Datos">
            <EditarDatosDelUsuario usuario={usuario} />
          </Tarjeta>

          <SusOrdenes usuario={usuario} />
        </div>

        <div className="flex flex-col gap-4">
          <Tarjeta titulo="Rol">
            <RolDelUsuarioEditable
              id={usuario.id}
              rolActual={usuario.rol as RolAsignable}
              nombre={usuario.firstName}
              esMiCuenta={esMiCuenta}
              esLaUnicaAdministradora={
                usuario.rol === "admin" && administradoras <= 1
              }
            />
          </Tarjeta>

          {usuario.bloqueado || usuario.bajaPedida ? (
            <Tarjeta titulo="Estado de la cuenta">
              {usuario.bloqueado ? (
                <div className="flex flex-col gap-1">
                  <p className="text-body-sm text-ink">
                    Bloqueada
                    {usuario.bloqueadoEn
                      ? ` el ${fechaConHora(usuario.bloqueadoEn)}`
                      : ""}
                    {usuario.bloqueadoPor ? ` por ${usuario.bloqueadoPor}` : ""}
                    .
                  </p>
                  {/* RF-27: el motivo es obligatorio y lo garantiza un CHECK,
                      así que si hay bloqueo hay motivo. */}
                  <p className="text-body-sm text-ink-secondary">
                    <span className="text-ink-tertiary">Motivo: </span>
                    {usuario.motivoDelBloqueo}
                  </p>
                  <p className="text-caption text-ink-tertiary">
                    No puede entrar, y eso es lo que ve al intentarlo.
                  </p>
                </div>
              ) : null}

              {usuario.bajaPedida ? (
                <div className="flex flex-col gap-1">
                  <p className="text-body-sm text-ink">
                    Pidió la baja de su cuenta
                    {usuario.bajaPedidaEn
                      ? ` el ${fechaConHora(usuario.bajaPedidaEn)}`
                      : ""}
                    .
                  </p>
                  <p className="text-body-sm text-ink-secondary">
                    <span className="text-ink-tertiary">Motivo: </span>
                    {usuario.motivoDeLaBaja}
                  </p>
                  <p className="text-caption text-ink-tertiary">
                    Mientras tanto su cuenta es de solo lectura: puede entrar y
                    mirar, no comprar.
                  </p>
                </div>
              ) : null}
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </div>
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
      <Tarjeta titulo="Sus órdenes">
        <p className="text-body-sm text-ink-secondary">
          Todavía no compró nada por la tienda. Si le vendiste por WhatsApp,
          podés cargar esa venta como orden manual y asociársela.
        </p>
      </Tarjeta>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-body-sm font-medium text-ink">
          Sus órdenes{" "}
          <span className="text-caption text-ink-secondary">
            ({usuario.ordenes})
          </span>
        </h2>
        {usuario.ordenes > usuario.ultimasOrdenes.length ? (
          <Button asChild variant="tertiary" size="sm" className="-mr-2">
            {/* Al listado de órdenes, buscando por su email: es la búsqueda
                que RF-21 ya tiene, y así se llega con solapas y filtros. */}
            <Link
              href={`/admin/ordenes?estado=todas&q=${encodeURIComponent(usuario.email)}`}
            >
              Ver todas
            </Link>
          </Button>
        ) : null}
      </div>

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
              <span className="text-caption text-ink-tertiary tabular-nums">
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
    </section>
  );
}

function Tarjeta({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4">
      <h2 className="text-body-sm font-medium text-ink">{titulo}</h2>
      {children}
    </section>
  );
}
