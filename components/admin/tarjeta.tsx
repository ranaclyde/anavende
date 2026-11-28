/** La tarjeta de sección del panel — DR §6.13. */
export function TarjetaDeSeccion({
  id,
  titulo,
  insignias,
  ayuda,
  acciones,
  "data-ayuda": guia,
  children,
}: {
  /**
   * El identificador del título, único en la pantalla. Se pide porque estas
   * tarjetas se pintan en el servidor, donde `useId` no corre.
   */
  id: string;
  titulo: React.ReactNode;
  /** Las píldoras de estado, al lado del título. */
  insignias?: React.ReactNode;
  ayuda?: React.ReactNode;
  acciones?: React.ReactNode;
  /** El paso de una guía de uso que señala esta sección. */
  "data-ayuda"?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      data-ayuda={guia}
      className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4"
    >
      <div
        className={`flex flex-wrap justify-between gap-3 ${
          ayuda ? "items-start" : "items-center"
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* El margen es para los enlaces a esta sección: en el teléfono la
                barra de arriba es fija y tapaba el título. */}
            <h2
              id={id}
              className="scroll-mt-20 text-body font-medium text-ink lg:scroll-mt-6"
            >
              {titulo}
            </h2>
            {insignias}
          </div>
          {ayuda ? (
            <p className="text-body-sm text-ink-secondary">{ayuda}</p>
          ) : null}
        </div>
        {acciones}
      </div>

      {children}
    </section>
  );
}

/**
 * Una parte de una tarjeta que se guarda con un botón (DESIGN.md, «Guardar»).
 * Es un grupo con nombre y no una región: la región es la tarjeta.
 */
export function Apartado({
  primero = false,
  id,
  titulo,
  ayuda,
  "data-ayuda": guia,
  children,
}: {
  /** El primero va pegado al título de la tarjeta, sin línea de por medio. */
  primero?: boolean;
  id: string;
  titulo: string;
  ayuda?: string;
  /** El paso de una guía de uso que señala este apartado. */
  "data-ayuda"?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="group"
      aria-labelledby={id}
      data-ayuda={guia}
      className={`flex flex-col gap-4 ${primero ? "" : "border-t border-border pt-4"}`}
    >
      <div className="flex flex-col gap-1">
        <h3
          id={id}
          className="scroll-mt-20 text-body-sm font-medium text-ink lg:scroll-mt-6"
        >
          {titulo}
        </h3>
        {ayuda ? (
          <p className="text-body-sm text-ink-secondary">{ayuda}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/**
 * El pie de una tarjeta que se guarda con un botón: la línea, el error
 * general, el estado y los botones, a la derecha.
 */
export function PieDeGuardado({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
      {children}
    </div>
  );
}
