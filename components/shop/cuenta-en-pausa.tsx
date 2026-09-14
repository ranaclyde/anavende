"use client";

import { createContext, useContext, type ReactNode } from "react";

import { ID_AVISO_DE_PAUSA } from "@/components/shop/cuenta-en-pausa-id";

/**
 * La cuenta en pausa: el comprador pidió la baja — RF-34, F5.8.
 *
 * Mientras está pedida, la cuenta es de solo lectura (decisión del
 * 2026-09-14): se puede mirar, pero no comprar, ni guardar favoritos, ni
 * cambiar datos, contraseña o direcciones. **Quien lo hace cumplir es el
 * envoltorio de acciones** (`lib/action.ts`, paso 2b); esto es para que la
 * pantalla no ofrezca botones que van a fallar.
 *
 * Los controles apagados apuntan con `aria-describedby` al aviso de arriba de
 * la tienda, que es el que dice por qué (§8: nada deshabilitado sin motivo).
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

/** Lo que va en un control apagado por la pausa. */
export function propsDePausa(enPausa: boolean) {
  return enPausa
    ? { disabled: true, "aria-describedby": ID_AVISO_DE_PAUSA }
    : {};
}
