import type { LucideIcon } from "lucide-react";

/**
 * Estado vacío de una pantalla del panel — DR §6.9 y §8.
 *
 * §6.9 pide «ilustración mínima + explicación + acción sugerida», y hasta el
 * 2026-09-21 **de trece vacíos uno solo tenía ícono**. No era un descuido de
 * una pantalla: no existía el componente, así que cada una lo resolvió con lo
 * que tenía a mano y quedaron cuatro markups. Tres eran una línea de texto
 * gris y un botón, sin explicación ninguna.
 *
 * **Son dos situaciones y no una**, y por eso el ícono es opcional:
 *
 * - **Todavía no hay ninguno.** Se entra por primera vez y no hay nada que
 *   mirar. Lleva ícono, porque hay que llenar una pantalla entera y decir en
 *   qué sección se está parado; lleva explicación, porque quien mira no sabe
 *   todavía de dónde sale lo que va a aparecer acá; y lleva la acción, que es
 *   el primer paso.
 * - **Nada coincide con los filtros.** Se llega buscando, aparece y
 *   desaparece con cada tecla. **Sin ícono**: quien filtró sabe perfectamente
 *   dónde está, y un dibujo que parpadea mientras se escribe es ruido. La
 *   acción acá es siempre la salida: limpiar.
 */
export function VacioDelPanel({
  icono: Icono,
  titulo,
  children,
  accion,
  dentro = false,
  como: Titulo = "p",
}: {
  /** El ícono del «todavía no hay ninguno». El «nada coincide» no lleva. */
  icono?: LucideIcon;
  /** Qué pasa, en una frase. */
  titulo: React.ReactNode;
  /** De dónde sale lo que va a aparecer acá, o qué probar. */
  children?: React.ReactNode;
  /** El primer paso, o la salida. */
  accion?: React.ReactNode;
  /**
   * Va adentro de una tarjeta y no suelto sobre la pantalla: se hunde el
   * fondo para que no se lea como una tarjeta apoyada sobre otra, y se acorta
   * el alto, que ahí adentro no hay una pantalla que llenar.
   */
  dentro?: boolean;
  /**
   * `h2` cuando el vacío **reemplaza al contenido principal** de la pantalla
   * —«Antes hay que cargar una marca», que está en lugar del formulario—: ahí
   * es la única referencia que tiene un lector de pantalla después del `h1`.
   * Un vacío que reemplaza una tabla sigue siendo `p`: la tabla tampoco tenía
   * encabezado propio.
   */
  como?: "p" | "h2";
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-panel-card border border-dashed border-border text-center ${
        dentro ? "bg-surface-sunken px-6 py-10" : "bg-surface px-6 py-12"
      }`}
    >
      {Icono ? (
        <span
          aria-hidden
          className="grid size-12 place-items-center rounded-full bg-surface-sunken text-ink-tertiary"
        >
          <Icono className="size-5" />
        </span>
      ) : null}

      {/* El título y su explicación son un bloque con `gap-1`: el aire entre
          los dos no es el mismo que hay hasta el ícono y hasta el botón. */}
      <div className="flex flex-col items-center gap-1">
        <Titulo className="text-body font-medium text-ink">{titulo}</Titulo>
        {children ? (
          <p className="max-w-prose text-body-sm text-ink-secondary">
            {children}
          </p>
        ) : null}
      </div>

      {accion}
    </div>
  );
}
