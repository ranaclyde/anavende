import { NOMBRE_DEL_SITIO, urlAbsoluta, resumenDeMetadatos } from "@/lib/seo";
import { urlDeTienda } from "@/modules/catalog/products/filtros-tienda";
import type { Ficha } from "@/modules/catalog/products/ficha";

/**
 * Datos estructurados (JSON-LD) — F3.9, RNF-04.
 *
 * Es lo que hace que un resultado de Google muestre el precio y la
 * disponibilidad abajo del título, en vez de tres renglones de texto. **No
 * cambia nada de lo que se ve en la pantalla**: es información paralela, para
 * quien lee el HTML sin ojos.
 *
 * Están acá y no adentro de cada página por una razón que ya se pagó en este
 * proyecto: lo que se escribe suelto en la pantalla se copia, y dos copias de
 * lo mismo divergen. Acá además se pueden probar sin abrir un navegador, que
 * es la única forma de verificarlos —un JSON-LD mal armado no rompe nada, no
 * se ve, y simplemente no sirve.
 *
 * **Todo lo que sale de la base va como texto plano.** La descripción es
 * Markdown escrito por la vendedora, así que se usa `descripcionTexto`, la
 * columna generada de §5.4: la misma que ya usa la búsqueda.
 */

/** Lo que React necesita para pintarlo: un objeto cualquiera, serializable. */
export type Jsonld = Record<string, unknown>;

const SCHEMA = "https://schema.org";

/**
 * Quién vende — va en la home.
 *
 * `Organization` y no `Store` ni `LocalBusiness`, que son los tipos que
 * parecen más precisos: los dos piden dirección postal y horario de atención,
 * y acá no hay local. Declarar un tipo y después no cumplir sus campos es
 * peor que declarar el general y cumplirlo entero.
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

/**
 * El sitio y su buscador — también en la home.
 *
 * El `SearchAction` es lo que le permite a Google ofrecer la caja de búsqueda
 * del sitio adentro del resultado. Apunta a `/productos?q=`, que es la
 * búsqueda de verdad (F3.4): si algún día cambia el nombre del parámetro,
 * cambia acá y en `filtros-tienda.ts`, y el test lo señala.
 */
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
      // El guion del medio es del vocabulario de schema.org, no un descuido.
      "query-input": "required name=search_term_string",
    },
  };
}

/**
 * El rastro de migas de una ficha — el MISMO que se ve arriba del producto.
 *
 * Google pide que el dato estructurado refleje el camino que ve la persona, y
 * el de la ficha es «Catálogo › Categoría» (`Migas`, en la propia pantalla).
 * Escribir acá un camino distinto —uno que pase por «Inicio», por ejemplo—
 * sería declarar una navegación que el sitio no tiene.
 *
 * El último escalón es el producto, que en la pantalla es el `h1` y no un
 * enlace: acá va igual, porque la lista tiene que terminar en la página
 * donde está parada.
 *
 * **La categoría apunta al catálogo filtrado**, que es `noindex, follow`: se
 * puede rastrear —por eso el `follow`— y por ahí se llega a los productos.
 * Es la misma dirección del enlace de la miga, y tiene que serlo.
 */
export function migas(ficha: Ficha): Jsonld {
  return {
    "@context": SCHEMA,
    "@type": "BreadcrumbList",
    itemListElement: [
      { nombre: "Catálogo", ruta: "/productos" },
      // La misma que el enlace de la miga, armada con la misma función: dos
      // formas de escribir la misma dirección es cómo se separan.
      {
        nombre: ficha.categoria,
        ruta: urlDeTienda({ categoria: [ficha.categoriaId] }),
      },
      { nombre: ficha.nombre, ruta: `/productos/${ficha.slug}` },
    ].map((paso, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: paso.nombre,
      item: urlAbsoluta(paso.ruta),
    })),
  };
}

/**
 * El producto, con su oferta — el que importa, y el que se mira con la
 * herramienta de resultados enriquecidos de Google.
 *
 * **Un solo `Offer` y no uno por variante**: el precio es del producto
 * (§5.4), no del color, así que declarar cinco ofertas idénticas no agregaría
 * información, solo formas de que se contradigan.
 *
 * **La disponibilidad se mira sobre la suma**, igual que la tarjeta: un
 * producto con un color agotado y otro con stock está disponible. Y se mira
 * con `> 0` y no con `>= 0` porque el disponible puede ser **negativo**
 * (RF-24), que sigue siendo «no hay».
 *
 * **Sin `sku`**: el catálogo no tiene código de artículo. Inventar uno con el
 * `slug` sería declarar como identificador de comercio algo que se puede
 * cambiar desde el panel al corregir un nombre.
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
    category: ficha.categoria,
    offers: {
      "@type": "Offer",
      url: urlAbsoluta(`/productos/${ficha.slug}`),
      priceCurrency: "ARS",
      // `numeric(12,2)` llega como string y así se manda: schema.org pide el
      // número sin separador de miles ni símbolo, que es exactamente lo que
      // guarda la base. Convertirlo a `number` lo rompería (§7.1).
      price: ficha.precioFinal,
      availability: `${SCHEMA}/${disponible ? "InStock" : "OutOfStock"}`,
      // La home lo dice con todas las letras: «nuevos, en caja».
      itemCondition: `${SCHEMA}/NewCondition`,
      seller: { "@type": "Organization", name: NOMBRE_DEL_SITIO },
    },
  };
}

/**
 * El JSON que se escribe adentro del `<script>`, listo para pegar.
 *
 * **Lo único que hace de más es escapar `<`**, y no es una precaución
 * teórica: el nombre y la descripción los escribe la vendedora en el panel, y
 * un `</script>` en medio de una descripción cerraría la etiqueta ahí mismo.
 * Lo que sigue dejaría de ser datos y pasaría a ser HTML de la página (§16).
 * Con `<` el JSON dice exactamente lo mismo —es la misma cadena para
 * cualquier parser— y el navegador ya no ve una etiqueta.
 *
 * Está separado del componente para poder probarlo: es una regla de seguridad
 * de una línea, y las reglas de seguridad de una línea son las que se borran
 * sin querer.
 */
export function aJson(datos: Jsonld | Jsonld[]): string {
  return JSON.stringify(datos).replace(/</g, "\\u003c");
}
