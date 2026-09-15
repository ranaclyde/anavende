import { nombreDelEstado } from "@/components/admin/ordenes/estado";
import { fechaConHora } from "@/lib/fechas";
import type { EntradaDelHistorial } from "@/modules/orders/queries-panel";

/**
 * El historial de estados de una orden — RF-21, RF-13, RF-23. Tarea F7.1.
 *
 * Es lo que contesta «¿y esto por qué está cancelado?» sin preguntarle a
 * nadie: cada transición con su fecha, su autor y su motivo, de la más vieja
 * a la más nueva, que es como se lee una historia.
 *
 * **Distingue el arrepentimiento de la cancelación de la vendedora**, que es
 * para lo que RF-23 pidió que quedara registrado quién canceló: una la pidió
 * el comprador desde «Mis compras» (F6.5) y la otra la decidió el panel, y
 * son dos conversaciones distintas con la misma persona.
 *
 * **Un autor en blanco no es un error.** El alta de la orden no tiene autor
 * en el checkout —la hace el comprador a través del sistema—, y el perfil de
 * quien la movió pudo dejar de existir (`actor_user_id` es `SET NULL`).
 */
export function HistorialDeLaOrden({
  entradas,
}: {
  entradas: EntradaDelHistorial[];
}) {
  if (entradas.length === 0) return null;

  return (
    <section
      aria-labelledby="historial"
      className="flex flex-col gap-3 rounded-panel-card border border-border bg-surface p-4"
    >
      <h2 id="historial" className="text-body-sm font-medium text-ink">
        Historial
      </h2>

      <ol className="flex flex-col gap-3">
        {entradas.map((e, i) => (
          <li
            key={`${e.cuando}-${i}`}
            className="flex flex-col gap-0.5 border-l-2 border-border pl-3"
          >
            <p className="text-body-sm text-ink">{quePaso(e)}</p>
            <p className="text-caption text-ink-secondary tabular-nums">
              {fechaConHora(e.cuando)}
              {e.autor ? ` · ${e.autor}` : ""}
              {e.esElComprador ? " (el comprador)" : ""}
            </p>
            {e.motivo ? (
              <p className="text-caption text-ink-secondary">
                Motivo: {e.motivo}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * La transición en palabras.
 *
 * La primera fila de toda orden es `null → activa`, que no es un cambio sino
 * el nacimiento: decir «de nada a activa» sería repetir la implementación en
 * la pantalla.
 */
function quePaso(e: EntradaDelHistorial): string {
  if (e.desde === null) return "Se creó la orden";
  return `${nombreDelEstado(e.desde)} → ${nombreDelEstado(e.hacia)}`;
}
