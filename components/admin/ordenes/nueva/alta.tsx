"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";

import { TarjetaDeSeccion } from "@/components/admin/tarjeta";
import {
  CAMPOS_DE_DIRECCION,
  CamposDeDireccion,
} from "@/components/admin/ordenes/nueva/direccion";
import { BuscadorDeComprador } from "@/components/admin/ordenes/nueva/buscador-comprador";
import { BuscadorDeVariantes } from "@/components/admin/ordenes/nueva/buscador-variantes";
import { avisar } from "@/components/ui/aviso";
import { Button } from "@/components/ui/button";
import { Campo, Opcion } from "@/components/admin/formulario";
import { FieldError } from "@/components/ui/field-error";
import { Input, Textarea } from "@/components/ui/input";
import {
  type ErroresDeFormulario,
  erroresDeSeccion,
  leerErrores,
  SIN_ERRORES,
} from "@/lib/form";
import { comoMonto, formatMoney, isMoney, multiply, sum } from "@/lib/money";
import { crearLaOrdenManualDelPanel } from "@/modules/orders/actions-manual";
import type {
  CompradorParaLaOrden,
  VarianteParaLaOrden,
} from "@/modules/orders/queries-manual";
import { MAXIMO_DE_NOTAS } from "@/modules/orders/schemas-manual";
import { OTRA_LOCALIDAD } from "@/modules/users/direcciones/constantes";

/**
 * Alta de una venta cargada a mano — FS RF-24. Tarea F7.4.
 *
 * **Es un formulario y no un checkout.** El checkout acompaña a alguien que
 * está comprando y por eso va de a un paso; esto lo llena la vendedora con la
 * venta ya hecha y el teléfono en la mano: todo a la vista, en el orden en
 * que se cuenta una venta —qué se llevó, quién, cómo lo recibe, cómo queda—.
 *
 * **Lo que avisa sin bloquear** (RF-24): cuando la cantidad supera el stock.
 * Es la mitad del requisito que existe para poder registrar lo que ya pasó, y
 * por eso el aviso no apaga el botón. La otra mitad la decide el dominio: una
 * orden que nace **activa** sí necesita stock libre para reservar, y eso se
 * explica cuando vuelve el error (`manual.ts`).
 *
 * **Es un `<form>` de verdad** desde el 2026-09-22, como el de producto y el
 * de configuración: Enter envía, el navegador lo anuncia como formulario y el
 * foco va al primer campo que falló —la dirección incluida—. Hasta hoy era un
 * `<div>` con botones `onClick`.
 */

type Renglon = {
  /** Propio del renglón: la misma variante puede entrar dos veces, a precios
   *  distintos —dos unidades a $100 y una bonificada—, y la clave de React
   *  no puede ser la variante. */
  key: string;
  variante: VarianteParaLaOrden;
  cantidad: number;
  /** Texto, no número: es plata y se valida como texto (§7.1). */
  precio: string;
};

type CampoDelFormulario =
  | "items"
  | "nombre"
  | "telefono"
  | "email"
  | "entrega"
  | "direccion"
  | "notas"
  | "estado";

export function AltaDeOrdenManual() {
  const router = useRouter();
  const idBase = useId();
  const [guardando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<CampoDelFormulario>>(SIN_ERRORES);
  const [erroresDeDireccion, setErroresDeDireccion] = useState<
    Partial<Record<string, string>>
  >({});

  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [cuenta, setCuenta] = useState<CompradorParaLaOrden | null>(null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [entrega, setEntrega] = useState<"envio" | "retiro">("retiro");
  // **Finalizada por omisión** (decisión del 2026-09-16): lo habitual es
  // anotar una venta que ya se entregó. Quien coordina para después lo cambia.
  const [estado, setEstado] = useState<"finalizada" | "activa">("finalizada");
  const [notas, setNotas] = useState("");

  /** `null` = escribir una dirección; un id = usar una guardada de la cuenta. */
  const [direccionGuardada, setDireccionGuardada] = useState<string | null>(
    null,
  );
  const [direccion, setDireccion] = useState(DIRECCION_VACIA);

  // Lo escrito se normaliza para mostrar, igual que lo hace la validación al
  // recibirlo: quien escribe «150000,50» tiene que ver su total enseguida, no
  // después de averiguar que acá el separador es el punto.
  const total = sum(renglones.map(subtotalDelRenglon));

  function agregar(variante: VarianteParaLaOrden) {
    setRenglones((previos) => [
      ...previos,
      {
        key: `${variante.variantId}-${Date.now()}`,
        variante,
        cantidad: 1,
        // Arranca con el precio vigente y se edita: RF-24 pide el acordado,
        // y el del catálogo es el punto de partida nueve de cada diez veces.
        precio: variante.precio,
      },
    ]);
  }

  function elegirCuenta(comprador: CompradorParaLaOrden) {
    setCuenta(comprador);
    // Se completa lo que esté vacío y no se pisa lo ya escrito: si la
    // vendedora escribió «Rosa (regalo para Ana)», eso lo puso por algo.
    setNombre((v) => v || comprador.nombre);
    setTelefono((v) => v || comprador.telefono);
    setEmail((v) => v || comprador.email);
    const primera = comprador.direcciones[0];
    if (primera) setDireccionGuardada(primera.id);
  }

  function quitarCuenta() {
    setCuenta(null);
    setDireccionGuardada(null);
  }

  /**
   * Adónde va el foco cuando el envío falla. Sin esto queda en el botón, al
   * pie de un formulario largo, y el campo que hay que corregir puede estar
   * cuatro tarjetas más arriba, fuera de la pantalla.
   */
  const errorGeneral = useRef<HTMLDivElement | null>(null);

  function irAlPrimerError(
    nuevos: ErroresDeFormulario<CampoDelFormulario>,
    deLaDireccion: Partial<Record<string, string>>,
  ) {
    // Los candidatos en orden de lectura, y se enfoca el primero que exista
    // de verdad: «direccion» y «items» son secciones y no controles, y la
    // dirección escrita sólo está en pantalla cuando no se eligió una
    // guardada. Lo que no tiene dónde aterrizar cae al mensaje de abajo.
    const candidatos = [
      ...CAMPOS.filter((c) => nuevos.campos[c]).map((c) => `${idBase}-${c}`),
      ...CAMPOS_DE_DIRECCION.filter((c) => deLaDireccion[c]).map(
        (c) => `${idBase}-direccion-${c}`,
      ),
    ];

    const control = candidatos
      .map((id) => document.getElementById(id))
      .find((el) => el !== null);

    (control ?? errorGeneral.current)?.focus();
  }

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores(SIN_ERRORES);
    setErroresDeDireccion({});

    const elegida = cuenta?.direcciones.find((d) => d.id === direccionGuardada);
    const datos = {
      items: renglones.map((r) => ({
        variantId: r.variante.variantId,
        cantidad: r.cantidad,
        precio: r.precio,
      })),
      estado,
      cuentaId: cuenta?.id,
      nombre,
      telefono,
      email,
      entrega,
      direccion:
        entrega === "envio"
          ? elegida
            ? deDireccionGuardada(elegida)
            : direccion
          : undefined,
      notas,
    };

    iniciar(async () => {
      const r = await crearLaOrdenManualDelPanel(datos);
      if (!r.ok) {
        const nuevos = leerErrores<CampoDelFormulario>(r);
        const deLaDireccion = erroresDeSeccion(r, "direccion");
        setErrores(nuevos);
        setErroresDeDireccion(deLaDireccion);
        irAlPrimerError(nuevos, deLaDireccion);
        return;
      }
      // Al detalle de la orden recién creada: es donde se la revisa, se le
      // escribe al comprador o se la corrige (F7.1, F7.2).
      avisar(`Creaste la orden #${r.data.numero}.`);
      router.push(`/admin/ordenes/${r.data.numero}`);
    });
  }

  const e = errores.campos;

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      <TarjetaDeSeccion id="productos" titulo="Productos">
        <BuscadorDeVariantes id={`${idBase}-items`} alElegir={agregar} />

        {renglones.length === 0 ? (
          <p className="rounded-panel-card border border-dashed border-border px-3 py-6 text-center text-body-sm text-ink-secondary">
            Buscá un producto arriba para agregarlo. Podés cambiarle el precio:
            lo que se guarda es lo que se cobró.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {renglones.map((r) => (
              <RenglonDeLaOrden
                key={r.key}
                renglon={r}
                estado={estado}
                alCambiar={(cambios) =>
                  setRenglones((previos) =>
                    previos.map((otro) =>
                      otro.key === r.key ? { ...otro, ...cambios } : otro,
                    ),
                  )
                }
                alQuitar={() =>
                  setRenglones((previos) =>
                    previos.filter((otro) => otro.key !== r.key),
                  )
                }
              />
            ))}
          </ul>
        )}

        <FieldError id={`${idBase}-items-error`}>{e.items}</FieldError>

        {renglones.length > 0 ? (
          <div className="flex items-baseline justify-between border-t border-border pt-3">
            <span className="text-body-sm text-ink">Total</span>
            <span className="text-body-lg font-medium text-ink tabular-nums">
              {formatMoney(total)}
            </span>
          </div>
        ) : null}
      </TarjetaDeSeccion>

      <TarjetaDeSeccion
        id="comprador"
        titulo="Comprador"
        ayuda="Los datos son de este pedido. Si tiene cuenta, asociala para que le aparezca en «Mis compras»."
      >
        <BuscadorDeComprador
          elegido={cuenta}
          alElegir={elegirCuenta}
          alQuitar={quitarCuenta}
        />

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo
            id={`${idBase}-nombre`}
            etiqueta="A nombre de"
            valor={nombre}
            alCambiar={setNombre}
            error={e.nombre}
            autoComplete="off"
          />
          <Campo
            id={`${idBase}-telefono`}
            etiqueta="Teléfono"
            valor={telefono}
            alCambiar={setTelefono}
            error={e.telefono}
            inputMode="tel"
            ayuda="Con característica, por ejemplo 2920 55 5555."
          />
        </div>
        <Campo
          id={`${idBase}-email`}
          etiqueta="Email (opcional)"
          valor={email}
          alCambiar={setEmail}
          error={e.email}
          type="email"
        />
      </TarjetaDeSeccion>

      <TarjetaDeSeccion id="entrega" titulo="Entrega">
        <div className="grid gap-2 sm:grid-cols-2">
          <Opcion
            id={`${idBase}-entrega`}
            nombre="entrega"
            elegida={entrega === "retiro"}
            alElegir={() => setEntrega("retiro")}
            titulo="Retira"
            detalle="Lo pasa a buscar por el punto de entrega."
          />
          <Opcion
            nombre="entrega"
            elegida={entrega === "envio"}
            alElegir={() => setEntrega("envio")}
            titulo="Envío"
            detalle="Hace falta la dirección: sin ella la orden se lee como retiro."
          />
        </div>

        {entrega === "envio" ? (
          <div className="flex flex-col gap-3">
            {cuenta && cuenta.direcciones.length > 0 ? (
              <div className="flex flex-col gap-2">
                {cuenta.direcciones.map((d) => (
                  <Opcion
                    key={d.id}
                    nombre="direccion"
                    elegida={direccionGuardada === d.id}
                    alElegir={() => setDireccionGuardada(d.id)}
                    titulo={d.label}
                    detalle={`${d.street} ${d.number}${
                      d.apartment ? `, ${d.apartment}` : ""
                    } — ${d.city}`}
                  />
                ))}
                <Opcion
                  nombre="direccion"
                  elegida={direccionGuardada === null}
                  alElegir={() => setDireccionGuardada(null)}
                  titulo="Otra dirección"
                  detalle="Se escribe acá y no se guarda en su libreta."
                />
              </div>
            ) : null}

            {direccionGuardada === null ? (
              <CamposDeDireccion
                idBase={`${idBase}-direccion`}
                valores={direccion}
                alCambiar={(cambios) =>
                  setDireccion((previa) => ({ ...previa, ...cambios }))
                }
                errores={erroresDeDireccion}
              />
            ) : null}

            <FieldError id={`${idBase}-direccion-error`}>
              {e.direccion}
            </FieldError>
          </div>
        ) : null}
      </TarjetaDeSeccion>

      <TarjetaDeSeccion
        id="como-queda"
        titulo="Cómo queda la orden"
        ayuda="De esto depende qué pasa con el stock."
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Opcion
            id={`${idBase}-estado`}
            nombre="estado"
            elegida={estado === "finalizada"}
            alElegir={() => setEstado("finalizada")}
            titulo="Finalizada"
            detalle="Ya se entregó y se cobró: descuenta el stock de una."
          />
          <Opcion
            nombre="estado"
            elegida={estado === "activa"}
            alElegir={() => setEstado("activa")}
            titulo="Activa"
            detalle="Falta entregarla: reserva el stock hasta que la finalices."
          />
        </div>
        <FieldError id={`${idBase}-estado-error`}>{e.estado}</FieldError>
      </TarjetaDeSeccion>

      <TarjetaDeSeccion id="notas" titulo="Notas (opcional)">
        <Textarea
          id={`${idBase}-notas`}
          value={notas}
          aria-invalid={e.notas ? true : undefined}
          aria-describedby={e.notas ? `${idBase}-notas-error` : undefined}
          onChange={(ev) => setNotas(ev.target.value)}
          maxLength={MAXIMO_DE_NOTAS}
          className="min-h-16"
          placeholder="Lo que haga falta recordar de esta venta."
        />
        <FieldError id={`${idBase}-notas-error`}>{e.notas}</FieldError>
      </TarjetaDeSeccion>

      <div ref={errorGeneral} tabIndex={-1} className="outline-none">
        <FieldError>{errores.general}</FieldError>
      </div>

      {/* En el panel la acción principal va a la derecha, y el escape queda a
          mano: cancelar es un enlace y no un botón, porque no hace nada, va a
          otro lado. */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild variant="tertiary">
          <Link href="/admin/ordenes">Cancelar</Link>
        </Button>
        <Button
          type="submit"
          variant="brand"
          loading={guardando}
          loadingLabel="Guardando"
        >
          Cargar la orden
        </Button>
      </div>
    </form>
  );
}

/** El orden en que se leen en pantalla, que es el orden en que se corrigen. */
const CAMPOS: CampoDelFormulario[] = [
  "items",
  "nombre",
  "telefono",
  "email",
  "entrega",
  "direccion",
  "estado",
  "notas",
];

/** Cero mientras el precio no sea un monto: lo que no se entiende no suma. */
function subtotalDelRenglon(r: Renglon): string {
  const precio = comoMonto(r.precio);
  return isMoney(precio) ? multiply(precio, r.cantidad) : "0.00";
}

export const DIRECCION_VACIA = {
  recipientName: "",
  phone: "",
  street: "",
  number: "",
  apartment: "",
  localidad: "Viedma",
  otraLocalidad: "",
  provinciaDeOtra: "",
  notes: "",
};

/** De una dirección guardada del comprador a los campos del formulario. */
function deDireccionGuardada(d: {
  recipientName: string;
  phone: string;
  street: string;
  number: string;
  apartment?: string | null;
  notes?: string | null;
  city: string;
  province: string;
}) {
  const conocida = ["Viedma", "Carmen de Patagones", "San Javier", "El Cóndor"];
  const esConocida = conocida.includes(d.city);

  return {
    recipientName: d.recipientName,
    phone: d.phone,
    street: d.street,
    number: d.number,
    apartment: d.apartment ?? "",
    localidad: esConocida ? d.city : OTRA_LOCALIDAD,
    otraLocalidad: esConocida ? "" : d.city,
    provinciaDeOtra: esConocida ? "" : d.province,
    notes: d.notes ?? "",
  };
}

/**
 * Un renglón con su cantidad y su precio.
 *
 * **El aviso de stock mira un contador distinto según cómo va a nacer la
 * orden** (§8.1): una finalizada descuenta del total, una activa compromete
 * el disponible. Avisar contra el número que no es sería avisar de más o de
 * menos justo donde RF-24 quiere precisión.
 */
function RenglonDeLaOrden({
  renglon,
  estado,
  alCambiar,
  alQuitar,
}: {
  renglon: Renglon;
  estado: "activa" | "finalizada";
  alCambiar: (cambios: Partial<Renglon>) => void;
  alQuitar: () => void;
}) {
  const { variante, cantidad, precio } = renglon;
  const contador = estado === "activa" ? variante.disponible : variante.stock;
  const seExcede = cantidad > contador;

  return (
    <li className="flex flex-col gap-2 rounded-panel-card border border-border bg-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-body-sm font-medium text-ink">
            {variante.nombre}
            {variante.color ? (
              <span className="font-normal text-ink-secondary">
                {" "}
                · {variante.color}
              </span>
            ) : null}
          </span>
          <span className="text-caption text-ink-tertiary">
            {variante.marca}
            {variante.inactiva ? " · dado de baja" : ""}
          </span>
        </span>

        <Button
          type="button"
          variant="destructive-ghost"
          size="icon"
          onClick={alQuitar}
        >
          <Trash2 aria-hidden />
          <span className="sr-only">Quitar {variante.nombre}</span>
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-secondary">Cantidad</span>
          <Input
            type="number"
            min={1}
            max={9999}
            value={cantidad}
            onChange={(ev) =>
              alCambiar({
                cantidad: Math.max(
                  1,
                  Number.parseInt(ev.target.value, 10) || 1,
                ),
              })
            }
            className="w-24"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-caption text-ink-secondary">
            Precio por unidad
          </span>
          <Input
            inputMode="decimal"
            value={precio}
            onChange={(ev) => alCambiar({ precio: ev.target.value })}
            className="w-32"
          />
        </label>

        <span className="ml-auto text-body-sm text-ink tabular-nums">
          {isMoney(comoMonto(precio))
            ? formatMoney(subtotalDelRenglon(renglon))
            : "—"}
        </span>
      </div>

      {seExcede ? (
        // RF-24: **advierte y no bloquea**. Si la venta ya ocurrió, esto es
        // exactamente lo que hay que poder cargar; el stock queda en negativo
        // y el panel lo muestra como la discrepancia que es (§5.4).
        <p className="flex items-start gap-1.5 rounded-panel-control bg-warning-tint px-2 py-1.5 text-caption text-warning">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          <span>
            {estado === "activa"
              ? `Hay ${contador} disponible${contador === 1 ? "" : "s"}: como activa no se va a poder reservar. Si ya se entregó, cargala como finalizada.`
              : `El sistema tiene ${contador}. Se va a cargar igual y el stock queda en ${contador - cantidad}, marcado como discrepancia.`}
          </span>
        </p>
      ) : null}
    </li>
  );
}
