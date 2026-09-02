import type { Metadata } from "next";

export const metadata: Metadata = { title: "Panel" };

/**
 * Dashboard del panel (RF-14) — lo construye F7.8, con órdenes activas,
 * ventas del mes y stock bajo. Hasta entonces el layout ya se puede recorrer.
 */
export default function PanelInicio() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-title text-ink">Panel</h1>
      <p className="text-body-sm text-ink-secondary">
        Elegí una sección del menú para empezar.
      </p>
    </div>
  );
}
