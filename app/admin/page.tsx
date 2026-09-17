import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { contarBajasPendientes } from "@/modules/users/baja/operaciones";

export const metadata: Metadata = { title: "Panel" };

/**
 * Inicio del panel.
 *
 * El dashboard es F7.8 (RF-14). Desde el 2026-09-14 también tiene que decir
 * **qué hay pendiente al entrar**: bajas pedidas, órdenes por atender, stock
 * bajo. Sin notificaciones que se disparen, se ve al abrir el panel.
 *
 * Por ahora está lo único que ya existe para contar: **las bajas pedidas**
 * (F5.8), y desde F7.9 el enlace lleva a donde se atienden: el listado de
 * usuarios filtrado por «Con baja pedida».
 */
export default async function PanelInicio() {
  const bajas = await contarBajasPendientes();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-ink">Panel</h1>
        <p className="text-body-sm text-ink-secondary">
          Elegí una sección del menú para empezar.
        </p>
      </div>

      <section
        aria-labelledby="pendientes"
        className="flex max-w-xl flex-col gap-3 rounded-panel-card border border-border bg-surface p-5"
      >
        <h2 id="pendientes" className="text-body-lg font-medium text-ink">
          Pendientes
        </h2>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-body-sm text-ink">
            {bajas === 0
              ? "No hay bajas de cuenta pedidas."
              : bajas === 1
                ? "1 comprador pidió la baja de su cuenta."
                : `${bajas} compradores pidieron la baja de su cuenta.`}
          </p>
          {bajas > 0 ? (
            <Button asChild variant="secondary" size="sm">
              <Link href="/admin/usuarios?estado=baja-pedida">
                Ver en Usuarios
              </Link>
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
