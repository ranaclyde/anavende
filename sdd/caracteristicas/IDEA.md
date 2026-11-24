# Características de producto — idea

> **Estado:** idea anotada el 2026-11-24, **sin especificar y opcional**. Es
> posterior al MVP y puede no hacerse nunca: el momento lo fija el catálogo,
> cuando una categoría deje de entrar en una página (24 productos). Reemplaza
> el _cómo_ de FA-20 (`FUNCTIONAL-SPEC.md`): las etiquetas sueltas pasan a ser
> **características agrupadas**. Si se retoma, se especifica en serio en este
> mismo directorio y se baja a RF, RN y tareas en `sdd/mvp/`.

## 1. El problema

Una categoría como «Auriculares» mezcla productos que se diferencian por
varias cosas a la vez: gamer o no, con cable o inalámbricos, in-ear o vincha,
con jack de 3,5 mm. **No es un árbol**: un auricular puede ser inalámbrico,
vincha y gamer al mismo tiempo, así que subcategorías («Auriculares › Gamer»,
«Auriculares › Inalámbricos») obligan a ponerlo en una sola y quien lo busca
en la otra no lo encuentra. Partir la categoría en hermanas ya está descartado
por FA-20: llenan la fila de categorías del encabezado.

**Mientras tanto:** una sola categoría y las características en el nombre del
producto, siempre con las mismas palabras («in-ear», no a veces
«intraurales»). La búsqueda tolerante (RF-02) las encuentra, y el día que se
haga esto, pasar los nombres a características es casi mecánico.

## 2. La idea

Como Mercado Libre, WooCommerce o Amazon: además de la categoría, **grupos de
características** que filtran.

| Grupo (la pregunta) | Valores (las respuestas)         |
| ------------------- | -------------------------------- |
| Conexión            | Inalámbrico · Con cable          |
| Formato             | In-ear · Vincha                  |
| Uso                 | Gamer                            |
| Conector            | Jack 3,5 mm · USB-C · HDMI · VGA |

- **El grupo no es de una categoría**: «Conector» sirve para auriculares y
  para cables. El drawer muestra solo los grupos que tienen algo en lo que se
  está mirando, así que no hay que configurar nada por categoría.
- **Todo valor tiene grupo.** Sin un grupo genérico para sueltas.
- **El drawer del catálogo ya funciona así**: categoría, marca y color son
  grupos (`components/shop/grupo-de-filtro.tsx`), dentro de un grupo las
  opciones se suman y entre grupos se cruzan, y cada grupo cuenta con los
  filtros de los otros (`leerOpcionesDeFiltro` en
  `modules/catalog/products/tienda.ts`). Las características serían más grupos
  en el mismo drawer.

**Ya decidido (2026-11-24):**

- **Un producto puede tener más de un valor del mismo grupo** (auriculares
  bluetooth que también traen cable). Dentro del grupo el filtro suma: «in-ear
  **o** vincha»; entre grupos cruza: «inalámbrico **y** in-ear».
- **Desactivar un valor lo oculta y no bloquea**: deja de verse en el filtro y
  en la ficha, los productos siguen activos y conservan el dato. A diferencia
  de los colores (RN-11b).

**Cómo entraría, a grandes rasgos:**

- **Base:** `feature_groups` (nombre, slug, orden), `features` (valor, grupo,
  slug, activo) y `product_features` (producto y valor).
- **Panel:** una pantalla «Características» en Catálogo, con un acordeón por
  grupo como la de colores, y en el formulario del producto un campo con
  búsqueda («inal…» → «Conexión · Inalámbrico»).
- **Tienda:** los grupos en el drawer, en la dirección como
  `?caracteristica=inalambrico&caracteristica=in-ear`; la búsqueda también
  mira los valores; y en la ficha, una tabla chica con lo cargado, con cada
  valor enlazado al catálogo filtrado.
- **Lo difícil** es el conteo del drawer: hoy son tres grupos fijos con una
  consulta cada uno, y acá la cantidad de grupos depende de lo cargado. Cada
  uno tiene que contar con los filtros de los demás, características incluidas.

## 3. Pendiente: cuándo aparecen los grupos

Lo que se vio de otras tiendas: Baymard pide que una **búsqueda en toda la
tienda** también tenga los filtros propios de la categoría (su pauta 376), o
que lleve a la persona a la categoría. Las tiendas grandes **adivinan la
categoría que domina** el resultado (buscar «TV» muestra tamaño de pantalla);
la versión simple, la de la tienda de referencia de Oracle Commerce, usa **la
categoría que comparten todos** los productos encontrados.

Importa porque el buscador del encabezado lleva a `/productos?q=…`, no a la
página de la categoría. Los tres caminos:

| Camino                                        | Cuándo aparecen los grupos                                                                                       | Lo que se pierde                                                                                                                                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A · Solo en una categoría**                 | En la página de una categoría, o con una sola elegida en el filtro                                               | Quien busca «auriculares inalámbricos» desde el encabezado llega a `/productos` y no ve los grupos, justo cuando más los necesita                                                 |
| **B · Todo el resultado es de una categoría** | Lo de A, y además cuando **todo** lo encontrado es de una sola categoría (buscar «auriculares»)                  | Si un resultado mezcla —un cable que dice «auriculares» en el nombre—, no aparecen                                                                                                |
| **C · La categoría que domina**               | Lo de A, y además cuando la mayoría del resultado (un porcentaje a elegir, por ejemplo 80 %) es de una categoría | Hay que elegir el porcentaje, y los grupos filtrarían también los productos de las otras categorías. Es lo que hacen las tiendas grandes, con miles de productos y datos de clics |

**La recomendación al anotarlo fue B**: cubre la búsqueda, no inventa un
porcentaje, y con un catálogo chico y nombres bien cargados una búsqueda
devuelve una sola categoría casi siempre. **No está decidido.**

**Otras cosas que quedan para cuando se especifique:** cómo se ordenan los
grupos en el drawer, si un grupo muestra «Ver las N» como los otros pasado
cierto número, y cómo se nombra en la tienda (en el panel, «Características»;
en el drawer, cada grupo con su nombre).

## 4. Fuentes

- [Baymard — Category-specific filters for sitewide searches (pauta 376)](https://baymard.com/guidelines/376-category-specific-filters-for-sitewide-searches)
- [Baymard — Ecommerce filter UI](https://baymard.com/blog/ecommerce-filter-ui)
- [Bloomreach — Facet Ranking](https://documentation.bloomreach.com/user-guides/search-and-merchandising/bloomreach-features/facet-ranking.html)
- [Oracle Commerce Reference Store — cómo elige las facetas](https://docs.oracle.com/cd/E24152_01/CRS.10-1/ATGCRSOverview/html/s1107determiningthefacetsandresultsto01.html)
