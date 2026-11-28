import { SITE_NAME, absoluteUrl, metaDescription } from "@/lib/seo";
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
export function organizationJsonLd(): Jsonld {
  return {
    "@context": SCHEMA,
    "@type": "Organization",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/marca/logo.png"),
    areaServed: [
      { "@type": "City", name: "Viedma" },
      { "@type": "City", name: "Carmen de Patagones" },
    ],
  };
}

/** Si cambia el parámetro `q`, cambia acá y en `filtros-tienda.ts`. */
export function websiteJsonLd(): Jsonld {
  return {
    "@context": SCHEMA,
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    inLanguage: "es-AR",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: absoluteUrl("/productos?q={search_term_string}"),
      },
      // El guion es del vocabulario de schema.org.
      "query-input": "required name=search_term_string",
    },
  };
}

/** El mismo camino que la miga de la pantalla: Google pide que coincidan. */
export function breadcrumbsJsonLd(productDetail: Ficha): Jsonld {
  return breadcrumbList([
    { name: "Productos", path: "/productos" },
    {
      name: productDetail.categoria,
      path: urlDeCategoria(productDetail.categoriaSlug),
    },
    { name: productDetail.nombre, path: `/productos/${productDetail.slug}` },
  ]);
}

export function categoryBreadcrumbsJsonLd(category: {
  slug: string;
  nombre: string;
}): Jsonld {
  return breadcrumbList([
    { name: "Categorías", path: "/categorias" },
    { name: category.nombre, path: urlDeCategoria(category.slug) },
  ]);
}

function breadcrumbList(steps: { name: string; path: string }[]): Jsonld {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: steps.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

/**
 * Un solo `Offer`: el precio es del producto, no de la variante. El
 * disponible puede ser negativo (RF-24), por eso `> 0`.
 */
export function productJsonLd(
  productDetail: Ficha,
  images: readonly string[],
): Jsonld {
  const available =
    productDetail.variantes.reduce((t, v) => t + v.disponible, 0) > 0;
  const description = metaDescription(productDetail.descripcionTexto, 400);

  return {
    "@context": SCHEMA,
    "@type": "Product",
    name: productDetail.nombre,
    ...(description ? { description: description } : {}),
    ...(images.length > 0 ? { image: [...images] } : {}),
    brand: { "@type": "Brand", name: productDetail.marca },
    ...(productDetail.sku ? { sku: productDetail.sku } : {}),
    category: productDetail.categoria,
    offers: {
      "@type": "Offer",
      url: absoluteUrl(`/productos/${productDetail.slug}`),
      priceCurrency: "ARS",
      // El string de `numeric(12,2)` tal cual: convertirlo a `number` lo
      // rompería (§7.1).
      price: productDetail.precioFinal,
      availability: `${SCHEMA}/${available ? "InStock" : "OutOfStock"}`,
      itemCondition: `${SCHEMA}/NewCondition`,
      seller: { "@type": "Organization", name: SITE_NAME },
    },
  };
}

/**
 * Escapa `<` a propósito (§16): un `</script>` en una descripción cerraría la
 * etiqueta y lo que sigue sería HTML. No sacarlo.
 */
export function serializeJsonLd(data: Jsonld | Jsonld[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
