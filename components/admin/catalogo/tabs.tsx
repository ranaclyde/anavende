"use client";

import { usePathname } from "next/navigation";

import { SolapasDelPanel } from "@/components/admin/solapas";

/**
 * Navegación entre marcas, categorías, colores y medios de pago — RF-18,
 * RF-19.
 *
 * **Subrayado y sin número** (§6.9): acá cada solapa es otra tabla, así que no
 * hay un total que contestar, y lo que cambia no es qué se ve del mismo
 * listado sino en qué pantalla se está.
 *
 * Son rutas y no pestañas de cliente: cada listado tiene su dirección, el
 * botón atrás funciona y cada uno se puede compartir. Lo único que hace falta
 * del cliente es saber cuál está abierta.
 */
const SOLAPAS = [
  { href: "/admin/catalogo/marcas", etiqueta: "Marcas" },
  { href: "/admin/catalogo/categorias", etiqueta: "Categorías" },
  { href: "/admin/catalogo/colores", etiqueta: "Colores" },
  // Los medios de pago no son catálogo de productos, pero comparten pantalla
  // con él (§4): son las tablas que la vendedora carga una vez y toca cada
  // tanto. Una sección propia en el menú lateral para cuatro filas sería un
  // renglón más para leer en cada visita.
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
