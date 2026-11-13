"use client";

import { useEffect, type CSSProperties } from "react";

import {
  CLAVE_MARCA_VISTA,
  LADO_DEL_ISOTIPO,
  LETRAS_EN_EL_ISOTIPO,
  PALABRA,
  PIEZAS,
} from "@/lib/marca";

/**
 * «AnaVende» en el hero de la home, y la animación de la primera carga —
 * DESIGN-REFERENCE §2.3 y §7.1, F10.7c.
 *
 * **Lo que se ve quieto es la palabra**, en la letra del logo. La primera vez
 * que alguien abre la home en una visita, la palabra arranca siendo el
 * isotipo: el marco, el joystick y los auriculares se apagan, la A y la V
 * crecen hasta su lugar en la palabra, y de cada una sale el resto, «na» y
 * «ende». Dura 1,6 segundos y no se repite.
 *
 * **Todo es CSS** (`marca-del-hero` en `globals.css`): arranca con el primer
 * pintado, sin esperar a que React hidrate, y no vuelve a dibujar nada. Lo
 * que se ve en reposo es el estado final; la animación solo lo recorre desde
 * la grilla. Así, con `prefers-reduced-motion` o con la animación ya vista,
 * alcanza con no correrla.
 *
 * **Una vez por visita.** «Vista» es `data-marca-vista` en `<html>`: lo pone
 * este componente cuando la animación termina, y como `<html>` sobrevive a la
 * navegación de Next, volver al inicio no la repite. (Si alguien se va antes
 * de que termine, al volver la ve entera: no la vio.) Una recarga sí empezaría de cero, así que también se anota en
 * `sessionStorage`, y el script de `app/layout.tsx` repone el atributo antes
 * del primer pintado. Una pestaña nueva es una visita nueva.
 */

function marcarComoVista() {
  document.documentElement.setAttribute("data-marca-vista", "");
}

// ── Geometría, en las unidades de la palabra (mayúscula de 1000) ──────────

const [x, y, ancho, alto] = PALABRA.caja;

/** La grilla arranca un 25 % más alta que la palabra, centrada en ella. */
const LADO_DE_LA_GRILLA = alto * 1.25;
const ESCALA_DE_LA_GRILLA = LADO_DE_LA_GRILLA / LADO_DEL_ISOTIPO;
const ORIGEN_DE_LA_GRILLA = [
  x + ancho / 2 - LADO_DE_LA_GRILLA / 2,
  y + alto / 2 - LADO_DE_LA_GRILLA / 2,
];

/**
 * El `transform` que lleva una letra de la palabra a su celda de la grilla:
 * misma letra, más chica y en otro lugar. La animación va de ahí a nada.
 */
function desdeLaGrilla(
  caja: readonly [number, number, number, number],
  [cx, cy]: readonly [number, number],
) {
  const escala =
    (LETRAS_EN_EL_ISOTIPO.mayuscula * ESCALA_DE_LA_GRILLA) /
    (caja[3] - caja[1]);
  const destinoX = ORIGEN_DE_LA_GRILLA[0] + cx * ESCALA_DE_LA_GRILLA;
  const destinoY = ORIGEN_DE_LA_GRILLA[1] + cy * ESCALA_DE_LA_GRILLA;
  const centroX = (caja[0] + caja[2]) / 2;
  const centroY = (caja[1] + caja[3]) / 2;
  const tx = destinoX - centroX * escala;
  const ty = destinoY - centroY * escala;
  return {
    "--desde": `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${escala.toFixed(4)})`,
  } as CSSProperties;
}

const DESDE_LA_A = desdeLaGrilla(PALABRA.cajaDeLaA, LETRAS_EN_EL_ISOTIPO.a);
const DESDE_LA_V = desdeLaGrilla(PALABRA.cajaDeLaV, LETRAS_EN_EL_ISOTIPO.v);
const VISTA = PALABRA.caja.join(" ");
const GRILLA = `translate(${ORIGEN_DE_LA_GRILLA.join(" ")}) scale(${ESCALA_DE_LA_GRILLA})`;

export function MarcaDelHero() {
  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_MARCA_VISTA, "1");
    } catch {
      // Sin almacenamiento, la animación se repite al recargar: nada más.
    }
  }, []);

  return (
    // La caja mide lo que medía la palabra en texto, para que el eslogan y
    // el buscador no se muevan: la palabra va centrada adentro.
    <span className="flex h-(--text-display) items-center sm:h-(--text-marca)">
      <svg
        aria-hidden
        focusable="false"
        viewBox={VISTA}
        // 0,74 = alto de mayúscula de Inter (0,727) por la caja de la
        // palabra (1,018): la misma mayúscula que tenía el texto.
        className="marca-del-hero h-[calc(var(--text-display)*0.74)] w-auto overflow-visible text-logo sm:h-[calc(var(--text-marca)*0.74)]"
        onAnimationEnd={(evento) => {
          if (evento.animationName === "marca-del-hero-resto")
            marcarComoVista();
        }}
      >
        <g fill="currentColor" fillRule="evenodd">
          <g transform={GRILLA}>
            <path className="marca-del-hero-grilla" d={PIEZAS.marco} />
            <path className="marca-del-hero-grilla" d={PIEZAS.joystick} />
            <path className="marca-del-hero-grilla" d={PIEZAS.auriculares} />
          </g>
          <path className="marca-del-hero-resto" d={PALABRA.partes.na} />
          <path
            className="marca-del-hero-resto marca-del-hero-ende"
            d={PALABRA.partes.ende}
          />
          <path
            className="marca-del-hero-letra"
            style={DESDE_LA_A}
            d={PALABRA.partes.a}
          />
          <path
            className="marca-del-hero-letra marca-del-hero-v"
            style={DESDE_LA_V}
            d={PALABRA.partes.v}
          />
        </g>
      </svg>
    </span>
  );
}
