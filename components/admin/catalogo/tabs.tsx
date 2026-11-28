"use client";

import { usePathname } from "next/navigation";

import { SolapasDelPanel } from "@/components/admin/solapas";

/**
 * Navegación entre marcas, categorías, colores y medios de pago: solapas
 * subrayadas y sin número (DR §6.9). Son rutas, no pestañas de cliente.
 */
const SOLAPAS = [
  { href: "/admin/catalogo/marcas", etiqueta: "Marcas" },
  { href: "/admin/catalogo/categorias", etiqueta: "Categorías" },
  { href: "/admin/catalogo/colores", etiqueta: "Colores" },
  // Los medios de pago no son catálogo, pero comparten pantalla: una sección
  // propia en el menú para cuatro filas sería de más.
  { href: "/admin/catalogo/medios-de-pago", etiqueta: "Medios de pago" },
];

export function SolapasDeCatalogo() {
  const pathname = usePathname();

  return (
    <SolapasDelPanel
      etiqueta="Secciones del catálogo"
      variante="subrayado"
      solapas={SOLAPAS.map((s) => ({ ...s, activa: pathname === s.href }))}
    />
  );
}
