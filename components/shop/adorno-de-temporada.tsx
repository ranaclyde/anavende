import type { Escena } from "@/lib/escenas";

/**
 * El adorno del logo en las escenas por fecha — F9.5, RF-38 (2026-10-23).
 *
 * **El isotipo no se toca.** §2.3 dice que nunca se deforma, recolorea ni
 * sombrea, y eso sigue valiendo: el adorno es un dibujo aparte, encima, que
 * se va cuando termina la fecha. Es la única excepción a «nada encima del
 * logo», está anotada en §2.3 y tiene dos límites: no tapa más que el borde
 * de la cuadrícula, y el nombre accesible del enlace no cambia.
 *
 * Mide un poco más que el isotipo (40 sobre 32) para que la guirnalda y la
 * araña puedan salirse del borde, que es lo que las hace leer como cosas
 * colgadas y no como parte del dibujo.
 *
 * **Lo que se mueve, se mueve poco y se queda quieto.** Las luces titilan
 * cuatro veces y quedan prendidas; la araña baja una vez. Las dos terminan
 * antes de los cinco segundos de WCAG 2.2.2, así que no necesitan pausa, y
 * con `prefers-reduced-motion` no se mueven.
 */
export function AdornoDeTemporada({ escena }: { escena: Escena }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className="pointer-events-none absolute -inset-1 size-10 overflow-visible"
    >
      {escena === "navidad" ? <Guirnalda /> : <Arana />}
    </svg>
  );
}

/** Rojo, verde, dorado y azul: los de una guirnalda de verdad. */
const FOCOS = [
  { x: 5.5, y: 9.6, color: "#e23b3b" },
  { x: 11, y: 9.8, color: "#2fb36d" },
  { x: 17, y: 9.6, color: "#f2b632" },
  { x: 23, y: 9.8, color: "#3b82f6" },
  { x: 29, y: 9.6, color: "#e23b3b" },
  { x: 34.5, y: 9.8, color: "#2fb36d" },
];

/**
 * Tres combas de cable sobre el borde de arriba, con un foco colgando en cada
 * tramo. El halo es el mismo color difuminado: sin él, a 32px son puntos.
 */
function Guirnalda() {
  return (
    <>
      <defs>
        <filter id="halo-del-foco" x="-1" y="-1" width="3" height="3">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
      </defs>
      <path
        d="M1 5.5Q5.5 10.5 8.5 6.2T17 6.6T26.5 6.2T34.5 6.6T39.5 5"
        fill="none"
        stroke="#1d3b2a"
        strokeWidth="0.9"
        strokeLinecap="round"
      />
      {FOCOS.map((f, i) => (
        <g
          key={i}
          className="animate-foquito"
          style={{ animationDelay: `${(i % 3) * 180}ms` }}
        >
          <circle
            cx={f.x}
            cy={f.y + 1.6}
            r="2.6"
            fill={f.color}
            opacity="0.55"
            filter="url(#halo-del-foco)"
          />
          <rect
            x={f.x - 0.8}
            y={f.y - 1.6}
            width="1.6"
            height="1.3"
            rx="0.3"
            fill="#4a4a4a"
          />
          <ellipse cx={f.x} cy={f.y + 1.4} rx="1.5" ry="2" fill={f.color} />
          <ellipse
            cx={f.x - 0.45}
            cy={f.y + 0.8}
            rx="0.45"
            ry="0.7"
            fill="#fff"
            opacity="0.7"
          />
        </g>
      ))}
    </>
  );
}

/**
 * Una telaraña en la esquina de arriba a la izquierda y una araña que baja
 * por afuera del borde. Del lado izquierdo y no del derecho: a la derecha
 * está el nombre, y la araña quedaba pegada a la «A». Se dibuja del lado
 * derecho y se espeja entera, que es más fácil de leer que las coordenadas
 * al revés. En tinta y no en negro, como las sombras del sistema.
 */
function Arana() {
  return (
    <g transform="matrix(-1 0 0 1 40 0)">
      <g
        fill="none"
        stroke="#6e6a68"
        strokeWidth="0.45"
        strokeLinecap="round"
        opacity="0.9"
      >
        <path d="M36 4L27 4M36 4L36 13M36 4L29.5 10.5M36 4L32.5 12M36 4L28 7.5" />
        <path d="M33 4Q33.4 5.2 34.6 5.4Q35 6.4 36 7" />
        <path d="M30 4Q30.6 6.6 32.4 7.6Q33.6 9.4 36 10" />
        <path d="M27.6 4Q28 7.8 30.4 9.6Q32 12 36 12.6" />
      </g>
      <g className="animate-arana">
        <path d="M38.5 0V16" stroke="#6e6a68" strokeWidth="0.45" />
        <g
          stroke="#111010"
          strokeWidth="0.75"
          fill="none"
          strokeLinecap="round"
        >
          <path d="M37.6 17.4L35.4 15.6L34.6 17M37.4 18.4L34.8 18L34 19.6M37.4 19.4L35 20.6L34.6 22.4M37.7 20.2L36 22.6L36.4 24" />
          <path d="M39.4 17.4L41.6 15.6L42.4 17M39.6 18.4L42.2 18L43 19.6M39.6 19.4L42 20.6L42.4 22.4M39.3 20.2L41 22.6L40.6 24" />
        </g>
        <circle cx="38.5" cy="16.8" r="1.3" fill="#111010" />
        <ellipse cx="38.5" cy="19.6" rx="1.9" ry="2.3" fill="#111010" />
        <circle cx="38" cy="16.5" r="0.3" fill="#f28c28" />
        <circle cx="39" cy="16.5" r="0.3" fill="#f28c28" />
      </g>
    </g>
  );
}
