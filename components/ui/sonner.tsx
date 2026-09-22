"use client";

import { Check, TriangleAlert } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * El contenedor de los avisos flotantes — DR §6.15.
 *
 * Es el `sonner` de shadcn con tres cambios, y los tres tienen motivo:
 *
 * **Sin `next-themes`.** La receta original lee el tema con `useTheme` y se lo
 * pasa a `sonner` para que elija su paleta. Acá el tema es `data-theme` en
 * `<html>`, puesto por un script que corre antes de pintar (`theme.tsx`), y
 * los colores salen de los tokens del proyecto, que ya se dan vuelta solos.
 * Pedirle a `sonner` que además tenga su propio tema sería dos fuentes para
 * el mismo color.
 *
 * **`unstyled`.** `sonner` trae su propia hoja, y sus selectores
 * —`[data-sonner-toast]`— pesan lo mismo que una utilidad de Tailwind: quién
 * gana depende del orden en que queden las hojas, que no es algo sobre lo que
 * valga la pena apostar. Apagadas sus reglas de aspecto, el aviso se dibuja
 * entero con los tokens del panel y no hay empate que resolver. Lo que sí
 * queda de la biblioteca es todo lo demás: la cola, el apilado, el reloj que
 * se detiene al pasar el puntero, arrastrar para descartar, el foco y el
 * `aria-live`.
 *
 * **Va adentro de `MarcoDeEscala` y no al final del `<body>`.** `sonner` no
 * usa un portal —se dibuja donde se lo monta y se posiciona con `fixed`—, así
 * que puesto adentro hereda el `data-scale="admin"` y la variante `admin:`
 * funciona sin repetir el truco de `escala.tsx`.
 */
/**
 * El ícono de cada tono: un glifo **relleno dentro de un disco de color**, no
 * un trazo suelto. Es lo que hace que el aviso se lea de reojo, que es todo
 * lo que un aviso tiene que lograr.
 *
 * El disco va en el color semántico y el glifo en su tinte, y no al revés ni
 * en blanco fijo: en claro eso da un disco verde oscuro con el check casi
 * blanco, y en oscuro el par se da vuelta solo —verde claro con el glifo casi
 * negro—. Con blanco fijo, el check sobre el verde del modo oscuro (`#4ade80`)
 * queda en 1,5:1 y §9 pide 3:1 para un objeto gráfico.
 */
function Disco({
  tono,
  children,
}: {
  tono: "exito" | "pero";
  children: React.ReactNode;
}) {
  return (
    <span
      aria-hidden
      className={`grid size-5 place-items-center rounded-pill ${
        tono === "exito"
          ? "bg-success text-success-tint"
          : "bg-warning text-warning-tint"
      }`}
    >
      {children}
    </span>
  );
}

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="bottom-right"
      // Cuatro segundos: alcanza para leer un renglón y no se hace esperar.
      duration={4000}
      // Tres a la vez. Más no se leen, y el cuarto empujaría al primero fuera
      // de la pantalla antes de que nadie lo mire.
      visibleToasts={3}
      // Apilados y no en abanico: se despliegan al pasar el puntero.
      expand={false}
      containerAriaLabel="Avisos"
      icons={{
        success: (
          <Disco tono="exito">
            <Check className="size-3.5" strokeWidth={3} />
          </Disco>
        ),
        warning: (
          <Disco tono="pero">
            <TriangleAlert className="size-3" strokeWidth={2.75} />
          </Disco>
        ),
      }}
      // Sin esto los avisos quedan pegados al borde en el teléfono.
      mobileOffset={{ left: 16, right: 16, bottom: 16 }}
      offset={{ right: 24, bottom: 24 }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Cerrar el aviso",
        classNames: {
          toast: [
            "flex w-full items-start gap-3 rounded-panel-card border border-border",
            "bg-surface p-3 text-body-sm text-ink shadow-lg",
          ].join(" "),
          icon: "mt-px flex shrink-0",
          content: "flex min-w-0 flex-1 flex-col gap-0.5",
          title: "font-medium",
          description: "text-caption text-ink-secondary",
        },
      }}
      {...props}
    />
  );
}
