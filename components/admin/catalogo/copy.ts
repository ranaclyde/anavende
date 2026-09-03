import type { TipoDeItem } from "@/modules/catalog/schemas";

/**
 * Las palabras de cada listado, en un solo lugar — DESIGN-REFERENCE §10.
 *
 * Marcas, categorías y colores comparten la pantalla entera y se diferencian
 * solo en cómo se los nombra. Con las tres formas juntas es imposible que una
 * quede en masculino y otra en femenino, que es lo que pasa cuando cada
 * cartel se escribe donde se usa.
 *
 * Los mensajes de ERROR no están acá: los redacta el servidor
 * (`lib/errors.ts`), porque son la regla de negocio hablando.
 */
export type PalabrasDeItem = {
  singular: string;
  plural: string;
  nuevo: string;
  vacio: string;
  /** Qué se pierde de vista al desactivarlo. */
  desactivar: string;
  /**
   * Concordancia. «Color» es masculino y las otras dos son femeninas: sin
   * estas formas la pantalla termina diciendo «esta color está activa».
   */
  activo: string;
  inactivo: string;
  demostrativo: string;
  /** Objeto directo: «borrar**la**» / «borrar**lo**». */
  pronombre: string;
};

export const PALABRAS: Record<TipoDeItem, PalabrasDeItem> = {
  marca: {
    singular: "marca",
    plural: "marcas",
    nuevo: "Nueva marca",
    vacio: "Todavía no cargaste ninguna marca.",
    desactivar:
      "Va a dejar de ofrecerse al cargar productos y de aparecer en los filtros de la tienda.",
    activo: "Activa",
    inactivo: "Inactiva",
    demostrativo: "esta",
    pronombre: "la",
  },
  categoria: {
    singular: "categoría",
    plural: "categorías",
    nuevo: "Nueva categoría",
    vacio: "Todavía no cargaste ninguna categoría.",
    desactivar:
      "Va a dejar de ofrecerse al cargar productos y de aparecer en el menú de la tienda.",
    activo: "Activa",
    inactivo: "Inactiva",
    demostrativo: "esta",
    pronombre: "la",
  },
  color: {
    singular: "color",
    plural: "colores",
    nuevo: "Nuevo color",
    vacio: "Todavía no cargaste ningún color.",
    desactivar: "Va a dejar de ofrecerse al agregar variantes a un producto.",
    activo: "Activo",
    inactivo: "Inactivo",
    demostrativo: "este",
    pronombre: "lo",
  },
};

/**
 * Destacar — RF-18. Sólo las categorías se destacan, así que sus palabras no
 * entran en `PALABRAS`: un campo que es `null` para dos de los tres tipos
 * invita a olvidarse de comprobarlo.
 */
export const DESTACADO = {
  etiqueta: "Destacada",
  /** Qué hace, dicho antes de hacerlo. */
  ayuda:
    "Aparece primero en el menú de la tienda, en la portada y en los filtros. Si destacás todas, ninguna se adelanta.",
  destacar: "Destacar",
  quitar: "Quitar de destacadas",
} as const;
