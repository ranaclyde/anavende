"use client";

import { useId, useState, useTransition } from "react";
import { CreditCard, Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";

import { Seccion, Secciones } from "@/components/admin/formulario";
import { avisar } from "@/components/ui/aviso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetForm,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { shortDay, todayInArgentina } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { readErrors, NO_ERRORS, type FormErrors } from "@/lib/form";
import {
  normalizeAmount,
  installment,
  formatMoney,
  isMoney,
  isZero,
  money,
  toEditable,
} from "@/lib/money";
import {
  cambiarEstadoDePromocion,
  crearUnaPromocion,
  editarUnaPromocion,
  eliminarUnaPromocion,
} from "@/modules/settings/actions";
import type {
  MedioDePagoDelPanel,
  PromocionDelPanel,
} from "@/modules/settings/queries";
import { conQuien } from "@/modules/settings/promociones";
import { CUOTAS_MAXIMAS, CUOTAS_MINIMAS } from "@/modules/settings/schemas";

/**
 * Las promociones de cuotas de un medio de pago — RF-40. Un drawer con dos
 * vistas, la lista y el formulario, y no uno encima de otro. La lista sale de
 * las props: no hay copia local que pueda quedar vieja.
 */
export function PromocionesDeMedioDePago({
  medio,
  alCerrar,
}: {
  medio: MedioDePagoDelPanel;
  alCerrar: () => void;
}) {
  /** `null` = la lista; `"nueva"` o una promoción = el formulario. */
  const [enFormulario, setEnFormulario] = useState<
    PromocionDelPanel | "nueva" | null
  >(null);

  return (
    <Sheet open onOpenChange={(v) => !v && alCerrar()}>
      <SheetContent>
        {enFormulario === null ? (
          <Lista
            medio={medio}
            alCrear={() => setEnFormulario("nueva")}
            alEditar={setEnFormulario}
            alCerrar={alCerrar}
          />
        ) : (
          // La `key` monta un formulario nuevo por promoción (ver
          // `EdicionDeMedioDePago`).
          <Formulario
            key={enFormulario === "nueva" ? "nueva" : enFormulario.id}
            medio={medio}
            promocion={enFormulario === "nueva" ? null : enFormulario}
            alVolver={() => setEnFormulario(null)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Lista({
  medio,
  alCrear,
  alEditar,
  alCerrar,
}: {
  medio: MedioDePagoDelPanel;
  alCrear: () => void;
  alEditar: (p: PromocionDelPanel) => void;
  alCerrar: () => void;
}) {
  const [enCurso, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [porBorrar, setPorBorrar] = useState<PromocionDelPanel | null>(null);

  const correr = (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setError(null);
    iniciar(async () => {
      const r = await fn();
      if (!r.ok) setError(r.message ?? null);
    });
  };

  const borrar = (p: PromocionDelPanel) => {
    setPorBorrar(null);
    correr(async () => {
      const r = await eliminarUnaPromocion({ id: p.id });
      if (r.ok) avisar(`Borraste la promoción de ${p.cuotas} cuotas.`);
      return r;
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>Cuotas con {medio.name}</SheetTitle>
        {/* RN-01 en la primera línea, como en el medio de pago. */}
        <SheetDescription>
          La ficha de cada producto las muestra debajo del precio mientras estén
          vigentes. No cambian el precio ni cobran nada.
        </SheetDescription>
      </SheetHeader>

      <SheetBody>
        {medio.isActive ? null : (
          <p className="mb-4 rounded-panel-control bg-warning-tint px-3 py-2 text-body-sm text-warning">
            {medio.name} está desactivado: sus promociones no se ven en la
            tienda hasta que lo actives.
          </p>
        )}

        {error === null ? null : (
          <p role="alert" className="mb-4 text-body-sm text-danger">
            {error}
          </p>
        )}

        {medio.promociones.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-panel-card border border-dashed border-border-strong p-4">
            <p className="text-body-sm text-ink-secondary">
              Todavía no cargaste ninguna. Una promoción como «3 cuotas sin
              interés en noviembre» se carga una vez y se apaga sola cuando
              vence.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {medio.promociones.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 rounded-panel-card border border-border bg-surface p-3"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-ink">{resumen(p)}</span>
                    <Estado promocion={p} />
                  </div>
                  <span className="text-caption text-ink-secondary">
                    {vigencia(p)}
                    {p.montoMinimo
                      ? ` · Desde ${formatMoney(p.montoMinimo)}`
                      : null}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="tertiary"
                    size="icon"
                    disabled={enCurso}
                    onClick={() => alEditar(p)}
                    title="Editar"
                  >
                    <Pencil aria-hidden />
                    <span className="sr-only">Editar {resumen(p)}</span>
                  </Button>
                  <Button
                    variant="tertiary"
                    size="icon"
                    disabled={enCurso}
                    onClick={() =>
                      correr(() =>
                        cambiarEstadoDePromocion({
                          id: p.id,
                          activa: !p.activa,
                        }),
                      )
                    }
                    title={p.activa ? "Desactivar" : "Activar"}
                  >
                    {p.activa ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                    <span className="sr-only">
                      {p.activa ? "Desactivar" : "Activar"} {resumen(p)}
                    </span>
                  </Button>
                  <Button
                    variant="destructive-ghost"
                    size="icon"
                    disabled={enCurso}
                    onClick={() => setPorBorrar(p)}
                    title="Borrar"
                  >
                    <Trash2 aria-hidden />
                    <span className="sr-only">Borrar {resumen(p)}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SheetBody>

      <SheetFooter>
        <Button type="button" variant="secondary" onClick={alCerrar}>
          Cerrar
        </Button>
        <Button type="button" variant="brand" onClick={alCrear}>
          <Plus aria-hidden />
          Nueva promoción
        </Button>
      </SheetFooter>

      <Dialog
        open={porBorrar !== null}
        onOpenChange={(abierto) => (abierto ? null : setPorBorrar(null))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Borrar {porBorrar ? resumen(porBorrar).toLowerCase() : null}
            </DialogTitle>
            <DialogDescription>
              No hay vuelta atrás. Si solo querés cortarla antes de que venza,
              desactivala: queda guardada para la próxima vez.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPorBorrar(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive-solid"
              onClick={() => porBorrar && borrar(porBorrar)}
            >
              Borrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** «3 cuotas sin interés», «Plan Z: 3 cuotas con 15 % de recargo». */
function resumen(
  p: Pick<PromocionDelPanel, "plan" | "cuotas" | "recargo">,
): string {
  const cuotas = isZero(p.recargo)
    ? `${p.cuotas} cuotas sin interés`
    : `${p.cuotas} cuotas con ${toEditable(p.recargo)} % de recargo`;
  return p.plan ? `${p.plan}: ${cuotas}` : cuotas;
}

function vigencia(p: PromocionDelPanel): string {
  return p.hasta
    ? `Del ${shortDay(p.desde)} al ${shortDay(p.hasta)}`
    : `Desde el ${shortDay(p.desde)}, sin fecha de fin`;
}

/** Si hoy se ve. Desactivada gana a la fecha: es lo que ella decidió. */
function Estado({ promocion: p }: { promocion: PromocionDelPanel }) {
  if (!p.activa) return <Badge tone="neutral">Desactivada</Badge>;
  if (p.estado === "vigente") return <Badge tone="success">Vigente</Badge>;
  if (p.estado === "programada") return <Badge tone="info">Programada</Badge>;
  return <Badge tone="neutral">Vencida</Badge>;
}

type Campo = "plan" | "cuotas" | "recargo" | "desde" | "hasta" | "montoMinimo";

/** El precio de la vista previa cuando la promoción no pide mínimo. */
const PRECIO_DE_EJEMPLO = "100000.00";

function Formulario({
  medio,
  promocion,
  alVolver,
}: {
  medio: MedioDePagoDelPanel;
  promocion: PromocionDelPanel | null;
  alVolver: () => void;
}) {
  const id = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] = useState<FormErrors<Campo>>(NO_ERRORS);

  const [plan, setPlan] = useState(promocion?.plan ?? "");
  const [cuotas, setCuotas] = useState(String(promocion?.cuotas ?? 3));
  const [recargo, setRecargo] = useState(
    promocion && !isZero(promocion.recargo)
      ? toEditable(promocion.recargo)
      : "",
  );
  const [desde, setDesde] = useState(promocion?.desde ?? todayInArgentina());
  const [hasta, setHasta] = useState(promocion?.hasta ?? "");
  const [minimo, setMinimo] = useState(
    promocion?.montoMinimo ? toEditable(promocion.montoMinimo) : "",
  );

  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrores(NO_ERRORS);

    const campos = {
      plan,
      cuotas: Number.parseInt(cuotas, 10),
      recargo,
      desde,
      hasta,
      montoMinimo: minimo,
    };

    iniciar(async () => {
      const r = promocion
        ? await editarUnaPromocion({ id: promocion.id, ...campos })
        : await crearUnaPromocion({ paymentMethodId: medio.id, ...campos });

      if (!r.ok) {
        setErrores(readErrors<Campo>(r));
        return;
      }

      avisar(
        promocion
          ? "Guardaste la promoción."
          : `Creaste la promoción de ${campos.cuotas} cuotas con ${medio.name}.`,
      );
      alVolver();
    });
  };

  const previa = vistaPrevia(cuotas, recargo, minimo);

  return (
    <>
      <SheetHeader>
        <SheetTitle>
          {promocion ? "Editar promoción" : "Nueva promoción"}
        </SheetTitle>
        <SheetDescription>Cuotas con {medio.name}.</SheetDescription>
      </SheetHeader>

      <SheetForm onSubmit={enviar} noValidate>
        <SheetBody>
          <Secciones>
            <Seccion titulo="Las cuotas">
              <Campo
                id={`${id}-plan`}
                etiqueta="Plan"
                opcional
                error={errores.fields.plan}
              >
                <Input
                  id={`${id}-plan`}
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  maxLength={40}
                  autoFocus
                  aria-invalid={!!errores.fields.plan || undefined}
                  aria-describedby={
                    errores.fields.plan ? `${id}-plan-e` : `${id}-plan-ayuda`
                  }
                />
                {errores.fields.plan ? null : (
                  <FieldHint id={`${id}-plan-ayuda`}>
                    Como el Plan Z de NaranjaX.
                  </FieldHint>
                )}
              </Campo>

              <div className="grid grid-cols-2 gap-4">
                <Campo
                  id={`${id}-cuotas`}
                  etiqueta="Cuotas"
                  error={errores.fields.cuotas}
                >
                  <Input
                    id={`${id}-cuotas`}
                    type="number"
                    inputMode="numeric"
                    min={CUOTAS_MINIMAS}
                    max={CUOTAS_MAXIMAS}
                    value={cuotas}
                    onChange={(e) => setCuotas(e.target.value)}
                    required
                    aria-invalid={!!errores.fields.cuotas || undefined}
                    aria-describedby={
                      errores.fields.cuotas ? `${id}-cuotas-e` : undefined
                    }
                  />
                </Campo>
                <Campo
                  id={`${id}-recargo`}
                  etiqueta="Recargo (%)"
                  error={errores.fields.recargo}
                >
                  <Input
                    id={`${id}-recargo`}
                    inputMode="decimal"
                    placeholder="0"
                    value={recargo}
                    onChange={(e) => setRecargo(e.target.value)}
                    aria-invalid={!!errores.fields.recargo || undefined}
                    aria-describedby={
                      errores.fields.recargo
                        ? `${id}-recargo-e`
                        : `${id}-recargo-ayuda`
                    }
                  />
                </Campo>
              </div>
              {errores.fields.recargo ? null : (
                <FieldHint id={`${id}-recargo-ayuda`} className="-mt-3">
                  Vacío o 0 es sin interés.
                </FieldHint>
              )}
            </Seccion>

            <Seccion titulo="Cuándo se ve">
              <div className="grid grid-cols-2 gap-4">
                <Campo
                  id={`${id}-desde`}
                  etiqueta="Desde"
                  error={errores.fields.desde}
                >
                  <Input
                    id={`${id}-desde`}
                    type="date"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                    required
                    aria-invalid={!!errores.fields.desde || undefined}
                    aria-describedby={
                      errores.fields.desde ? `${id}-desde-e` : undefined
                    }
                  />
                </Campo>
                <Campo
                  id={`${id}-hasta`}
                  etiqueta="Hasta"
                  opcional
                  error={errores.fields.hasta}
                >
                  <Input
                    id={`${id}-hasta`}
                    type="date"
                    value={hasta}
                    min={desde || undefined}
                    onChange={(e) => setHasta(e.target.value)}
                    aria-invalid={!!errores.fields.hasta || undefined}
                    aria-describedby={
                      errores.fields.hasta
                        ? `${id}-hasta-e`
                        : `${id}-hasta-ayuda`
                    }
                  />
                </Campo>
              </div>
              {errores.fields.hasta ? null : (
                <FieldHint id={`${id}-hasta-ayuda`} className="-mt-3">
                  Las dos fechas cuentan. Sin fecha de fin, no vence.
                </FieldHint>
              )}

              <Campo
                id={`${id}-minimo`}
                etiqueta="Monto mínimo"
                opcional
                error={errores.fields.montoMinimo}
              >
                <Input
                  id={`${id}-minimo`}
                  inputMode="decimal"
                  value={minimo}
                  onChange={(e) => setMinimo(e.target.value)}
                  aria-invalid={!!errores.fields.montoMinimo || undefined}
                  aria-describedby={
                    errores.fields.montoMinimo
                      ? `${id}-minimo-e`
                      : `${id}-minimo-ayuda`
                  }
                />
                {errores.fields.montoMinimo ? null : (
                  <FieldHint id={`${id}-minimo-ayuda`}>
                    Sobre el precio con descuento. Por debajo, no se muestra.
                  </FieldHint>
                )}
              </Campo>
            </Seccion>

            {previa ? (
              <Seccion titulo="Así se ve en la ficha">
                <div className="flex flex-col gap-2 rounded-panel-card bg-surface-sunken p-3">
                  <p className="text-caption text-ink-secondary">
                    En un producto de {formatMoney(previa.precio)}
                  </p>
                  <p className="flex items-start gap-2 text-body-sm text-ink-secondary">
                    <CreditCard
                      aria-hidden
                      className={cn(
                        "mt-[3px] size-4 shrink-0",
                        previa.sinRecargo ? "text-success" : null,
                      )}
                    />
                    <span>
                      {previa.sinRecargo ? "Mismo precio en " : null}
                      <strong className="font-semibold text-ink tabular-nums">
                        {previa.cuotas} cuotas de {formatMoney(previa.cuota)}
                      </strong>{" "}
                      con{" "}
                      {conQuien({
                        medio: medio.name,
                        plan: plan.trim() || null,
                      })}
                    </span>
                  </p>
                </div>
              </Seccion>
            ) : null}
          </Secciones>

          <FieldError className="mt-5">{errores.general}</FieldError>
        </SheetBody>

        <SheetFooter>
          <Button type="button" variant="secondary" onClick={alVolver}>
            Volver
          </Button>
          <Button type="submit" variant="brand" loading={enviando}>
            {promocion ? "Guardar" : "Crear"}
          </Button>
        </SheetFooter>
      </SheetForm>
    </>
  );
}

function Campo({
  id,
  etiqueta,
  opcional = false,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  opcional?: boolean;
  error: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>
        {etiqueta}
        {opcional ? (
          <>
            {" "}
            <span className="font-normal text-ink-secondary">(opcional)</span>
          </>
        ) : null}
      </Label>
      {children}
      {error ? <FieldError id={`${id}-e`}>{error}</FieldError> : null}
    </div>
  );
}

/**
 * La cuota de ejemplo, con la misma cuenta que la ficha (`cuota`): sobre el
 * mínimo si lo hay, si no sobre un precio redondo. `null` mientras lo escrito
 * no es un número.
 */
function vistaPrevia(cuotas: string, recargo: string, minimo: string) {
  const n = Number.parseInt(cuotas, 10);
  if (!Number.isInteger(n) || n < CUOTAS_MINIMAS || n > CUOTAS_MAXIMAS) {
    return null;
  }
  const pct = recargo.replace("%", "").trim().replace(",", ".") || "0";
  if (!isMoney(pct)) return null;
  const minimoComoMonto = minimo.trim() === "" ? null : normalizeAmount(minimo);
  const precio =
    minimoComoMonto && isMoney(minimoComoMonto)
      ? money(minimoComoMonto)
      : PRECIO_DE_EJEMPLO;
  try {
    return {
      precio,
      cuotas: n,
      cuota: installment(precio, money(pct), n),
      sinRecargo: isZero(pct),
    };
  } catch {
    return null;
  }
}
