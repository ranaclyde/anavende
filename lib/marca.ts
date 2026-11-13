/**
 * El logo de AnaVende, en trazos — DESIGN-REFERENCE §2.3, F10.7c.
 *
 * Es la fuente de verdad: los componentes lo dibujan en línea y
 * `scripts/derivar-logo.mts` saca de acá los archivos (SVG, PNG, favicon).
 * Cómo se construyó, y por qué así, está en `docs/MARCA.md`.
 *
 * El isotipo es una caja de 1100×1100: borde de 33, división de 30 y
 * cuatro celdas de 502. La A y la V son de Figtree ExtraBold (800), con alto
 * de mayúscula de 330, centradas en su celda. El joystick y los auriculares
 * salen del logo original, vueltos simétricos y centrados por su caja.
 *
 * Cada pieza va en su propio trazo para poder moverla sola (la animación de
 * la primera carga). Se pintan todas con `fill-rule="evenodd"`.
 */

export const LADO_DEL_ISOTIPO = 1100;

export const PIEZAS = {
  /** El marco con las cuatro celdas caladas. */
  marco:
    "M18 0h1064a18 18 0 0 1 18 18v1064a18 18 0 0 1-18 18H18a18 18 0 0 1-18-18V18A18 18 0 0 1 18 0m18 33h496l3 3v496l-3 3H36l-3-3V36zm532 0h496l3 3v496l-3 3H568l-3-3V36zM36 565h496l3 3v496l-3 3H36l-3-3V568zm532 0h496l3 3v496l-3 3H568l-3-3V568z",
  a: "M195 449h-80l128-330h82l128 330h-80l-24-63H219zm89-235-40 105h80z",
  joystick:
    "m856 101-4 1h-1l-17 7c-23 12-30 25-31 53 0 9 0 9-2 11-2 3-2 3-27 3h-56l-26 4-8 2-3 1q-25 7-42 26a91 91 0 0 0-21 39l-1 4-1 6-2 6v2l-1 3-1 4-1 5-1 5-1 5v4l-1 3-1 4v2l-1 3v4l-2 7-1 7-1 3-1 7-1 3v4l-2 8-1 7-1 3-1 7-1 4-1 7-1 4c-6 34 11 69 39 82l13 4h2c5 2 24 2 29 1l4-1c7-1 18-5 25-10 13-9 21-19 35-46 11-22 18-30 30-36l20-5h4l7-1h32l7 1h4l20 5c12 6 19 14 30 36 14 27 22 37 35 46 7 5 18 9 25 10l4 1c5 1 24 1 29-1h2l7-2c30-10 48-42 46-77l-2-11v-3l-1-4-1-4v-3l-1-4-1-3-1-7-2-8v-4l-1-3-1-7-1-7-1-3-1-7-1-4-1-3v-2l-1-7-1-4-1-5-2-10-1-4-1-3v-2l-2-6-1-6-1-4a91 91 0 0 0-62-65l-4-1q-9-3-21-4c-10-2-12-2-39-2h-38c-20 0-20 0-22-2-1-3-2-13 0-20q6-22 36-31l3-1 3-1c7-1 7-17 1-19zM726 204h-12l-4 1-10 2h-2l-8 2q-22 8-35 25-7 11-12 34l-1 5v2l-1 3v3l-1 3v3l-1 2-1 4-2 10v3l-1 4-1 3v4l-2 9-1 4-1 5-1 4v3l-1 4-1 4v2l-1 3-3 14v3q-9 50 24 64 33 13 56-22l9-17 14-25q16-21 43-29l4-1 3-1h3l3-1h2l5-1h54l5 1h2l3 1h3l3 1 4 1q27 8 43 29l14 25q25 52 60 41 39-13 29-66v-3l-3-14v-3l-1-2-1-4v-4l-1-3-2-9-1-4-1-9-1-4-1-3-1-4v-3l-2-10-1-4v-2l-1-3v-3l-1-3v-3l-1-2-1-5q-4-23-12-34-13-17-35-25l-7-2h-3l-9-2-5-1h-21l-55 1h-68c-7-1-43-2-48-1m-9 26q-5 2-7 6l-1 2v15l-2 16-13 1c-18 0-20 0-23 7l-1 1v9l1 2c3 6 5 7 24 7h14v14l-1 7 1 11c4 10 19 10 24 1l1-2v-30h1l1-1h12c15 0 15 0 18-2 9-4 9-19 0-23l-18-1h-13l-1-1v-15c0-16 0-16-2-19q-4-7-15-5m191 5q-7 2-9 7l-1 2v7l1 2c4 11 19 11 23 0l1-2v-7l-1-2q-4-8-14-7m-40 36c-13 5-10 24 4 25 15 1 20-19 5-25zm77 0c-10 4-12 15-5 22 8 9 23 2 23-10-1-9-10-15-18-12m-38 35c-15 4-12 26 3 26q13 0 14-13v-4l-1-2q-6-9-16-7",
  auriculares:
    "M267 633h-4l-4 1h-4l-3 1h-3l-3 1h-3l-4 1c-14 4-31 10-43 18a201 201 0 0 0-79 105v2l-1 4-1 5-1 3v2l-1 5v57c0 4 0 4-5 14l-8 18v3l-1 8c0 10 0 15 3 26l1 3 1 2 1 4c6 21 18 50 25 60q7 11 20 18l15 5h24l7-2c33-9 55-23 56-37 1-5 0-8-3-17l-4-10-17-44-22-59c-5-13-7-16-14-19h-12l-2 1h-2l-3 1-10 2-3 1-8 3c-9 2-10 2-11 0l1-35v-3l2-8q10-43 64-85 20-14 41-19l3-1h4l4-1 53 1h3l3 1c20 4 37 13 59 33 27 25 39 43 46 67l2 12v3l1 35c-1 2-2 2-11 0l-8-3-3-1-10-2-3-1h-2l-2-1h-12c-6 3-9 6-14 19l-22 59-6 15-18 56q5 22 56 37l7 2h25l2-1q22-6 32-22c7-10 19-39 25-60l1-4 1-2 1-3c3-11 4-16 3-26l-1-8v-3l-8-18c-5-10-5-10-5-14v-57l-1-5v-2l-1-3-1-5-1-4v-2l-10-26c-17-34-44-65-68-79q-20-12-44-18l-4-1h-3l-3-1h-3l-3-1h-4l-4-1zM155 847q-8 1-7 7l6 16 6 19 4 9 3 10 3 9 3 9 3 9 10 29q3 8 4 7c2 2 9-1 10-3s1-1-2-10l-4-10-3-8-3-9-7-22-2-6-4-10-6-19-3-9-3-10q-3-11-8-8m255 0q-1-1-4 8l-4 10-3 9-3 10-7 19-2 6-7 22-3 9-3 8-3 10-3 10c1 2 8 5 10 3q2 1 4-7l3-7 7-22 3-9 3-9 3-9 4-10 3-9 6-19 6-16-1-5q-4-3-9-2",
  v: "M857 981h-82L646 651h82l88 239 88-239h82z",
} as const;

export type Pieza = keyof typeof PIEZAS;

/**
 * «AnaVende» en Figtree ExtraBold, convertida en trazo: no depende de que la
 * fuente cargue. Unidades propias: alto de mayúscula 1000, base en 0.
 *
 * Va en cuatro partes —«A», «na», «V», «ende»— ya en su lugar, con el
 * interletrado de la fuente: juntas son la palabra, y separadas la animación
 * del hero puede sacar la A y la V de la grilla y abrir el resto.
 */
const PARTES = {
  a: "M254 0L11 0L400-1000L646-1000L1034 0L791 0L719-190L327-190L254 0ZM523-713L401-393L643-393L523-713Z",
  na: "M1341 0L1119 0L1119-714L1329-714L1337-623Q1373-674 1424-703Q1476-731 1540-731L1540-731Q1626-731 1684-696Q1743-661 1772-590Q1801-519 1801-407L1801-407L1801 0L1579 0L1579-366Q1579-423 1566-456Q1553-490 1529-506Q1506-521 1471-523L1471-523Q1407-524 1374-488Q1341-451 1341-377L1341-377L1341 0ZM2167 17L2167 17Q2040 17 1970-40Q1900-97 1900-201L1900-201Q1900-314 1973-370Q2046-426 2177-426L2177-426L2351-426Q2344-483 2318-515Q2291-547 2233-547L2233-547Q2193-547 2163-529Q2133-510 2111-477L2111-477L1917-541Q1941-594 1984-637Q2026-680 2087-706Q2149-731 2230-731L2230-731Q2341-731 2419-690Q2496-649 2534-574Q2573-500 2573-399L2573-399L2570 0L2361 0L2359-73Q2330-29 2281-6Q2233 17 2167 17ZM2216-151L2216-151Q2257-151 2289-169Q2320-186 2338-215Q2356-244 2356-279L2356-279L2356-283L2261-283Q2190-283 2159-263Q2127-243 2127-207L2127-207Q2127-181 2151-166Q2174-151 2216-151Z",
  v: "M3287 0L3039 0L2647-1000L2894-1000L3163-276L3429-1000L3677-1000L3287 0Z",
  ende: "M4046 17L4046 17Q3934 17 3849-31Q3763-79 3714-163Q3666-247 3666-357L3666-357Q3666-469 3715-553Q3764-637 3850-684Q3936-731 4049-731L4049-731Q4150-731 4231-683Q4313-634 4361-539Q4409-443 4409-300L4409-300L3897-300Q3904-239 3948-202Q3991-166 4051-166L4051-166Q4104-166 4141-189Q4177-213 4191-249L4191-249L4389-181Q4360-114 4308-70Q4256-26 4189-4Q4121 17 4046 17ZM3903-449L3903-449L4176-449Q4170-491 4149-516Q4127-541 4099-552Q4070-563 4041-563L4041-563Q4014-563 3984-552Q3954-541 3932-516Q3910-491 3903-449ZM4726 0L4503 0L4503-714L4713-714L4721-623Q4757-674 4809-703Q4860-731 4924-731L4924-731Q5010-731 5069-696Q5127-661 5156-590Q5186-519 5186-407L5186-407L5186 0L4963 0L4963-366Q4963-423 4950-456Q4937-490 4914-506Q4890-521 4856-523L4856-523Q4791-524 4759-488Q4726-451 4726-377L4726-377L4726 0ZM5607 17L5607 17Q5507 17 5435-28Q5363-73 5324-157Q5284-241 5284-357L5284-357Q5284-474 5324-558Q5363-641 5435-686Q5507-731 5607-731L5607-731Q5674-731 5725-705Q5776-679 5810-630L5810-630L5810-1000L6033-1000L6033 0L5820 0L5814-90Q5781-39 5729-11Q5676 17 5607 17ZM5666-189L5666-189Q5706-189 5736-207Q5767-226 5786-261Q5806-296 5810-339L5810-339L5810-376Q5806-419 5786-453Q5767-487 5736-506Q5704-526 5664-526L5664-526Q5621-526 5588-504Q5554-483 5535-445Q5516-407 5516-357L5516-357Q5516-307 5536-269Q5556-231 5589-210Q5623-189 5666-189ZM6521 17L6521 17Q6410 17 6324-31Q6239-79 6190-163Q6141-247 6141-357L6141-357Q6141-469 6191-553Q6240-637 6326-684Q6411-731 6524-731L6524-731Q6626-731 6707-683Q6789-634 6836-539Q6884-443 6884-300L6884-300L6373-300Q6380-239 6424-202Q6467-166 6527-166L6527-166Q6580-166 6616-189Q6653-213 6667-249L6667-249L6864-181Q6836-114 6784-70Q6731-26 6664-4Q6597 17 6521 17ZM6379-449L6379-449L6651-449Q6646-491 6624-516Q6603-541 6574-552Q6546-563 6517-563L6517-563Q6490-563 6460-552Q6430-541 6408-516Q6386-491 6379-449Z",
} as const;

export const PALABRA = {
  partes: PARTES,
  d: PARTES.a + PARTES.na + PARTES.v + PARTES.ende,
  /** x, y, ancho y alto de la caja de la tinta. */
  caja: [11, -1000, 6874, 1018] as const,
  /** Las cajas de la A y la V: x1, y1, x2, y2. */
  cajaDeLaA: [11, -1000, 1034, 0] as const,
  cajaDeLaV: [2647, -1000, 3677, 0] as const,
};

/**
 * Dónde están la A y la V dentro del isotipo: el centro de su celda y su
 * alto de mayúscula. Es de donde salen en la animación del hero.
 */
export const LETRAS_EN_EL_ISOTIPO = {
  a: [284, 284],
  v: [816, 816],
  mayuscula: 330,
} as const;

/**
 * La versión horizontal: isotipo y palabra. La mayúscula de la palabra mide
 * el 45 % del alto del isotipo y va centrada en él; la separación es el 30 %.
 * A 32 px de isotipo, mayúscula de 14,4 px y separación de 9,6 px.
 */
export const HORIZONTAL = {
  mayuscula: 0.45,
  separacion: 0.3,
} as const;

const TRAZOS = Object.values(PIEZAS)
  .map((d) => `<path d="${d}"/>`)
  .join("");

/** El isotipo como archivo SVG, para los scripts que derivan imágenes. */
export function svgDelIsotipo(color: string) {
  const s = LADO_DEL_ISOTIPO;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}"><g fill="${color}" fill-rule="evenodd">${TRAZOS}</g></svg>`;
}

/** La versión horizontal como archivo SVG. */
export function svgHorizontal(color: string) {
  const s = LADO_DEL_ISOTIPO;
  const k = (s * HORIZONTAL.mayuscula) / 1000;
  const [x, , ancho] = PALABRA.caja;
  const desde = s * (1 + HORIZONTAL.separacion);
  const base = s / 2 + (s * HORIZONTAL.mayuscula) / 2;
  const total = Math.ceil(desde + ancho * k);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${s}"><g fill="${color}" fill-rule="evenodd">${TRAZOS}<path transform="translate(${desde - x * k} ${base}) scale(${k})" d="${PALABRA.d}"/></g></svg>`;
}

/**
 * La animación del hero se ve una vez por visita (`marca-del-hero.tsx`).
 * Esta es la clave en `sessionStorage`, y el script que va al principio de
 * `<body>` para que una recarga no la repita: pone `data-marca-vista` en
 * `<html>` antes del primer pintado. Vive acá y no en el componente porque
 * el layout es de servidor y no puede importar valores de un módulo de
 * cliente.
 */
export const CLAVE_MARCA_VISTA = "anavende:marca-vista";

export const SCRIPT_MARCA_VISTA = `try{if(sessionStorage.getItem("${CLAVE_MARCA_VISTA}"))document.documentElement.setAttribute("data-marca-vista","")}catch(e){}`;
