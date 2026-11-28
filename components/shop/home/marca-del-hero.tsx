"use client";

import { useEffect, type CSSProperties } from "react";

import {
  LOGO_SEEN_KEY,
  MARK_SIZE,
  LETTERS_IN_MARK,
  WORDMARK,
  PIECES,
} from "@/lib/logo";

/**
 * La animación es CSS (`marca-del-hero` en `globals.css`), para que arranque
 * antes de hidratar; en reposo se ve el estado final. Una vez por visita
 * (docs/MARCA.md): `data-marca-vista` en `<html>` sobrevive a la navegación, y
 * para la recarga el script de `app/layout.tsx` lo repone desde `sessionStorage`.
 */

function marcarComoVista() {
  document.documentElement.setAttribute("data-marca-vista", "");
}

// En las unidades de la palabra (mayúscula de 1000).
const [x, y, , alto] = WORDMARK.box;

/** Un 25 % más alta que la palabra, centrada en alto y apoyada a la izquierda. */
const LADO_DE_LA_GRILLA = alto * 1.25;
const ESCALA_DE_LA_GRILLA = LADO_DE_LA_GRILLA / MARK_SIZE;
const ORIGEN_DE_LA_GRILLA = [x, y + alto / 2 - LADO_DE_LA_GRILLA / 2];

/** El `transform` que lleva una letra de la palabra a su celda de la grilla. */
function desdeLaGrilla(
  caja: readonly [number, number, number, number],
  [cx, cy]: readonly [number, number],
) {
  const escala =
    (LETTERS_IN_MARK.capHeight * ESCALA_DE_LA_GRILLA) / (caja[3] - caja[1]);
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

const DESDE_LA_A = desdeLaGrilla(WORDMARK.boxOfA, LETTERS_IN_MARK.a);
const DESDE_LA_V = desdeLaGrilla(WORDMARK.boxOfV, LETTERS_IN_MARK.v);
const VISTA = WORDMARK.box.join(" ");
const GRILLA = `translate(${ORIGEN_DE_LA_GRILLA.join(" ")}) scale(${ESCALA_DE_LA_GRILLA})`;

export function MarcaDelHero() {
  useEffect(() => {
    try {
      sessionStorage.setItem(LOGO_SEEN_KEY, "1");
    } catch {
      // Sin almacenamiento, la animación se repite al recargar: nada más.
    }
  }, []);

  return (
    // La caja mide lo que la palabra en texto, para que lo de abajo no se mueva.
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
            <path className="marca-del-hero-grilla" d={PIECES.frame} />
            <path className="marca-del-hero-grilla" d={PIECES.joystick} />
            <path className="marca-del-hero-grilla" d={PIECES.headphones} />
          </g>
          <path className="marca-del-hero-resto" d={WORDMARK.parts.na} />
          <path
            className="marca-del-hero-resto marca-del-hero-ende"
            d={WORDMARK.parts.ende}
          />
          <path
            className="marca-del-hero-letra"
            style={DESDE_LA_A}
            d={WORDMARK.parts.a}
          />
          <path
            className="marca-del-hero-letra marca-del-hero-v"
            style={DESDE_LA_V}
            d={WORDMARK.parts.v}
          />
        </g>
      </svg>
    </span>
  );
}
