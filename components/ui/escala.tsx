"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Las dos escalas de densidad de DESIGN-REFERENCE §4 — 16px en la tienda,
 * 14px en el panel—, y cómo llegan a lo que se pinta en un portal.
 *
 * **El problema.** La escala es una variante de CSS, no una prop: el panel
 * marca `data-scale="admin"` en su raíz y `@custom-variant admin` hace que
 * los componentes compartidos se adapten solos, sin que existan dos `Button`
 * ni dos `Input`. Eso funciona para todo lo que está debajo de esa raíz.
 *
 * Los diálogos, los menús y los globos de ayuda **no están debajo**: Radix
 * los saca por un portal a `document.body` para que ningún `overflow` los
 * recorte. Ahí arriba ya no hay `data-scale`, así que un diálogo abierto
 * desde el panel se pintaba con la escala de la tienda —texto de 16px,
 * campos con forma de píldora— aunque su clase `admin:` estuviera puesta.
 * Venía así desde F2.6 y se vio en F7.2.
 *
 * **Por qué un contexto y no `document.querySelector`.** Buscar la raíz del
 * panel en el DOM también funcionaría, y es la clase de atajo que anda hasta
 * que algo se pinta en el servidor o hay dos raíces. Acá la escala la declara
 * quien la impone y se lee donde hace falta, que es lo mismo que ya hace el
 * atributo — sólo que además viaja por el árbol de React, que es por donde
 * viaja el portal.
 *
 * **El modo oscuro no tiene este problema**: `data-theme` vive en `<html>`,
 * y `document.body` está adentro.
 */

export type Escala = "tienda" | "admin";

const Contexto = React.createContext<Escala>("tienda");

/**
 * Marca una escala. Pone el atributo **y** provee el contexto, para que no
 * puedan discrepar: es un solo lugar que dice «de acá para abajo, el panel».
 */
export function MarcoDeEscala({
  escala,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { escala: Escala }) {
  return (
    <Contexto value={escala}>
      <div
        data-scale={escala === "admin" ? "admin" : undefined}
        className={cn(className)}
        {...props}
      >
        {children}
      </div>
    </Contexto>
  );
}

/**
 * Lo que hay que ponerle a un contenido que viaja en un portal para que
 * herede la escala de donde se abrió. `undefined` en la tienda: sin atributo,
 * que es exactamente lo que la escala por omisión significa.
 */
export function useDataScale(): "admin" | undefined {
  return React.useContext(Contexto) === "admin" ? "admin" : undefined;
}
