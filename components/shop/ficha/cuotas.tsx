import { ChevronDown, CreditCard } from "lucide-react";

import { formatMoney } from "@/lib/money";
import { AREA_TACTIL, cn } from "@/lib/utils";
import type {
  PromocionDeLaFicha,
  PromocionesDeLaFicha,
} from "@/modules/settings/promociones";

/**
 * Las promociones de cuotas, debajo del precio — RF-40, F2.17.
 *
 * **Una sola a la vista**, la que eligió `promocionesParaElPrecio`; las demás
 * detrás de «Ver más opciones». Cinco renglones de cuotas debajo del precio
 * le compiten al precio, que es lo primero que se tiene que leer.
 *
 * **`<details>` nativo y Server Component**: abrir y cerrar no necesita
 * estado de React, y así no viaja una línea de JavaScript para esto. El
 * teclado y el lector de pantalla lo entienden sin `aria-*` a mano.
 *
 * En gris y no en burdeos: el burdeos es de lo accionable y de la oferta
 * (§6.7). Esto informa; lo que se resalta es la cuota, con peso y tinta.
 */
export function CuotasDeLaFicha({
  promociones,
}: {
  promociones: PromocionesDeLaFicha;
}) {
  const { destacada, resto } = promociones;
  if (!destacada) return null;

  return (
    <div className="flex flex-col gap-1 pt-1 text-body-sm text-ink-secondary">
      <p className="flex items-start gap-2">
        <CreditCard aria-hidden className="mt-[3px] size-4 shrink-0" />
        <Renglon promocion={destacada} />
      </p>

      {resto.length === 0 ? null : (
        <details className="group/cuotas pl-6">
          <summary
            className={cn(
              "relative inline-flex w-fit cursor-pointer list-none items-center gap-1 rounded-pill",
              "underline decoration-border-strong underline-offset-4 hover:text-ink hover:decoration-ink-secondary",
              "[&::-webkit-details-marker]:hidden",
              AREA_TACTIL,
            )}
          >
            <span className="group-open/cuotas:hidden">
              Ver más opciones ({resto.length})
            </span>
            <span className="hidden group-open/cuotas:inline">
              Ver menos opciones
            </span>
            <ChevronDown
              aria-hidden
              className="size-4 transition-transform duration-200 group-open/cuotas:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <ul className="flex flex-col gap-1 pt-2">
            {resto.map((p) => (
              <li key={p.id}>
                <Renglon promocion={p} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * «Mismo precio en **3 cuotas de $ 12.333,34** con Go Cuotas». Lo que se
 * resalta es lo que se compara entre promociones: cuántas y de cuánto.
 */
function Renglon({ promocion: p }: { promocion: PromocionDeLaFicha }) {
  return (
    <span>
      {p.sinRecargo ? "Mismo precio en " : null}
      <strong className="font-semibold text-ink tabular-nums">
        {p.cuotas} cuotas de {formatMoney(p.cuota)}
      </strong>{" "}
      con {p.medio}
    </span>
  );
}
