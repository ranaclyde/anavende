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
  formatMoneyShort,
  toChartNumber,
  type Money,
} from "@/lib/money";
import type { PuntoDeVentas } from "@/modules/reports/queries";

/**
 * Colores y reglas: DR §6.16. Los montos se pasan a número solo para dibujar
 * (`toChartNumber`); el número que se lee sale siempre de `formatMoney`.
 */

const BARRA = "var(--ink-secondary)";
const BARRA_SENALADA = "var(--ink)";

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
  etiqueta: string;
  className?: string;
}) {
  const datos: ColumnaDeVentas[] = puntos.map((p) => ({
    fecha: p.fecha,
    vendido: hasta && p.fecha > hasta ? null : toChartNumber(p.vendido),
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
        {/* Sin la capa de teclado de Recharts: con `aria-hidden`, su parada
            de foco no lleva a nada. */}
        <BarChart
          accessibilityLayer={false}
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
              v === 0 ? "$ 0" : formatMoneyShort(v)
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

      {/* La tabla para lectores de pantalla. */}
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

export type BarraDeRanking = {
  id: string;
  nombre: string;
  valor: Money | number;
  /** Lo que se escribe al final de la barra. */
  etiqueta: string;
};

const configDeRanking = {
  valor: { label: "Vendido", color: BARRA },
} satisfies ChartConfig;

const LARGO_DEL_NOMBRE = 18;

function recortar(nombre: string): string {
  return nombre.length > LARGO_DEL_NOMBRE
    ? `${nombre.slice(0, LARGO_DEL_NOMBRE - 1).trimEnd()}…`
    : nombre;
}

/** En un renglón: Recharts parte en varios el texto del eje que no entra. */
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

export function GraficoDeRanking({
  barras,
  medida,
}: {
  barras: BarraDeRanking[];
  medida: "monto" | "unidades";
}) {
  const datos = barras.map((b) => ({
    ...b,
    alto: typeof b.valor === "number" ? b.valor : toChartNumber(b.valor),
  }));

  return (
    <ChartContainer
      config={configDeRanking}
      className="aspect-auto w-full"
      style={{ height: datos.length * 36 + 8 }}
      aria-hidden
    >
      <BarChart
        accessibilityLayer={false}
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

const WEB = "var(--ink)";
const MANUAL = "var(--ink-tertiary)";

const configDeOrigen = {
  web: { label: "Web", color: WEB },
  manual: { label: "Manual", color: MANUAL },
} satisfies ChartConfig;

/**
 * Lo vendido por la web contra lo cargado a mano. Un período con devoluciones
 * puede dar negativo: se dibuja en cero y el número real va escrito igual.
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
      web: Math.max(0, toChartNumber(web)),
      manual: Math.max(0, toChartNumber(manual)),
    },
  ];

  return (
    <ChartContainer
      config={configDeOrigen}
      className="aspect-auto h-10 w-full"
      aria-hidden
    >
      <BarChart
        accessibilityLayer={false}
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
          {/* Separa las dos partes. */}
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
