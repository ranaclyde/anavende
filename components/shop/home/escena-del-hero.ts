/**
 * Lo que flota alrededor del nombre en el hero de la home (2026-10-19).
 *
 * **Son imágenes del diseño, no del catálogo.** El hero no depende de qué
 * cargó Ana ni de que una categoría tenga fotos: es una vitrina armada a
 * propósito, y por eso se puede cambiar entera para una fecha —Navidad,
 * Halloween— cambiando esta lista y sus archivos, sin tocar el componente.
 * Las de todos los días están en `public/hero/base/`: ilustraciones
 * recortadas, sin fondo, porque el efecto 3D luce con piezas sueltas y no
 * con fotos en una tarjeta.
 *
 * **Tres profundidades, no seis.** La profundidad (`d`) dice cuánto se mueve
 * cada pieza: las cercanas (1) se mueven y se inclinan más, las lejanas
 * (0,35) casi nada. Más de tres o cuatro escalones no se distinguen a simple
 * vista y solo suman piezas.
 *
 * **El orden importa.** Hasta `lg` se ven las cuatro primeras, arriba y abajo
 * del texto —entre los costados no hay lugar—; desde `lg`, las seis, a los
 * costados. Por eso las cuatro primeras están repartidas en las cuatro
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
    ancho: 640,
    alto: 478,
    lugar: "left-0 top-0 w-32 sm:w-40 lg:top-[10%] lg:left-0 lg:w-56",
    d: 1,
  },
  {
    src: "/hero/base/teclado.webp",
    ancho: 640,
    alto: 383,
    lugar: "right-0 bottom-2 w-40 sm:w-52 lg:right-0 lg:bottom-[6%] lg:w-72",
    d: 1,
  },
  {
    src: "/hero/base/joystick.webp",
    ancho: 640,
    alto: 363,
    lugar: "right-[4%] top-4 w-28 sm:w-36 lg:top-[4%] lg:right-[6%] lg:w-48",
    d: 0.65,
  },
  {
    src: "/hero/base/mouse.webp",
    ancho: 488,
    alto: 640,
    lugar:
      "left-[8%] bottom-0 w-16 sm:w-20 lg:bottom-[4%] lg:left-[9%] lg:w-28",
    d: 0.65,
  },
  {
    src: "/hero/base/chip.webp",
    ancho: 640,
    alto: 640,
    lugar: "hidden lg:block lg:left-[20%] lg:top-0 lg:w-24",
    d: 0.35,
  },
  {
    src: "/hero/base/microfono.webp",
    ancho: 320,
    alto: 640,
    lugar: "hidden lg:block lg:right-[21%] lg:top-[34%] lg:w-12",
    d: 0.35,
  },
];
