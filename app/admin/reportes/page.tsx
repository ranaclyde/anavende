import { ArrowDown, ArrowUp, ChartColumn, Download, Minus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { EncabezadoDePanel } from "@/components/admin/encabezado";
import { BarraDePeriodo } from "@/components/admin/reportes/barra-de-periodo";
import {
  BarraWebYManual,
  COLOR_DE_ORIGEN,
  GraficoDeRanking,
  GraficoDeVentas,
} from "@/components/admin/reportes/graficos";
import { SolapasDelPanel } from "@/components/admin/solapas";
import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { VacioDelPanel } from "@/components/admin/vacio";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  add,
  formatMoney,
  isZero,
  porcentaje,
  variacion,
  type Money,
} from "@/lib/money";
import { cn } from "@/lib/utils";
import {
  RANKINGS,
  leerPeriodo,
  urlConRanking,
  urlDeExportacion,
  type ParametrosDeBusqueda,
  type Periodo,
  type Rango,
} from "@/modules/reports/periodo";
import {
  masVendidos,
  totalesDelPeriodo,
  ventasAgrupadas,
  ventasEnElTiempo,
  webContraManual,
  type FilaAgrupada,
  type PorOrigen,
  type ProductoVendido,
  type Totales,
} from "@/modules/reports/queries";
import { exigirAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Reportes" };

/**
 * Reportes de ventas (RF-28, TS §15). Lo vendido es lo finalizado menos lo
 * devuelto, la misma definición que «Este mes» en el inicio del panel. Cada
 * gráfico lleva su tabla, que es lo que lee un lector de pantalla.
 */
export default async function Reportes({
  searchParams,
}: {
  searchParams: Promise<ParametrosDeBusqueda>;
}) {
  await exigirAdmin();

  const periodo = leerPeriodo(await searchParams);

  const [totales, anteriores, serie, productos, categorias, marcas, origenes] =
    await Promise.all([
      totalesDelPeriodo(periodo),
      totalesDelPeriodo(periodo.anterior),
      ventasEnElTiempo(periodo, periodo.agrupado),
      masVendidos(periodo, periodo.ranking),
      ventasAgrupadas(periodo, "categoria"),
      ventasAgrupadas(periodo, "marca"),
      webContraManual(periodo),
    ]);

  const huboAlgo = totales.ordenes > 0 || !isZero(totales.devuelto);

  return (
    // Dos anchos (DESIGN.md, «Layout»). Consulta de contenedor para que
    // contraer el menú también cuente.
    <div className="@container">
      <div className="flex max-w-admin-form flex-col gap-4 @min-[1100px]:max-w-none">
        <EncabezadoDePanel
          titulo="Reportes"
          bajada="Lo vendido en el período: órdenes finalizadas, menos lo devuelto."
          acciones={
            // Un `<a>` y no un `Link`: es un archivo, y el enrutador del
            // cliente intentaría pintarlo.
            <Button asChild variant="secondary">
              <a href={urlDeExportacion(periodo)} download>
                <Download aria-hidden />
                Exportar a Excel
              </a>
            </Button>
          }
        />

        <BarraDePeriodo periodo={periodo} />

        <TotalesDelPeriodo
          periodo={periodo}
          totales={totales}
          anteriores={anteriores}
        />

        {huboAlgo ? (
          // Columnas de CSS y no grilla: cada sección cae donde haya lugar
          // según su alto real, y el orden del DOM sigue al de lectura.
          <div className="@min-[1100px]:columns-2 @min-[1100px]:gap-4 [&>*]:mb-4 [&>*]:break-inside-avoid [&>*:last-child]:mb-0">
            <TarjetaDeSeccion
              id="en-el-tiempo"
              titulo={
                periodo.agrupado === "dia" ? "Ventas por día" : "Ventas por mes"
              }
            >
              <GraficoDeVentas
                puntos={serie}
                agrupado={periodo.agrupado}
                etiqueta={
                  periodo.agrupado === "dia"
                    ? "Lo vendido cada día del período"
                    : "Lo vendido cada mes del período"
                }
              />
            </TarjetaDeSeccion>

            {/* Acá y no al final: es chica y al fondo se perdía. */}
            <WebYManual origenes={origenes} />

            <MasVendidos periodo={periodo} productos={productos} />

            <Agrupadas
              id="por-categoria"
              titulo="Por categoría"
              columna="Categoría"
              filas={categorias}
            />
            <Agrupadas
              id="por-marca"
              titulo="Por marca"
              columna="Marca"
              filas={marcas}
            />
          </div>
        ) : (
          <VacioDelPanel
            icono={ChartColumn}
            titulo="No hubo ventas en este período"
            accion={
              <Button asChild variant="secondary" size="sm">
                <Link href="/admin/ordenes">Ver las órdenes activas</Link>
              </Button>
            }
          >
            Una orden cuenta como venta el día en que se finaliza. Probá con
            otro período, o mirá las órdenes activas que todavía falta entregar.
          </VacioDelPanel>
        )}
      </div>
    </div>
  );
}

const DIAS = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** «1–15 de octubre de 2026», o un solo día si empieza y termina igual. */
function nombreDelRango({ desde, hasta }: Rango): string {
  const a = new Date(`${desde}T00:00:00Z`);
  const b = new Date(`${hasta}T00:00:00Z`);
  return desde === hasta ? DIAS.format(a) : DIAS.formatRange(a, b);
}

/** El color nunca dice solo para dónde fue: también la flecha y el signo. */
function TotalesDelPeriodo({
  periodo,
  totales,
  anteriores,
}: {
  periodo: Periodo;
  totales: Totales;
  anteriores: Totales;
}) {
  // Sin nada antes se dice eso, en vez de «+∞ %» o «0 % contra $ 0».
  const huboAntes = anteriores.ordenes > 0 || !isZero(anteriores.devuelto);
  const antes = (valor: string) => (huboAntes ? valor : null);

  return (
    <TarjetaDeSeccion
      id="totales"
      titulo="Totales"
      ayuda={
        <>
          Del {nombreDelRango(periodo)}, comparado con el{" "}
          {nombreDelRango(periodo.anterior)}.
        </>
      }
    >
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Total
          titulo="Vendido"
          valor={formatMoney(totales.vendido)}
          cambio={variacion(totales.vendido, anteriores.vendido)}
          antes={antes(formatMoney(anteriores.vendido))}
          nota={
            isZero(totales.devuelto)
              ? undefined
              : `Ya restados ${formatMoney(totales.devuelto)} de devoluciones`
          }
        />
        <Total
          titulo="Órdenes finalizadas"
          valor={String(totales.ordenes)}
          cambio={cambioEntero(totales.ordenes, anteriores.ordenes)}
          antes={antes(String(anteriores.ordenes))}
        />
        <Total
          titulo="Unidades vendidas"
          valor={String(totales.unidades)}
          cambio={cambioEntero(totales.unidades, anteriores.unidades)}
          antes={antes(String(anteriores.unidades))}
        />
        <Total
          titulo="Ticket promedio"
          valor={totales.ordenes ? formatMoney(totales.ticket) : "—"}
          cambio={
            totales.ordenes && anteriores.ordenes
              ? variacion(totales.ticket, anteriores.ticket)
              : null
          }
          antes={
            anteriores.ordenes ? antes(formatMoney(anteriores.ticket)) : null
          }
          nota="Lo que deja una orden, antes de devoluciones"
        />
      </dl>
    </TarjetaDeSeccion>
  );
}

/** Cambio porcentual entre dos cantidades. No son montos: van en JS. */
function cambioEntero(actual: number, anterior: number): number | null {
  if (anterior <= 0) return null;
  return Math.round(((actual - anterior) / anterior) * 100);
}

function Total({
  titulo,
  valor,
  cambio,
  antes,
  nota,
}: {
  titulo: string;
  valor: string;
  cambio: number | null;
  /** El valor del período anterior, o `null` si no hubo nada contra qué. */
  antes: string | null;
  nota?: string;
}) {
  const Flecha =
    cambio === null || cambio === 0 ? Minus : cambio > 0 ? ArrowUp : ArrowDown;

  return (
    <div className="flex flex-col gap-0.5 rounded-panel-card border border-border p-3">
      <dt className="text-caption text-ink-secondary">{titulo}</dt>
      <dd className="text-body-lg font-medium text-ink tabular-nums">
        {valor}
      </dd>
      <dd className="flex items-center gap-1 text-caption text-ink-secondary tabular-nums">
        {antes === null ? (
          "Sin ventas en el período anterior"
        ) : cambio === null ? (
          // Hay un antes, pero no un porcentaje: venía de cero o de negativo.
          <>Antes: {antes}</>
        ) : (
          <>
            <span
              className={cn(
                "flex items-center gap-1 font-medium",
                cambio > 0 && "text-success",
                cambio < 0 && "text-danger",
              )}
            >
              <Flecha aria-hidden className="size-3.5 shrink-0" />
              {cambio > 0 ? "+" : ""}
              {cambio} %
            </span>
            <span>contra {antes}</span>
          </>
        )}
      </dd>
      {nota ? (
        <dd className="text-caption text-ink-secondary">{nota}</dd>
      ) : null}
    </div>
  );
}

/** «Negro 3 · Blanco 1», si el producto tiene colores que separar. */
function desgloseDeColores(p: ProductoVendido): string | null {
  const conColor = p.colores.filter((c) => c.color);
  if (conColor.length === 0) return null;
  return p.colores
    .map((c) => `${c.color ?? "Sin color"} ${c.unidades}`)
    .join(" · ");
}

function unidades(n: number): string {
  return n === 1 ? "1 unidad" : `${n} unidades`;
}

function MasVendidos({
  periodo,
  productos,
}: {
  periodo: Periodo;
  productos: ProductoVendido[];
}) {
  const porUnidades = periodo.ranking === "unidades";

  return (
    <TarjetaDeSeccion
      id="mas-vendidos"
      titulo="Más vendidos"
      ayuda="Los diez primeros, netos de devoluciones, con el desglose por color."
      acciones={
        <SolapasDelPanel
          etiqueta="Ordenar el ranking"
          variante="segmentado"
          solapas={RANKINGS.map((r) => ({
            href: urlConRanking(periodo, r.valor),
            etiqueta: r.etiqueta,
            activa: periodo.ranking === r.valor,
          }))}
        />
      }
    >
      {productos.length === 0 ? (
        <p className="text-body-sm text-ink-secondary">
          En este período solo hubo devoluciones de ventas anteriores.
        </p>
      ) : (
        <>
          <GraficoDeRanking
            medida={porUnidades ? "unidades" : "monto"}
            barras={productos.map((p) => ({
              id: p.id,
              nombre: p.nombre,
              valor: porUnidades ? p.unidades : p.vendido,
              etiqueta: porUnidades
                ? unidades(p.unidades)
                : formatMoney(p.vendido),
            }))}
          />

          <div className="overflow-hidden rounded-panel-card border border-border">
            <Table
              conTope={false}
              deslizable="Tabla de los más vendidos"
              className="max-sm:[&_td]:px-2 max-sm:[&_th]:px-2"
            >
              <TableHeader>
                <TableRow className="hover:bg-surface-sunken">
                  <TableHead className="w-10 max-sm:hidden" data-align="right">
                    #
                  </TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead data-align="right" className="w-20 sm:w-24">
                    Unidades
                  </TableHead>
                  <TableHead data-align="right" className="w-32 sm:w-36">
                    Vendido
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productos.map((p, i) => {
                  const colores = desgloseDeColores(p);
                  return (
                    <TableRow key={p.id}>
                      <TableCell
                        data-align="right"
                        className="text-ink-secondary max-sm:hidden"
                      >
                        {i + 1}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col py-1">
                          <span className="text-ink">{p.nombre}</span>
                          <span className="text-caption text-ink-secondary">
                            {p.marca}
                            {colores ? ` · ${colores}` : null}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell data-align="right">{p.unidades}</TableCell>
                      <TableCell data-align="right" className="font-medium">
                        {formatMoney(p.vendido)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </TarjetaDeSeccion>
  );
}

/** Cuántas barras entran en el gráfico; la tabla las tiene todas. */
const BARRAS_AGRUPADAS = 8;

function Agrupadas({
  id,
  titulo,
  columna,
  filas,
}: {
  id: string;
  titulo: string;
  columna: string;
  filas: FilaAgrupada[];
}) {
  const recortado = filas.length > BARRAS_AGRUPADAS;

  return (
    <TarjetaDeSeccion
      id={id}
      titulo={titulo}
      ayuda={
        recortado
          ? `En el gráfico, las ${BARRAS_AGRUPADAS} que más vendieron; en la tabla, todas.`
          : undefined
      }
    >
      <GraficoDeRanking
        medida="monto"
        barras={filas.slice(0, BARRAS_AGRUPADAS).map((f) => ({
          id: f.id,
          nombre: f.nombre,
          valor: f.vendido,
          etiqueta: formatMoney(f.vendido),
        }))}
      />

      <div className="overflow-hidden rounded-panel-card border border-border">
        <Table
          conTope={false}
          deslizable={`Tabla de ventas ${titulo.toLowerCase()}`}
          className="max-sm:[&_td]:px-2 max-sm:[&_th]:px-2"
        >
          <TableHeader>
            <TableRow className="hover:bg-surface-sunken">
              <TableHead>{columna}</TableHead>
              <TableHead data-align="right" className="w-20 sm:w-24">
                Unidades
              </TableHead>
              <TableHead data-align="right" className="w-32 sm:w-36">
                Vendido
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="text-ink">{f.nombre}</TableCell>
                <TableCell data-align="right">{f.unidades}</TableCell>
                <TableCell data-align="right" className="font-medium">
                  {formatMoney(f.vendido)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TarjetaDeSeccion>
  );
}

const NOMBRE_DEL_ORIGEN = {
  web: "Web",
  manual: "Carga manual",
} as const;

function WebYManual({ origenes }: { origenes: PorOrigen[] }) {
  const web = origenes.find((o) => o.origen === "web")!;
  const manual = origenes.find((o) => o.origen === "manual")!;
  const total: Money = add(web.vendido, manual.vendido);
  const dibujable =
    !isZero(total) &&
    porcentaje(web.vendido, total) !== null &&
    porcentaje(manual.vendido, total) !== null;

  return (
    <TarjetaDeSeccion
      id="web-y-manual"
      titulo="Web y carga manual"
      ayuda="Lo que entró por la tienda, contra lo vendido por WhatsApp o en persona y cargado a mano."
    >
      {dibujable ? (
        <BarraWebYManual web={web.vendido} manual={manual.vendido} />
      ) : null}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[web, manual].map((o) => {
          const parte = porcentaje(o.vendido, total);
          return (
            <li
              key={o.origen}
              className="flex items-start gap-2 rounded-panel-card border border-border p-3"
            >
              <span
                aria-hidden
                className="mt-1.5 size-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: COLOR_DE_ORIGEN[o.origen] }}
              />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-caption text-ink-secondary">
                  {NOMBRE_DEL_ORIGEN[o.origen]}
                  {dibujable && parte !== null ? ` · ${parte} %` : null}
                </span>
                <span className="text-body-lg font-medium text-ink tabular-nums">
                  {formatMoney(o.vendido)}
                </span>
                <span className="text-caption text-ink-secondary">
                  {o.ordenes === 1
                    ? "1 orden finalizada"
                    : `${o.ordenes} órdenes finalizadas`}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </TarjetaDeSeccion>
  );
}
