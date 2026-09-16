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
            {/* En una edición el motivo YA ES el titular de arriba: repetirlo
                acá bajo «Motivo:» sería decir dos veces lo mismo, y además
                «motivo» es la palabra de RF-23 —por qué se canceló—, no la de
                un renglón que se sacó. */}
            {e.motivo && !esUnaEdicion(e) ? (
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
 * Una edición de RF-22 —quitar un renglón, bajar una cantidad—, que
 * `editar.ts` escribe como `activa → activa`.
 *
 * La tabla del historial es la de ESTADOS y una edición no cambia el estado,
 * pero es el único historial que tiene la orden: F4.4 decidió ensanchar su
 * uso antes que partir la línea de tiempo en dos tablas que la pantalla
 * después tendría que volver a unir.
 */
function esUnaEdicion(e: EntradaDelHistorial): boolean {
  return e.desde !== null && e.desde === e.hacia;
}

/**
 * La transición en palabras.
 *
 * La primera fila de toda orden es `null → activa`, que no es un cambio sino
 * el nacimiento: decir «de nada a activa» sería repetir la implementación en
 * la pantalla. Y una edición **no se anuncia como «Activa → Activa»**, que es
 * la cañería asomándose: el propio motivo —«Se quitó "Auricular Cloud II"»—
 * ya dice qué pasó, y mejor que cualquier resumen.
 *
 * **Una orden manual puede nacer finalizada** (RF-24, F7.4), y entonces esa
 * primera fila es `null → finalizada`: nunca estuvo activa, así que no hay
 * una segunda fila que contar. Se dice completo, porque «Se creó la orden» a
 * secas dejaría sin explicar por qué el stock se descontó de una.
 */
function quePaso(e: EntradaDelHistorial): string {
  if (e.desde === null) {
    return e.hacia === "activa"
      ? "Se creó la orden"
      : `Se creó la orden, ya ${nombreDelEstado(e.hacia).toLowerCase()}`;
  }
  if (esUnaEdicion(e)) return e.motivo ?? "Se editó la orden";
  return `${nombreDelEstado(e.desde)} → ${nombreDelEstado(e.hacia)}`;
}
