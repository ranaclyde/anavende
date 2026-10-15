"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  formatMoney,
  formatMoneyCorto,
  paraDibujar,
  type Money,
} from "@/lib/money";
import type { PuntoDeVentas } from "@/modules/reports/queries";

/**
 * Los gráficos de los reportes y del inicio del panel — RF-28, RF-14. F9.1.
 *
 * **Acromáticos, a propósito** (DESIGN.md, «la regla de una sola voz»): el
 * burdeos es la acción y la identidad, y una barra no es ninguna de las dos.
 * Las barras van en `--ink-secondary` —4,9:1 sobre blanco, 7:1 en oscuro, por
 * encima del 3:1 que piden los gráficos— y la que se señala sube a `--ink`.
 * Los dos tokens ya se redefinen en modo oscuro, así que el gráfico no tiene
 * un tema propio que mantener.
 *
 * **Los montos llegan como texto y se convierten acá, sólo para dibujar**
 * (`paraDibujar`): las sumas ya vinieron hechas de SQL, y el número exacto que
 * se lee —en el globo y en las tablas— sale siempre de `formatMoney`.
 */

const BARRA = "var(--ink-secondary)";
const BARRA_SENALADA = "var(--ink)";

// ── Ventas en el tiempo ─────────────────────────────────────────────────

const DIA = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const MES = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const MES_CORTO = new Intl.DateTimeFormat("es-AR", {
  month: "short",
  timeZone: "UTC",
});

function aFecha(dia: string): Date {
  return new Date(`${dia}T00:00:00Z`);
}

const configDeVentas = {
  vendido: { label: "Vendido", color: BARRA },
} satisfies ChartConfig;

type ColumnaDeVentas = {
  fecha: string;
  /** `null` en los días que todavía no llegaron: sin columna, ni en cero. */
  vendido: number | null;
  monto: Money;
  ordenes: number;
};

/**
 * Lo vendido por día —o por mes—, en columnas.
 *
 * **Los días que todavía no llegaron no tienen columna**, ni siquiera una en
 * cero: el inicio dibuja el mes entero para que se vea cuánto falta, y un cero
 * el 28 cuando hoy es 15 diría que ese día no se vendió nada.
 */
export function GraficoDeVentas({
  puntos,
  agrupado,
  hasta,
  etiqueta,
  className,
}: {
  puntos: PuntoDeVentas[];
  agrupado: "dia" | "mes";
  /** El último día con datos; los posteriores van sin columna. */
  hasta?: string;
  /** Qué muestra, para un lector de pantalla. */
  etiqueta: string;
  className?: string;
}) {
  const datos: ColumnaDeVentas[] = puntos.map((p) => ({
    fecha: p.fecha,
    vendido: hasta && p.fecha > hasta ? null : paraDibujar(p.vendido),
    monto: p.vendido,
    ordenes: p.ordenes,
  }));

  return (
    <figure className="flex flex-col gap-2">
      <ChartContainer
        config={configDeVentas}
        className={className ?? "aspect-auto h-56 w-full"}
        aria-hidden
      >
        <BarChart
          data={datos}
          margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="fecha"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={8}
            tickFormatter={(f: string) =>
              agrupado === "dia"
                ? String(aFecha(f).getUTCDate())
                : MES_CORTO.format(aFecha(f))
            }
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={64}
            tickCount={4}
            tickFormatter={(v: number) =>
              v === 0 ? "$ 0" : formatMoneyCorto(v)
            }
          />
          <ChartTooltip
            cursor={{ fill: "var(--surface-sunken)" }}
            content={
              <ChartTooltipContent
                hideIndicator
                labelFormatter={(_, payload) => {
                  const f = payload?.[0]?.payload?.fecha as string | undefined;
                  if (!f) return null;
                  const texto =
                    agrupado === "dia"
                      ? DIA.format(aFecha(f))
                      : MES.format(aFecha(f));
                  return texto.charAt(0).toUpperCase() + texto.slice(1);
                }}
                formatter={(_, __, item) => {
                  const p = item.payload as ColumnaDeVentas;
                  return (
                    <div className="flex w-full flex-col gap-0.5">
                      <span className="font-medium text-ink tabular-nums">
                        {formatMoney(p.monto)}
                      </span>
                      <span className="text-ink-secondary">
                        {p.ordenes === 1
                          ? "1 orden finalizada"
                          : `${p.ordenes} órdenes finalizadas`}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Bar
            dataKey="vendido"
            fill="var(--color-vendido)"
            radius={[4, 4, 0, 0]}
            maxBarSize={28}
            activeBar={{ fill: BARRA_SENALADA }}
          />
        </BarChart>
      </ChartContainer>

      {/* El gráfico es para la vista; esto, para quien no la usa. Los mismos
          números, sin las columnas vacías del final del mes. */}
      <figcaption className="sr-only">
        <table>
          <caption>{etiqueta}</caption>
          <tbody>
            {datos
              .filter((d) => d.vendido !== null)
              .map((d) => (
                <tr key={d.fecha}>
                  <th scope="row">
                    {agrupado === "dia"
                      ? DIA.format(aFecha(d.fecha))
                      : MES.format(aFecha(d.fecha))}
                  </th>
                  <td>{formatMoney(d.monto)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}

// ── Rankings: más vendidos, por categoría y por marca ──────────────────

export type BarraDeRanking = {
  id: string;
  nombre: string;
  /** Lo que mide la barra: el monto o las unidades. */
  valor: Money | number;
  /** Lo que se escribe al final de la barra. */
  etiqueta: string;
};

const configDeRanking = {
  valor: { label: "Vendido", color: BARRA },
} satisfies ChartConfig;

/** Cuánto entra de un nombre al costado de su barra antes del «…». */
const LARGO_DEL_NOMBRE = 18;

function recortar(nombre: string): string {
  return nombre.length > LARGO_DEL_NOMBRE
    ? `${nombre.slice(0, LARGO_DEL_NOMBRE - 1).trimEnd()}…`
    : nombre;
}

/**
 * El nombre al costado de la barra, **en un solo renglón**. Recharts parte el
 * texto del eje en varios cuando no entra en el ancho, y «Auricular Cloud S…»
 * quedaba en dos renglones apretados contra la barra de abajo. El nombre
 * entero va en el `<title>`, que el navegador muestra al pasar el mouse.
 */
function NombreAlCostado({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
}) {
  const nombre = payload?.value ?? "";
  return (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      className="fill-ink-secondary text-caption"
    >
      <title>{nombre}</title>
      {recortar(nombre)}
    </text>
  );
}

/**
 * Barras horizontales, de mayor a menor.
 *
 * **Horizontales porque las etiquetas son nombres**: «Auriculares inalámbricos
 * gamer» debajo de una columna se escribe en diagonal o no se escribe. El
 * nombre largo se recorta al costado y entero está en el globo y en la tabla
 * de abajo, que es la que se lee con un lector de pantalla —por eso el
 * gráfico va `aria-hidden`—.
 *
 * **El monto va escrito al final de cada barra**: en un ranking de diez la
 * pregunta es «¿cuánto?», y obligar a pasar el dedo por cada una para
 * saberlo es esconder la respuesta.
 */
export function GraficoDeRanking({
  barras,
  medida,
}: {
  barras: BarraDeRanking[];
  medida: "monto" | "unidades";
}) {
  const datos = barras.map((b) => ({
    ...b,
    alto: typeof b.valor === "number" ? b.valor : paraDibujar(b.valor),
  }));

  return (
    <ChartContainer
      config={configDeRanking}
      className="aspect-auto w-full"
      style={{ height: datos.length * 36 + 8 }}
      aria-hidden
    >
      <BarChart
        data={datos}
        layout="vertical"
        margin={{ top: 0, right: 112, left: 0, bottom: 0 }}
        barCategoryGap={6}
      >
        <XAxis type="number" dataKey="alto" hide />
        <YAxis
          type="category"
          dataKey="nombre"
          tickLine={false}
          axisLine={false}
          width={136}
          tick={<NombreAlCostado />}
          interval={0}
        />
        <ChartTooltip
          cursor={{ fill: "var(--surface-sunken)" }}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, payload) =>
                (payload?.[0]?.payload?.nombre as string | undefined) ?? null
              }
              formatter={(_, __, item) => (
                <span className="font-medium text-ink tabular-nums">
                  {(item.payload as BarraDeRanking).etiqueta}
                </span>
              )}
            />
          }
        />
        <Bar
          dataKey="alto"
          fill="var(--color-valor)"
          radius={4}
          maxBarSize={24}
          activeBar={{ fill: BARRA_SENALADA }}
          minPointSize={medida === "unidades" ? 2 : 0}
        >
          <LabelList
            dataKey="etiqueta"
            position="right"
            offset={8}
            className="fill-ink tabular-nums"
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

// ── Web contra manual ───────────────────────────────────────────────────

const WEB = "var(--ink)";
const MANUAL = "var(--ink-tertiary)";

const configDeOrigen = {
  web: { label: "Web", color: WEB },
  manual: { label: "Manual", color: MANUAL },
} satisfies ChartConfig;

/**
 * Una sola barra partida en dos: qué parte de lo vendido llegó por la web y
 * qué parte se cargó a mano — RF-28.
 *
 * **Dos grises que se distinguen por luminosidad**, `--ink` y
 * `--ink-tertiary`: los dos pasan 3:1 contra la tarjeta en claro y en oscuro,
 * y entre ellos no hay matiz que un daltónico pueda confundir. Igual **cada
 * parte lleva su nombre escrito** al lado, en la leyenda de abajo: el color
 * nunca es lo único que dice cuál es cuál.
 *
 * Los negativos se dibujan en cero —un período flojo con una devolución
 * grande puede dar menos que nada— y el número de verdad está escrito igual.
 */
export function BarraWebYManual({
  web,
  manual,
}: {
  web: Money;
  manual: Money;
}) {
  const datos = [
    {
      fila: "origen",
      web: Math.max(0, paraDibujar(web)),
      manual: Math.max(0, paraDibujar(manual)),
    },
  ];

  return (
    <ChartContainer
      config={configDeOrigen}
      className="aspect-auto h-10 w-full"
      aria-hidden
    >
      <BarChart
        data={datos}
        layout="vertical"
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
        stackOffset="expand"
      >
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="fila" hide />
        <Bar
          dataKey="web"
          stackId="a"
          fill="var(--color-web)"
          radius={[4, 0, 0, 4]}
        >
          {/* Un borde del color de la tarjeta separa las dos partes (2px). */}
          <Cell stroke="var(--surface)" strokeWidth={2} />
        </Bar>
        <Bar
          dataKey="manual"
          stackId="a"
          fill="var(--color-manual)"
          radius={[0, 4, 4, 0]}
        >
          <Cell stroke="var(--surface)" strokeWidth={2} />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export const COLOR_DE_ORIGEN = { web: WEB, manual: MANUAL } as const;
