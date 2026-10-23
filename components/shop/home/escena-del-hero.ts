import type { Escena } from "@/lib/escenas";

/**
 * Lo que flota alrededor del nombre en el hero de la home (2026-10-19).
 *
 * **Son imágenes del diseño, no del catálogo.** El hero no depende de qué
 * cargó Ana ni de que una categoría tenga fotos: es una vitrina armada a
 * propósito, y por eso se puede cambiar entera para una fecha —Navidad,
 * Halloween— cambiando esta lista y sus archivos, sin tocar el componente.
 * Así quedó en F9.5: `escenaDelHero()`, al final.
 * Las de todos los días están en `public/hero/base/`: ilustraciones
 * recortadas, sin fondo, porque el efecto 3D luce con piezas sueltas y no
 * con fotos en una tarjeta.
 *
 * **Tres profundidades, no seis.** La profundidad (`d`) dice cuánto se mueve
 * cada pieza: las cercanas (1) se mueven y se inclinan más, las lejanas
 * (0,35) casi nada. Más de tres o cuatro escalones no se distinguen a simple
 * vista y solo suman piezas.
 *
 * **Una imagen cambiada lleva un nombre nuevo.** El optimizador de Next y
 * Cloudflare guardan cada imagen por su dirección: si se pisa
 * `mouse.webp` con otro dibujo, durante meses se sigue viendo el viejo.
 *
 * **El orden importa.** Hasta `lg` se ven las cuatro primeras, arriba y abajo
 * del texto —entre los costados no hay lugar—; desde `lg`, las seis, tres por
 * costado. Por eso las cuatro primeras están repartidas en las cuatro
 * esquinas.
 */
export type PiezaDelHero = {
  src: string;
  /** Proporción del archivo, para reservar el lugar y que nada salte. */
  ancho: number;
  alto: number;
  /** Dónde va y de qué tamaño, en clases de Tailwind. */
  lugar: string;
  /** Profundidad: 1 cerca, 0,65 a media distancia, 0,35 lejos. */
  d: 1 | 0.65 | 0.35;
};

export const ESCENA_BASE: PiezaDelHero[] = [
  {
    src: "/hero/base/auriculares.webp",
    ancho: 1000,
    alto: 954,
    lugar: "left-0 top-0 w-28 sm:w-36 lg:top-[6%] lg:left-0 lg:w-48",
    d: 1,
  },
  {
    src: "/hero/base/teclado.webp",
    ancho: 1000,
    alto: 389,
    lugar: "right-0 bottom-2 w-44 sm:w-56 lg:right-0 lg:bottom-[4%] lg:w-72",
    d: 1,
  },
  {
    src: "/hero/base/joystick.webp",
    ancho: 1000,
    alto: 631,
    lugar: "right-[3%] top-4 w-32 sm:w-40 lg:top-[4%] lg:right-[5%] lg:w-52",
    d: 0.65,
  },
  {
    src: "/hero/base/mouse.webp",
    ancho: 747,
    alto: 1000,
    lugar:
      "left-[8%] bottom-0 w-16 sm:w-20 lg:bottom-[4%] lg:left-[9%] lg:w-28",
    d: 0.65,
  },
  // Las dos lejanas, solo en computadora: una por costado, a media altura,
  // para que queden tres y tres.
  {
    src: "/hero/base/almacenamiento.webp",
    ancho: 1000,
    alto: 608,
    lugar: "hidden lg:block lg:left-[14%] lg:top-[46%] lg:w-32",
    d: 0.35,
  },
  {
    src: "/hero/base/cable.webp",
    ancho: 1000,
    alto: 772,
    lugar: "hidden lg:block lg:right-[19%] lg:top-[36%] lg:w-24",
    d: 0.35,
  },
];

/*
 * ── Las escenas por fecha (F9.5, RF-38) ──────────────────────────────────
 *
 * Las mismas cuatro esquinas y las mismas profundidades que la base, con las
 * piezas disfrazadas: siguen siendo auriculares, teclado, joystick y mouse,
 * porque la tienda vende eso y la escena tiene que seguir diciéndolo. Las dos
 * lejanas sí son de la fecha. Los tamaños cambian donde el disfraz cambia la
 * proporción —las alas hacen al mouse ancho, el bastón es angosto—, para que
 * cada pieza pese en pantalla lo mismo que la que reemplaza.
 */

export const ESCENA_HALLOWEEN: PiezaDelHero[] = [
  {
    src: "/hero/halloween/calabaza.webp",
    ancho: 1000,
    alto: 954,
    lugar: "left-0 top-0 w-28 sm:w-36 lg:top-[6%] lg:left-0 lg:w-48",
    d: 1,
  },
  {
    src: "/hero/halloween/teclado-aranas.webp",
    ancho: 1000,
    alto: 600,
    lugar: "right-0 bottom-2 w-44 sm:w-56 lg:right-0 lg:bottom-[4%] lg:w-72",
    d: 1,
  },
  {
    src: "/hero/halloween/joystick-sombrero.webp",
    ancho: 1000,
    alto: 875,
    lugar: "right-[3%] top-2 w-32 sm:w-40 lg:top-[2%] lg:right-[5%] lg:w-52",
    d: 0.65,
  },
  {
    src: "/hero/halloween/mouse-murcielago.webp",
    ancho: 1000,
    alto: 618,
    lugar:
      "left-[4%] bottom-0 w-28 sm:w-32 lg:bottom-[4%] lg:left-[5%] lg:w-44",
    d: 0.65,
  },
  {
    src: "/hero/halloween/fantasma.webp",
    ancho: 530,
    alto: 739,
    lugar: "hidden lg:block lg:left-[16%] lg:top-[42%] lg:w-24",
    d: 0.35,
  },
  {
    src: "/hero/halloween/caramelo.webp",
    ancho: 852,
    alto: 380,
    lugar: "hidden lg:block lg:right-[21%] lg:top-[45%] lg:w-24",
    d: 0.35,
  },
];

export const ESCENA_NAVIDAD: PiezaDelHero[] = [
  {
    src: "/hero/navidad/auriculares-gorro.webp",
    ancho: 860,
    alto: 1000,
    lugar: "left-0 top-0 w-24 sm:w-32 lg:top-[3%] lg:left-0 lg:w-44",
    d: 1,
  },
  {
    src: "/hero/navidad/teclado-guirnalda.webp",
    ancho: 1000,
    alto: 506,
    lugar: "right-0 bottom-2 w-44 sm:w-56 lg:right-0 lg:bottom-[4%] lg:w-72",
    d: 1,
  },
  {
    src: "/hero/navidad/joystick-regalo.webp",
    ancho: 1000,
    alto: 740,
    lugar: "right-[3%] top-3 w-32 sm:w-40 lg:top-[3%] lg:right-[5%] lg:w-52",
    d: 0.65,
  },
  {
    src: "/hero/navidad/mouse-reno.webp",
    ancho: 614,
    alto: 1000,
    lugar:
      "left-[8%] bottom-0 w-16 sm:w-20 lg:bottom-[4%] lg:left-[9%] lg:w-28",
    d: 0.65,
  },
  {
    src: "/hero/navidad/esfera.webp",
    ancho: 600,
    alto: 715,
    lugar: "hidden lg:block lg:left-[17%] lg:top-[35%] lg:w-20",
    d: 0.35,
  },
  {
    src: "/hero/navidad/baston.webp",
    ancho: 330,
    alto: 862,
    lugar: "hidden lg:block lg:right-[23%] lg:top-[43%] lg:w-12",
    d: 0.35,
  },
];

export const ESCENA_PASCUA: PiezaDelHero[] = [
  {
    src: "/hero/pascua/auriculares-conejo.webp",
    ancho: 779,
    alto: 1000,
    lugar: "left-0 top-0 w-24 sm:w-32 lg:top-[2%] lg:left-0 lg:w-40",
    d: 1,
  },
  {
    src: "/hero/pascua/teclado-huevos.webp",
    ancho: 1000,
    alto: 389,
    lugar: "right-0 bottom-2 w-44 sm:w-56 lg:right-0 lg:bottom-[4%] lg:w-72",
    d: 1,
  },
  {
    src: "/hero/pascua/joystick-canasta.webp",
    ancho: 926,
    alto: 723,
    lugar: "right-[3%] top-3 w-32 sm:w-40 lg:top-[3%] lg:right-[5%] lg:w-52",
    d: 0.65,
  },
  {
    src: "/hero/pascua/mouse-huevo.webp",
    ancho: 747,
    alto: 1000,
    lugar:
      "left-[8%] bottom-0 w-16 sm:w-20 lg:bottom-[4%] lg:left-[9%] lg:w-28",
    d: 0.65,
  },
  {
    src: "/hero/pascua/conejo.webp",
    ancho: 428,
    alto: 832,
    lugar: "hidden lg:block lg:left-[17%] lg:top-[38%] lg:w-16",
    d: 0.35,
  },
  {
    src: "/hero/pascua/huevo-chocolate.webp",
    ancho: 460,
    alto: 600,
    lugar: "hidden lg:block lg:right-[18%] lg:top-[40%] lg:w-16",
    d: 0.35,
  },
];

/** Qué piezas lleva el hero según la escena de hoy; `null` es la base. */
export function escenaDelHero(escena: Escena | null): PiezaDelHero[] {
  if (escena === "halloween") return ESCENA_HALLOWEEN;
  if (escena === "navidad") return ESCENA_NAVIDAD;
  if (escena === "pascua") return ESCENA_PASCUA;
  return ESCENA_BASE;
}
