"use client";

import {
  ArrowLeftRight,
  ChevronsLeft,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PanelsTopLeft,
  Scale,
  Settings,
  ShoppingBag,
  Store,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { ThemeToggle } from "@/components/admin/theme";
import { IsotipoSegunTema } from "@/components/shop/logo";
import { Avatar } from "@/components/ui/avatar";
import { crearPreferencia } from "@/lib/preferencia-local";
import { cn } from "@/lib/utils";
import { salir } from "@/modules/users/actions";

/**
 * Menú lateral del panel — DESIGN-REFERENCE §5.2.
 *
 * 240px con etiquetas visibles, colapsable a 64px de solo íconos. En tablet
 * arranca colapsado; en móvil es un panel deslizable, porque un menú fijo se
 * come la mitad de una pantalla en la que hay que leer tablas.
 *
 * El interruptor de modo oscuro vive al pie del menú. Debajo, aparte, quién
 * está adentro, con «Cerrar sesión»: el panel no tiene otro lugar desde
 * donde salir.
 */

type Seccion = {
  href: string;
  etiqueta: string;
  Icono: typeof LayoutDashboard;
  exacto?: boolean;
  /** Si está, la sección todavía no existe: se ve apagada y se dice por qué. */
  pendiente?: string;
};

const SECCIONES: Seccion[] = [
  { href: "/admin", etiqueta: "Inicio", Icono: LayoutDashboard, exacto: true },
  { href: "/admin/productos", etiqueta: "Productos", Icono: Package },
  { href: "/admin/ordenes", etiqueta: "Órdenes", Icono: ShoppingBag },
  {
    href: "/admin/devoluciones",
    etiqueta: "Devoluciones",
    Icono: ArrowLeftRight,
  },
  { href: "/admin/catalogo", etiqueta: "Catálogo", Icono: PanelsTopLeft },
  { href: "/admin/usuarios", etiqueta: "Usuarios", Icono: Users },
  { href: "/admin/reportes", etiqueta: "Reportes", Icono: FileText },
  { href: "/admin/legales", etiqueta: "Legales", Icono: Scale },
  { href: "/admin/configuracion", etiqueta: "Configuración", Icono: Settings },
];

const preferenciaDeColapso = crearPreferencia("anavende:admin-menu");

export function AdminSidebar({
  nombre,
  cara,
}: {
  nombre: string;
  /** La foto o el blobatar (F5.9), ya resuelto en el servidor. */
  cara: string;
}) {
  const pathname = usePathname();
  const colapsado = useSyncExternalStore(
    preferenciaDeColapso.suscribir,
    () => {
      const guardado = preferenciaDeColapso.leer();
      // Sin nada guardado, en tablet arranca colapsado (§5.2).
      return guardado !== null
        ? guardado === "1"
        : window.matchMedia("(max-width: 1279px)").matches;
    },
    () => false,
  );
  const [abiertoEnMovil, setAbiertoEnMovil] = useState(false);
  const [saliendo, iniciarSalida] = useTransition();

  // Al navegar se cierra el panel de móvil: si no, tapa lo que se acaba de
  // abrir. Se ajusta durante el render, cuando cambia la ruta, y no en un
  // efecto: así no se pinta un cuadro con el panel abierto sobre la página
  // nueva.
  const [rutaVista, setRutaVista] = useState(pathname);
  if (rutaVista !== pathname) {
    setRutaVista(pathname);
    setAbiertoEnMovil(false);
  }

  // El foco entra al abrirlo y vuelve a «Abrir el menú» al cerrarlo, como
  // en un diálogo (F10.3): si no, quien usa teclado sigue parado detrás de
  // la capa, en lo que acaba de quedar tapado.
  const botonAbrir = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const cerrarMenu = () => {
    setAbiertoEnMovil(false);
    botonAbrir.current?.focus();
  };

  // Escape cierra el panel de móvil, como cualquier capa superpuesta.
  useEffect(() => {
    if (!abiertoEnMovil) return;
    botonCerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAbiertoEnMovil(false);
      botonAbrir.current?.focus();
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abiertoEnMovil]);

  const alternarColapso = () => {
    preferenciaDeColapso.escribir(colapsado ? "0" : "1");
  };

  return (
    <>
      {/* Barra de móvil: el menú se abre desde acá. */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <button
          ref={botonAbrir}
          type="button"
          onClick={() => setAbiertoEnMovil(true)}
          className="grid size-11 place-items-center rounded-panel-control text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink"
        >
          <Menu aria-hidden className="size-5" />
          <span className="sr-only">Abrir el menú</span>
        </button>
        <span className="text-body-sm font-medium text-ink">Panel</span>
      </div>

      {abiertoEnMovil && (
        <button
          type="button"
          aria-label="Cerrar el menú"
          onClick={cerrarMenu}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      <aside
        aria-label="Secciones del panel"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface",
          "transition-[width,transform] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]",
          colapsado ? "w-16" : "w-60",
          // Móvil: entra deslizándose y siempre con las etiquetas visibles.
          // Cerrado, además de correrse queda invisible: fuera de la pantalla
          // sus enlaces seguían tomando el foco, y el Tab pasaba por quince
          // paradas que no se ven antes de llegar a la página (F10.3).
          abiertoEnMovil
            ? "w-60 translate-x-0"
            : // La visibilidad solo se anima al cerrar, para que se oculte
              // al terminar de salir. Al abrir cambia de golpe: en el primer
              // cuadro de una transición todavía está oculto, y ahí el foco
              // no entra.
              "-translate-x-full max-lg:invisible max-lg:transition-[width,transform,visibility]",
          "lg:translate-x-0",
        )}
      >
        <div
          className={cn(
            "flex h-14 shrink-0 items-center gap-2.5 px-3",
            colapsado && !abiertoEnMovil && "justify-center px-0",
          )}
        >
          <Link
            href="/admin"
            className="inline-flex h-8 max-md:h-11 items-center gap-2.5 rounded-panel-control"
            aria-label="AnaVende, inicio del panel"
          >
            <IsotipoSegunTema />
            {(!colapsado || abiertoEnMovil) && (
              <span aria-hidden className="text-body font-medium text-ink">
                AnaVende
              </span>
            )}
          </Link>

          <button
            ref={botonCerrar}
            type="button"
            onClick={cerrarMenu}
            className="ml-auto grid size-9 max-md:size-11 place-items-center rounded-panel-control text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink lg:hidden"
          >
            <X aria-hidden className="size-5" />
            <span className="sr-only">Cerrar el menú</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-0.5">
            {SECCIONES.map(({ href, etiqueta, Icono, exacto, pendiente }) => {
              const activa = exacto
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              const soloIcono = colapsado && !abiertoEnMovil;

              // Sin pantalla a la que ir no hay enlace: un `<span>` apagado,
              // con el motivo en el `title` y leído por `aria-disabled`. Es el
              // mismo criterio que los controles apagados del panel (§8): se
              // ve que está, y se dice por qué todavía no.
              if (pendiente) {
                return (
                  <li key={href}>
                    <span
                      aria-disabled
                      title={
                        soloIcono ? `${etiqueta} — ${pendiente}` : pendiente
                      }
                      className={cn(
                        "flex h-10 max-md:h-11 items-center gap-3 rounded-panel-control px-2.5",
                        "text-body-sm text-ink-tertiary",
                        soloIcono && "justify-center px-0",
                      )}
                    >
                      <Icono aria-hidden className="size-4 shrink-0" />
                      {!soloIcono && (
                        <span className="truncate">{etiqueta}</span>
                      )}
                    </span>
                  </li>
                );
              }

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={activa ? "page" : undefined}
                    title={soloIcono ? etiqueta : undefined}
                    className={cn(
                      "flex h-10 max-md:h-11 items-center gap-3 rounded-panel-control px-2.5",
                      "text-body-sm transition-colors duration-150",
                      soloIcono && "justify-center px-0",
                      activa
                        ? // El estado activo lleva fondo Y color de marca: no se
                          // comunica solo con color (§9).
                          "bg-brand-tint font-medium text-brand"
                        : "text-ink-secondary hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    <Icono aria-hidden className="size-4 shrink-0" />
                    {!soloIcono && <span className="truncate">{etiqueta}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-1 border-t border-border p-2">
          <ThemeToggle soloIcono={colapsado && !abiertoEnMovil} />

          <Link
            href="/"
            className={cn(
              "flex h-9 max-md:h-11 items-center gap-2 rounded-panel-control px-2.5",
              "text-body-sm text-ink-secondary transition-colors duration-150",
              "hover:bg-surface-sunken hover:text-ink",
              colapsado && !abiertoEnMovil && "justify-center px-0",
            )}
            title={colapsado && !abiertoEnMovil ? "Ver la tienda" : undefined}
          >
            <Store aria-hidden className="size-4 shrink-0" />
            {(!colapsado || abiertoEnMovil) && (
              <span className="truncate">Ver la tienda</span>
            )}
          </Link>

          <button
            type="button"
            onClick={alternarColapso}
            aria-expanded={!colapsado}
            className={cn(
              "hidden h-9 items-center gap-2 rounded-panel-control px-2.5 lg:flex",
              "text-body-sm text-ink-secondary transition-colors duration-150",
              "hover:bg-surface-sunken hover:text-ink",
              colapsado && "justify-center px-0",
            )}
          >
            <ChevronsLeft
              aria-hidden
              className={cn(
                "size-4 shrink-0 transition-transform duration-200",
                colapsado && "rotate-180",
              )}
            />
            {/* Una sola etiqueta a la vez: con las dos, el lector de
                pantalla decía «Contraer el menú» dos veces. */}
            {colapsado ? (
              <span className="sr-only">Expandir el menú</span>
            ) : (
              <span className="truncate">Contraer el menú</span>
            )}
          </button>
        </div>

        {/* Quién está adentro, aparte de las acciones del menú: con el nombre
            en un renglón más, entre botones, se leía como uno que no hacía
            nada. El rol en la segunda línea lo termina de separar, y
            «Cerrar sesión» va pegado al nombre porque es de la cuenta y no
            del panel. Colapsado, el ícono de salir baja debajo del avatar. */}
        <div
          className={cn(
            "flex items-center gap-2.5 border-t border-border px-3 py-3",
            colapsado && !abiertoEnMovil && "flex-col gap-2 px-0",
          )}
        >
          {/* Hasta F5.9 era la inicial en bordó; ahora es la misma cara que
              en la tienda. */}
          <Avatar src={cara} tamano={32} />
          {(!colapsado || abiertoEnMovil) && (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-body-sm font-medium text-ink">
                {nombre}
              </span>
              {/* Todo el que entra al panel es administrador: el layout
                  rechaza al resto (`exigirAdmin`). */}
              <span className="truncate text-caption text-ink-secondary">
                Administradora
              </span>
            </span>
          )}

          {/* La misma acción que «Mi cuenta»: cierra la sesión y lleva a la
              tienda. Apagado mientras sale, para que un segundo toque no
              mande otra. Solo ícono, con el nombre en el `title` y para el
              lector de pantalla. */}
          <button
            type="button"
            onClick={() => iniciarSalida(() => salir())}
            disabled={saliendo}
            aria-busy={saliendo || undefined}
            title="Cerrar sesión"
            className="grid size-9 max-md:size-11 shrink-0 place-items-center rounded-panel-control text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink disabled:opacity-60"
          >
            <LogOut aria-hidden className="size-4" />
            <span className="sr-only">
              {saliendo ? "Cerrando sesión" : "Cerrar sesión"}
            </span>
          </button>
        </div>
      </aside>

      {/* Reserva el ancho del menú fijo en escritorio. */}
      <div
        aria-hidden
        className={cn(
          "hidden shrink-0 transition-[width] duration-200 lg:block",
          colapsado ? "w-16" : "w-60",
        )}
      />
    </>
  );
}
