"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Escala de densidad, tienda o panel (DR §4). Lo que Radix saca por portal a
 * `document.body` queda fuera del `data-scale` de la raíz del panel; el
 * contexto lleva la escala hasta ahí para que el contenido la repita.
 */

export type Escala = "tienda" | "admin";

const Contexto = React.createContext<Escala>("tienda");

/** Pone el atributo y provee el contexto juntos, para que no discrepen. */
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

/** El `data-scale` que tiene que repetir un contenido que viaja en un portal. */
export function useDataScale(): "admin" | undefined {
  return React.useContext(Contexto) === "admin" ? "admin" : undefined;
}
