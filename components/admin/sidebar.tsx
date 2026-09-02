"use client";

import {
  ArrowLeftRight,
  ChevronsLeft,
  FileText,
  LayoutDashboard,
  Menu,
  Package,
  PanelsTopLeft,
  Settings,
  ShoppingBag,
  Store,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/admin/theme";
import { cn } from "@/lib/utils";

/**
 * Menú lateral del panel — DESIGN-REFERENCE §5.2.
 *
 * 240px con etiquetas visibles, colapsable a 64px de solo íconos. En tablet
 * arranca colapsado; en móvil es un panel deslizable, porque un menú fijo se
 * come la mitad de una pantalla en la que hay que leer tablas.
 *
 * El interruptor de modo oscuro vive al pie del menú.
 */

const SECCIONES = [
  { href: "/admin", etiqueta: "Inicio", Icono: LayoutDashboard, exacto: true },
  { href: "/admin/productos", etiqueta: "Productos", Icono: Package },
  { href: "/admin/ordenes", etiqueta: "Órdenes", Icono: ShoppingBag },
  { href: "/admin/devoluciones", etiqueta: "Devoluciones", Icono: ArrowLeftRight },
  { href: "/admin/catalogo", etiqueta: "Catálogo", Icono: PanelsTopLeft },
  { href: "/admin/usuarios", etiqueta: "Usuarios", Icono: Users },
  { href: "/admin/reportes", etiqueta: "Reportes", Icono: FileText },
  { href: "/admin/configuracion", etiqueta: "Configuración", Icono: Settings },
];

const CLAVE_COLAPSO = "anavende:admin-menu";

export function AdminSidebar({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const [colapsado, setColapsado] = useState(false);
  const [abiertoEnMovil, setAbiertoEnMovil] = useState(false);

  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = localStorage.getItem(CLAVE_COLAPSO);
    } catch {
      // Sin almacenamiento: arranca según el ancho de pantalla.
    }
    // En tablet arranca colapsado (§5.2).
    setColapsado(
      guardado !== null
        ? guardado === "1"
        : window.matchMedia("(max-width: 1279px)").matches,
    );
  }, []);

  // Al navegar se cierra el panel de móvil: si no, tapa lo que se acaba de abrir.
  useEffect(() => setAbiertoEnMovil(false), [pathname]);

  // Escape cierra el panel de móvil, como cualquier capa superpuesta.
  useEffect(() => {
    if (!abiertoEnMovil) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbiertoEnMovil(false);
    };
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, [abiertoEnMovil]);

  const alternarColapso = () => {
    const nuevo = !colapsado;
    setColapsado(nuevo);
    try {
      localStorage.setItem(CLAVE_COLAPSO, nuevo ? "1" : "0");
    } catch {
      // Vale para esta sesión.
    }
  };

  return (
    <>
      {/* Barra de móvil: el menú se abre desde acá. */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-surface px-4 lg:hidden">
        <button
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
          onClick={() => setAbiertoEnMovil(false)}
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
          abiertoEnMovil ? "w-60 translate-x-0" : "-translate-x-full",
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
            className="inline-flex items-center gap-2.5 rounded-panel-control"
            aria-label="AnaVende, inicio del panel"
          >
            <span
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-brand text-caption font-semibold text-ink-inverse"
            >
              AV
            </span>
            {(!colapsado || abiertoEnMovil) && (
              <span aria-hidden className="text-body font-medium text-ink">
                AnaVende
              </span>
            )}
          </Link>

          <button
            type="button"
            onClick={() => setAbiertoEnMovil(false)}
            className="ml-auto grid size-9 place-items-center rounded-panel-control text-ink-secondary transition-colors duration-150 hover:bg-surface-sunken hover:text-ink lg:hidden"
          >
            <X aria-hidden className="size-5" />
            <span className="sr-only">Cerrar el menú</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-0.5">
            {SECCIONES.map(({ href, etiqueta, Icono, exacto }) => {
              const activa = exacto
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`);
              const soloIcono = colapsado && !abiertoEnMovil;

              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={activa ? "page" : undefined}
                    title={soloIcono ? etiqueta : undefined}
                    className={cn(
                      "flex h-10 items-center gap-3 rounded-panel-control px-2.5",
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
              "flex h-9 items-center gap-2 rounded-panel-control px-2.5",
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

          <div
            className={cn(
              "mt-1 flex items-center gap-2 px-2.5 py-2",
              colapsado && !abiertoEnMovil && "justify-center px-0",
            )}
          >
            <span
              aria-hidden
              className="grid size-7 shrink-0 place-items-center rounded-pill bg-surface-sunken text-caption font-medium text-ink-secondary"
            >
              {nombre.slice(0, 1).toUpperCase()}
            </span>
            {(!colapsado || abiertoEnMovil) && (
              <span className="truncate text-body-sm text-ink">{nombre}</span>
            )}
          </div>

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
            {!colapsado && <span className="truncate">Contraer el menú</span>}
            <span className="sr-only">
              {colapsado ? "Expandir el menú" : "Contraer el menú"}
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
