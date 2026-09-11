"use client";

import { useId } from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Selector de cantidad — RF-03, RF-08.
 *
 * Nació en la ficha (F3.5) y salió a su propio archivo en F5.5, cuando el
 * carrito necesitó el mismo control en cada renglón: dos copias del mismo
 * selector son dos lugares donde el tope se puede calcular distinto.
 *
 * El campo es `type="number"` y no dos botones sobre un número pintado:
 * llevar de 1 a 12 a fuerza de clics es once clics, y escribirlo es uno. Las
 * flechas quedan igual porque de 1 a 2 el clic es más rápido que el teclado.
 */
export function Cantidad({
  valor,
  maximo,
  onCambio,
  etiqueta = "Cantidad",
}: {
  valor: number;
  maximo: number;
  onCambio: (n: number) => void;
  /**
   * Lo que anuncia el lector de pantalla. En el carrito hay un selector por
   * renglón, y cinco campos que se llaman «Cantidad» no dicen de qué.
   */
  etiqueta?: string;
}) {
  // `useId` y no un `id` escrito: el carrito dibuja uno por renglón, y dos
  // campos con el mismo `id` dejan a la etiqueta apuntando al primero.
  const id = useId();
  const acotar = (n: number) => Math.min(Math.max(1, n), maximo);

  return (
    // `p-0.5` con botones de 44: 48px de alto, que es la altura de campo de
    // la tienda (§6.6), y cada flecha llega al mínimo táctil de §9.
    <div className="flex items-center gap-0.5 rounded-pill border border-border bg-surface p-0.5">
      <Button
        type="button"
        size="icon"
        variant="tertiary"
        disabled={valor <= 1}
        onClick={() => onCambio(acotar(valor - 1))}
      >
        <Minus aria-hidden />
        <span className="sr-only">Quitar uno</span>
      </Button>

      <label className="sr-only" htmlFor={id}>
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={maximo}
        value={valor}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          // Un campo vacío no vuelve a 1 de un salto mientras se escribe: se
          // ignora, y el valor válido sigue en pantalla.
          if (!Number.isNaN(n)) onCambio(acotar(n));
        }}
        className="w-10 bg-transparent text-center text-body font-medium tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />

      <Button
        type="button"
        size="icon"
        variant="tertiary"
        disabled={valor >= maximo}
        onClick={() => onCambio(acotar(valor + 1))}
      >
        <Plus aria-hidden />
        <span className="sr-only">Agregar uno</span>
      </Button>
    </div>
  );
}
