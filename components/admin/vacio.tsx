import type { LucideIcon } from "lucide-react";

/**
 * Estado vacío de una pantalla del panel — DR §6.9 y §8. «Todavía no hay
 * ninguno» lleva ícono; «nada coincide con los filtros», no.
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
  titulo: React.ReactNode;
  /** De dónde sale lo que va a aparecer acá, o qué probar. */
  children?: React.ReactNode;
  accion?: React.ReactNode;
  /** Adentro de una tarjeta: se hunde el fondo y se acorta el alto. */
  dentro?: boolean;
  /**
   * `h2` cuando el vacío reemplaza al contenido principal de la pantalla (un
   * formulario, por ejemplo); `p` cuando reemplaza una tabla.
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

      {/* `gap-1`: el aire entre título y explicación es menor que hasta el ícono. */}
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
