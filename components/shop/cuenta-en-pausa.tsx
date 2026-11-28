"use client";

import { createContext, useContext, type ReactNode } from "react";

import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";

/**
 * La cuenta en pausa: el comprador pidió la baja (RF-34) y es de solo
 * lectura. Lo hace cumplir `lib/action.ts`; esto es para que la pantalla no
 * ofrezca botones que van a fallar.
 */

const CuentaEnPausa = createContext(false);

export function ProveedorDeCuentaEnPausa({
  enPausa,
  children,
}: {
  enPausa: boolean;
  children: ReactNode;
}) {
  return <CuentaEnPausa value={enPausa}>{children}</CuentaEnPausa>;
}

export function useCuentaEnPausa(): boolean {
  return useContext(CuentaEnPausa);
}

/** Apaga el control y lo apunta al aviso que dice por qué. */
export function propsDePausa(enPausa: boolean) {
  return enPausa
    ? { disabled: true, "aria-describedby": ID_AVISO_DE_PAUSA }
    : {};
}
