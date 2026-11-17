"use client";

import { toast } from "sonner";

/**
 * Avisos flotantes — DR §6.15.
 *
 * Dos funciones y nada más. La cola, el apilado, el reloj, el arrastre para
 * descartar y el `aria-live` los pone `sonner`; el aspecto lo pone
 * `components/ui/sonner.tsx`. Acá vive lo único que es de este proyecto: cómo
 * se llaman los dos tonos y cuándo va cada uno.
 *
 * **Confirman, no reportan errores.** Un error tiene que decir qué pasó, qué
 * hacer y a veces ofrecer reintentar (§8), y nada de eso entra en algo que se
 * va solo a los cuatro segundos. Los errores se quedan **donde estuvo la
 * acción**: el diálogo que falla no se cierra y lo muestra adentro.
 *
 * **Y no todo lo que sale bien lleva aviso.** Flotante cuando el lugar donde
 * pasó la cosa desapareció —un diálogo que se cerró, una fila que se borró— o
 * cuando la pantalla no cambia de forma visible. Cuando lo que pasó se ve,
 * nada: subir una foto la hace aparecer, y un cartel al lado que diga «subimos
 * la foto» es ruido.
 */

/** Salió como se pidió. Disco verde con el check. */
export function avisar(texto: string) {
  toast.success(texto);
}

/**
 * Salió, pero no como se pidió. Disco ámbar con el triángulo.
 *
 * No es un error —la acción terminó— y tampoco es lo que se apretó: el caso
 * real es «Borrar», que cuando el producto está en una orden **no borra sino
 * que desactiva** (RF-15). Con el check verde de al lado, esa frase se lee de
 * reojo como «listo, borrado», que es justo lo que no pasó.
 */
export function avisarConPero(texto: string) {
  toast.warning(texto);
}

/**
 * Hubo un despliegue mientras la página estaba abierta (2026-11-17).
 *
 * **La única excepción a «confirman y se van»**, y por eso tiene su propia
 * función. Desde ese momento la página quedó con los códigos de las Server
 * Actions del build anterior y el próximo «Guardar» falla: no hay nada que
 * confirmar, hay algo que hacer, y tiene que seguir ahí hasta que se haga.
 * Por eso no se va sola ni se puede cerrar —cerrada, la página seguiría rota
 * sin que se note—, y lleva el botón que lo resuelve.
 *
 * En ámbar y no en verde: no salió nada, se pide una acción. El `id` fijo
 * hace que llamarla dos veces no apile dos avisos.
 */
export function avisarVersionNueva() {
  toast.warning("Se actualizó AnaVende", {
    id: "version-nueva",
    description: "Recargá la página para seguir.",
    duration: Infinity,
    dismissible: false,
    action: {
      label: "Recargar",
      onClick: () => window.location.reload(),
    },
  });
}
