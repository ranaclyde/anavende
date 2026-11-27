import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { nombreDelEstado } from "@/components/admin/ordenes/estado";
import { fechaConHora } from "@/lib/fechas";
import type { EntradaDelHistorial } from "@/modules/orders/queries-panel";

/**
 * Un autor en blanco no es un error: el alta desde el checkout no tiene autor,
 * y `actor_user_id` es `SET NULL` si se borra el perfil.
 */
export function HistorialDeLaOrden({
  entradas,
}: {
  entradas: EntradaDelHistorial[];
}) {
  if (entradas.length === 0) return null;

  // Largo, se pliega el medio: quedan a la vista la primera y las últimas.
  const plegadas =
    entradas.length > ANTES_DE_PLEGAR
      ? entradas.slice(1, entradas.length - ULTIMAS)
      : [];
  const primera = plegadas.length ? entradas.slice(0, 1) : entradas;
  const ultimas = plegadas.length ? entradas.slice(-ULTIMAS) : [];

  return (
    <TarjetaDeSeccion id="historial" titulo="Historial">
      <ol className="flex flex-col gap-3">
        {primera.map((e, i) => (
          <Entrada key={`${e.cuando}-${i}`} entrada={e} />
        ))}
        {plegadas.length ? (
          <li>
            <details className="group">
              <summary className="cursor-pointer rounded-panel-control py-1 text-body-sm text-ink-secondary hover:text-ink">
                {plegadas.length === 1
                  ? "Ver 1 cambio más"
                  : `Ver ${plegadas.length} cambios más`}
              </summary>
              <ol className="mt-3 flex flex-col gap-3">
                {plegadas.map((e, i) => (
                  <Entrada key={`${e.cuando}-${i}`} entrada={e} />
                ))}
              </ol>
            </details>
          </li>
        ) : null}
        {ultimas.map((e, i) => (
          <Entrada key={`${e.cuando}-${i}`} entrada={e} />
        ))}
      </ol>
    </TarjetaDeSeccion>
  );
}

const ANTES_DE_PLEGAR = 6;
const ULTIMAS = 4;

function Entrada({ entrada: e }: { entrada: EntradaDelHistorial }) {
  return (
    <li className="flex flex-col gap-0.5 border-l-2 border-border pl-3">
      <p className="text-body-sm text-ink">{quePaso(e)}</p>
      <p className="text-caption text-ink-secondary tabular-nums">
        {fechaConHora(e.cuando)}
        {e.autor ? ` · ${e.autor}` : ""}
        {e.esElComprador ? " (el comprador)" : ""}
      </p>
      {/* En una edición el motivo ya es el titular de arriba. */}
      {e.motivo && !esUnaEdicion(e) ? (
        <p className="text-caption text-ink-secondary">Motivo: {e.motivo}</p>
      ) : null}
    </li>
  );
}

/** Una edición (RF-22) queda en el historial como `activa → activa`. */
function esUnaEdicion(e: EntradaDelHistorial): boolean {
  return e.desde !== null && e.desde === e.hacia;
}

/** Una orden manual puede nacer finalizada (RF-24): `null → finalizada`. */
function quePaso(e: EntradaDelHistorial): string {
  if (e.desde === null) {
    return e.hacia === "activa"
      ? "Se creó la orden"
      : `Se creó la orden, ya ${nombreDelEstado(e.hacia).toLowerCase()}`;
  }
  if (esUnaEdicion(e)) return e.motivo ?? "Se editó la orden";
  return `${nombreDelEstado(e.desde)} → ${nombreDelEstado(e.hacia)}`;
}
