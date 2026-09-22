/**
 * La tarjeta de sección del panel — DR §4, §6.9 y §9.
 *
 * Estaba escrita **cinco veces**: `Seccion` en `components/admin/formulario.tsx`,
 * `Tarjeta` en la ficha de usuario, `Ficha` en la de orden, una suelta en el
 * historial y ocho más a mano en los formularios. El informe del 2026-09-18
 * contó tres; mirando todas las `<section>` del panel eran **quince tarjetas
 * con tres paddings, tres separaciones y tres tamaños de título**.
 *
 * Lo que se unificó, y por qué cada cosa quedó donde quedó:
 *
 * - **`p-4`, 16px.** §4 fija 12–16px para el panel, y nueve de las quince
 *   estaban en 20px (`p-5` o `sm:p-5`) sin que la desviación estuviera
 *   anotada en ningún lado. Gana lo escrito.
 * - **El título en `body` de 16px con medium** (decisión tuya del 2026-09-21).
 *   Los formularios lo tenían en 20px y las fichas en 14, para el mismo nivel
 *   jerárquico; a 14px el título de una sección medía lo mismo que el rótulo
 *   de un campo y dejaba de separar. Es además el tamaño del título de
 *   `VacioDelPanel`, así que el panel tiene una sola voz para «esto es una
 *   sección».
 * - **Se anuncia como región** (`aria-labelledby`, decisión tuya del mismo
 *   día). Antes lo hacían cuatro de quince: las otras once eran un `<section>`
 *   sin nombre accesible, que para un lector de pantalla no es una región
 *   sino un contenedor más. Con nombre, se salta entre «Comprador», «Envío» e
 *   «Historial» sin recorrer el contenido.
 * - **La alineación del encabezado la decide la ayuda**, igual que en el
 *   encabezado de pantalla (§6.12): con ayuda son dos renglones y va
 *   `items-start`; sin ayuda es uno y va `items-center`.
 */
export function TarjetaDeSeccion({
  id,
  titulo,
  insignias,
  ayuda,
  acciones,
  children,
}: {
  /**
   * El identificador del título, único en la pantalla. Se pide en vez de
   * generarlo porque estas tarjetas se pintan en el servidor, donde `useId`
   * no corre — y de paso el id queda legible y estable.
   */
  id: string;
  titulo: React.ReactNode;
  /** Las píldoras de estado, al lado del título — el mismo hueco que §6.12. */
  insignias?: React.ReactNode;
  /** Una frase sobre qué es esta sección. */
  ayuda?: React.ReactNode;
  /** Lo que se puede hacer sobre la sección entera, arriba a la derecha. */
  acciones?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-panel-card border border-border bg-surface p-4"
    >
      <div
        className={`flex flex-wrap justify-between gap-3 ${
          ayuda ? "items-start" : "items-center"
        }`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={id} className="text-body font-medium text-ink">
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
