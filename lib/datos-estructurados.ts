import { NOMBRE_DEL_SITIO, urlAbsoluta, resumenDeMetadatos } from "@/lib/seo";
import { urlDeCategoria } from "@/modules/catalog/products/filtros-tienda";
import type { Ficha } from "@/modules/catalog/products/ficha";

// JSON-LD (RNF-04). La descripción va en texto plano (`descripcionTexto`), no
// en Markdown.

export type Jsonld = Record<string, unknown>;

const SCHEMA = "https://schema.org";

/**
 * `Organization` y no `Store` ni `LocalBusiness`: piden dirección y horario, y
 * no hay local.
 */
export function organizacion(): Jsonld {
  return {
    "@context": SCHEMA,
    "@type": "Organization",
    name: NOMBRE_DEL_SITIO,
    url: urlAbsoluta("/"),
    logo: urlAbsoluta("/marca/logo.png"),
    areaServed: [
      { "@type": "City", name: "Viedma" },
      { "@type": "City", name: "Carmen de Patagones" },
    ],
  };
}

/** Si cambia el parámetro `q`, cambia acá y en `filtros-tienda.ts`. */
export function sitio(): Jsonld {
  return {
    "@context": SCHEMA,
    "@type": "WebSite",
    name: NOMBRE_DEL_SITIO,
    url: urlAbsoluta("/"),
    inLanguage: "es-AR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: urlAbsoluta("/productos?q={search_term_string}"),
      },
      // El guion es del vocabulario de schema.org.
      "query-input": "required name=search_term_string",
    },
  };
}

/** El mismo camino que la miga de la pantalla: Google pide que coincidan. */
export function migas(ficha: Ficha): Jsonld {
  return rastro([
    { nombre: "Productos", ruta: "/productos" },
    { nombre: ficha.categoria, ruta: urlDeCategoria(ficha.categoriaSlug) },
    { nombre: ficha.nombre, ruta: `/productos/${ficha.slug}` },
  ]);
}

export function migasDeCategoria(categoria: {
  slug: string;
  nombre: string;
}): Jsonld {
  return rastro([
    { nombre: "Categorías", ruta: "/categorias" },
    { nombre: categoria.nombre, ruta: urlDeCategoria(categoria.slug) },
  ]);
}

function rastro(pasos: { nombre: string; ruta: string }[]): Jsonld {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: pasos.map((paso, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: paso.nombre,
      item: urlAbsoluta(paso.ruta),
    })),
  };
}

/**
 * Un solo `Offer`: el precio es del producto, no de la variante. El
 * disponible puede ser negativo (RF-24), por eso `> 0`.
 */
export function producto(ficha: Ficha, imagenes: readonly string[]): Jsonld {
  const disponible = ficha.variantes.reduce((t, v) => t + v.disponible, 0) > 0;
  const descripcion = resumenDeMetadatos(ficha.descripcionTexto, 400);

  return {
    "@context": SCHEMA,
    "@type": "Product",
    name: ficha.nombre,
    ...(descripcion ? { description: descripcion } : {}),
    ...(imagenes.length > 0 ? { image: [...imagenes] } : {}),
    brand: { "@type": "Brand", name: ficha.marca },
    ...(ficha.sku ? { sku: ficha.sku } : {}),
    category: ficha.categoria,
    offers: {
      "@type": "Offer",
      url: urlAbsoluta(`/productos/${ficha.slug}`),
      priceCurrency: "ARS",
      // El string de `numeric(12,2)` tal cual: convertirlo a `number` lo
      // rompería (§7.1).
      price: ficha.precioFinal,
      availability: `${SCHEMA}/${disponible ? "InStock" : "OutOfStock"}`,
      itemCondition: `${SCHEMA}/NewCondition`,
      seller: { "@type": "Organization", name: NOMBRE_DEL_SITIO },
    },
  };
}

/**
 * Escapa `<` a propósito (§16): un `</script>` en una descripción cerraría la
 * etiqueta y lo que sigue sería HTML. No sacarlo.
 */
export function aJson(datos: Jsonld | Jsonld[]): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}
