import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AyudaGuiada, type PasoDeAyuda } from "@/components/shop/ayuda-guiada";
import { EstadoDeLaOrden } from "@/components/shop/compras/estado";
import { Paginacion } from "@/components/shop/paginacion";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { getIdentity, getSession } from "@/lib/session";
import { POR_PAGINA } from "@/modules/catalog/products/filtros-tienda";
import {
  leerMisCompras,
  type CompraDelHistorial,
} from "@/modules/orders/queries";

export const metadata: Metadata = { title: "Mis compras" };

const RUTA = "/mi-cuenta/compras";

/**
 * La guía del listado (F6.6, RF-36): qué se hace desde un pedido y qué dice
 * su estado. Señala la primera compra; sin compras no hay guía, porque la
 * pantalla vacía ya dice qué va a aparecer. El orden y los precios no se
 * explican: los dice la bajada de la pantalla.
 */
const PASOS_DEL_LISTADO: PasoDeAyuda[] = [
  {
    elemento: "compra",
    titulo: "Todo lo que pediste",
    texto:
      "Tocá un pedido para escribirnos sobre él o, si cambiaste de idea, cancelarlo.",
  },
  {
    elemento: "estado-compra",
    titulo: "¿En qué anda?",
    texto:
      "«En preparación» quiere decir que te lo estamos guardando mientras coordinamos. Cuando lo recibís, pasa a «Entregada».",
  },
];

/**
 * «Mis compras» — RF-07. Tarea F6.5.
 *
 * El historial completo, de la más nueva a la más vieja, con **los precios de
 * cada orden y no los de hoy**: lo que se muestra sale del snapshot (RN-12),
 * así que una compra de hace tres meses sigue diciendo lo que costó.
 *
 * **Cancelar no está acá sino en el detalle**, aunque sea un clic más. RF-23
 * lo pide a la vista, y a la vista no quiere decir repetido en cada renglón de
 * una lista: un botón destructivo al lado de cada compra es el que se toca sin
 * querer. En el detalle está solo, con el pedido enfrente.
 */

type Props = {
  searchParams: Promise<{ pagina?: string | string[] }>;
};

function urlDePagina(n: number): string {
  return n === 1 ? RUTA : `${RUTA}?pagina=${n}`;
}

/** Lo que no es un entero positivo vale 1: un `?pagina=x` no es un error. */
function leerPagina(valor: string | string[] | undefined): number {
  const n = Number.parseInt(
    Array.isArray(valor) ? (valor[0] ?? "") : (valor ?? ""),
    10,
  );
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

export default async function MisCompras({ searchParams }: Props) {
  const [sesion, consulta] = await Promise.all([getSession(), searchParams]);

  if (!sesion) {
    if (await getIdentity()) redirect("/completar-perfil");
    redirect(`/ingresar?volver=${RUTA}`);
  }

  const pagina = leerPagina(consulta.pagina);
  const { compras, total } = await leerMisCompras(sesion.profile.id, {
    pagina,
  });
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  // Una página que ya no existe —un enlace viejo— lleva a la última que sí.
  if (pagina > paginas) redirect(urlDePagina(paginas));

  return (
    <section aria-labelledby="titulo" className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 id="titulo" className="text-heading text-ink">
            Mis compras
          </h2>
          {total > 0 ? (
            <AyudaGuiada
              id="mis-compras"
              pasos={PASOS_DEL_LISTADO}
              className="-mr-2"
            />
          ) : null}
        </div>
        {total > 0 ? (
          <p className="text-body text-ink-secondary">
            Tocá una para ver el detalle. Los precios son los del día que la
            hiciste.
          </p>
        ) : null}
      </header>

      {total === 0 ? (
        <SinCompras />
      ) : (
        <ul className="flex flex-col gap-3">
          {compras.map((compra, i) => (
            <li key={compra.numero}>
              <RenglonDeCompra compra={compra} primera={i === 0} />
            </li>
          ))}
        </ul>
      )}

      <Paginacion pagina={pagina} paginas={paginas} href={urlDePagina} />
    </section>
  );
}

/**
 * Un renglón del historial.
 *
 * **La tarjeta entera es el enlace**, no un «Ver detalle» al costado: es la
 * única acción que tiene el renglón, y un área táctil del alto de la tarjeta
 * se acierta con el pulgar (§9).
 */
function RenglonDeCompra({
  compra,
  primera,
}: {
  compra: CompraDelHistorial;
  /** La que señala la guía (F6.6). */
  primera: boolean;
}) {
  return (
    <Link
      href={`${RUTA}/${compra.numero}`}
      data-ayuda={primera ? "compra" : undefined}
      className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-md transition-colors duration-150 hover:bg-surface-sunken"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-body-sm font-medium text-ink">
            Pedido #{compra.numero}
          </span>
          <span data-ayuda={primera ? "estado-compra" : undefined}>
            <EstadoDeLaOrden estado={compra.estado} />
          </span>
        </div>
        <p className="truncate text-body-sm text-ink-secondary">
          {compra.resumen}
        </p>
        <p className="text-caption text-ink-secondary tabular-nums">
          <Fecha iso={compra.creadaEn} /> · {compra.unidades}{" "}
          {compra.unidades === 1 ? "unidad" : "unidades"}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span className="text-body font-medium text-ink tabular-nums">
          {formatMoney(compra.total)}
        </span>
        <ChevronRight aria-hidden className="size-4 text-ink-secondary" />
      </div>
    </Link>
  );
}

/**
 * La fecha, en `es-AR` y en el servidor.
 *
 * **Se formatea acá y no en el navegador** a propósito: hacerlo en el cliente
 * significa que el servidor pinta una cosa y la hidratación pinta otra, que es
 * el parpadeo que §8 pide evitar. La zona horaria es la del servidor y no la
 * de quien mira, y para «12 de septiembre» eso no cambia nada.
 */
function Fecha({ iso }: { iso: string }) {
  const formateada = new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return <time dateTime={iso}>{formateada}</time>;
}

/** §8: explicar qué falta y ofrecer la acción. */
function SinCompras() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface px-6 py-16 text-center shadow-md">
      <h3 className="text-heading text-ink">Todavía no compraste nada</h3>
      <p className="max-w-prose text-body text-ink-secondary">
        Cuando confirmes un pedido lo vas a ver acá, con su estado y su detalle.
      </p>
      <Button asChild variant="brand" size="lg" className="mt-2">
        <Link href="/productos">Explorar el catálogo</Link>
      </Button>
    </div>
  );
}
