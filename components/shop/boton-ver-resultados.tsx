"use client";

/**
 * «Ver N productos» — cierra el panel de filtros (§7.2).
 *
 * **Es la única línea de JavaScript del panel, y existe por una sola razón:**
 * un `<details>` nativo no se puede cerrar desde adentro sin script. Sin este
 * botón, la única forma de cerrar es volver a subir hasta «Filtros», que es
 * justo el gesto que nadie encuentra después de elegir tres cosas.
 *
 * No lleva estado ni contexto: busca su propio `<details>` en el DOM y le
 * saca el atributo. Por eso puede vivir dentro de un panel que es servidor
 * entero — la isla es este botón, no el panel.
 *
 * **Degrada.** El `href` es real: sin JavaScript no cierra nada, pero baja a
 * la grilla, que es a dónde la persona quería ir. Con JavaScript se cancela
 * el salto —en escritorio la grilla ya está a la vista y saltar marea— y solo
 * se cierra.
 */
export function BotonVerResultados({ etiqueta }: { etiqueta: string }) {
  return (
    <a
      href="#resultados"
      onClick={(e) => {
        const panel = e.currentTarget.closest("details");
        if (!panel) return;
        e.preventDefault();
        panel.removeAttribute("open");
      }}
      // `max-md:flex-1`: en la hoja de teléfono el pie es una franja sola y
      // este es el único botón. Al tamaño de su texto queda arrinconado a la
      // derecha con media franja vacía al lado, y un botón principal que no
      // ocupa el ancho que tiene disponible se lee como secundario.
      className="inline-flex h-11 items-center justify-center rounded-pill bg-brand px-6 text-body-sm font-medium text-ink-inverse transition-colors duration-150 max-md:flex-1 hover:bg-brand-hover active:bg-brand-active focus-visible:shadow-focus focus-visible:outline-none"
    >
      {etiqueta}
    </a>
  );
}
