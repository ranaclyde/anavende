"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";

import {
  FormularioDeDireccion,
  type ValoresDeDireccion,
} from "@/components/shop/direcciones/formulario";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { cn } from "@/lib/utils";
import { confirmarPedido } from "@/modules/orders/actions";
import type { FormaDeEntrega } from "@/modules/orders/entrega";
import { enviarVerificacion } from "@/modules/users/actions";

type Campo = "nombre" | "telefono" | "entrega" | "addressId";

export type DireccionDelCheckout = {
  id: string;
  nombre: string;
  /** «Mitre 123, 3° B · Viedma · Recibe Ana Pérez», armado en el servidor. */
  detalle: string;
};

/**
 * Lo que dice «lo que viste ya no es lo que hay» (§8.4 paso 3): la página se
 * vuelve a armar con lo vigente, y los avisos de arriba cuentan qué cambió.
 * Es la reconfirmación de RF-11: el mensaje queda junto al botón, y confirmar
 * otra vez ya manda los precios nuevos.
 */
const CAMBIO_EL_CARRITO = new Set([
  "PRICE_CHANGED",
  "PRODUCT_UNAVAILABLE",
  "INSUFFICIENT_STOCK",
]);

/**
 * Las partes vivas del checkout — F6.1, RF-11.
 *
 * **Nombre y teléfono valen para este pedido** (aceptado el 2026-09-14):
 * van al snapshot de la orden y no cambian la cuenta. Quien compra para otra
 * persona no tiene por qué pisar sus propios datos, y los de la cuenta se
 * cambian en «Mis datos». El email no se edita: es el de la sesión.
 *
 * **Arranca en «Que me lo envíen»** (aceptado el 2026-09-14), con la
 * dirección predeterminada elegida: es el caso de casi todos, y cambiar a
 * retiro es un toque. Sin direcciones, el formulario para cargar una aparece
 * abierto ahí mismo.
 *
 * No es un `<form>`: el de la dirección nueva vive adentro, y un formulario
 * no puede contener a otro. Confirmar lee el estado.
 */
export function Checkout({
  clave,
  email,
  emailVerificado,
  nombreInicial,
  telefonoInicial,
  direcciones,
  maximoAlcanzado,
  nuevaDireccion,
  esperado,
  mediosDePago,
  resumen,
}: {
  clave: string;
  email: string;
  emailVerificado: boolean;
  nombreInicial: string;
  telefonoInicial: string;
  direcciones: DireccionDelCheckout[];
  maximoAlcanzado: boolean;
  nuevaDireccion: ValoresDeDireccion;
  esperado: { variantId: string; unitPrice: string; quantity: number }[];
  mediosDePago: { id: string; nombre: string }[];
  resumen: ReactNode;
}) {
  const router = useRouter();
  const [confirmando, iniciar] = useTransition();
  const [nombre, setNombre] = useState(nombreInicial);
  const [telefono, setTelefono] = useState(telefonoInicial);
  const [entrega, setEntrega] = useState<FormaDeEntrega>("envio");
  const [direccionId, setDireccionId] = useState<string | null>(null);
  const [cargando, setCargando] = useState(direcciones.length === 0);
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);

  // La elegida se deriva en cada dibujo y no se sincroniza con un efecto: si
  // la que estaba elegida ya no está —se borró desde otra pestaña—, o todavía
  // no llegó —recién cargada, esperando el refresco—, vale la primera, que es
  // la predeterminada.
  const elegida =
    direcciones.find((d) => d.id === direccionId)?.id ??
    direcciones[0]?.id ??
    null;

  // Lo que falta, en el orden en que se lo resuelve. Visible debajo del botón
  // (RF-11: «con la razón visible»).
  const motivo = !emailVerificado
    ? "Confirmá tu email para poder hacer el pedido."
    : nombre.trim() === ""
      ? "Falta tu nombre."
      : telefono.trim() === ""
        ? "Falta tu teléfono: lo necesitamos para coordinar la entrega."
        : entrega === "envio" && !elegida
          ? "Elegí a dónde te lo enviamos, o cargá una dirección."
          : null;

  function confirmar() {
    setErrores(SIN_ERRORES);
    iniciar(async () => {
      const r = await confirmarPedido({
        idempotencyKey: clave,
        nombre,
        telefono,
        entrega,
        addressId: entrega === "envio" ? (elegida ?? undefined) : undefined,
        esperado,
      });

      if (r.ok) {
        // `replace`: volver atrás desde la orden no tiene que traer de nuevo
        // un checkout que ya se usó. Y el refresco pone al día la píldora del
        // carrito del encabezado, que la navegación sola no toca.
        router.replace(`/orden/${r.data.numero}`);
        router.refresh();
        return;
      }

      setErrores(leerErrores<Campo>(r));
      // NOT_FOUND es la dirección elegida, borrada desde otra pestaña: el
      // refresco la saca de la lista y deja elegida la predeterminada.
      if (CAMBIO_EL_CARRITO.has(r.code) || r.code === "NOT_FOUND") {
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-8">
      <div className="flex flex-col gap-6">
        <Seccion id="datos-titulo" titulo="Tus datos">
          {emailVerificado ? null : <SinVerificar email={email} />}

          <p className="text-body-sm text-ink-secondary">
            Email: <span className="text-ink">{email}</span>
          </p>

          <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="checkout-nombre">Nombre</Label>
              <Input
                id="checkout-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                autoComplete="name"
                aria-invalid={!!errores.campos.nombre || undefined}
              />
              <FieldError>{errores.campos.nombre}</FieldError>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="checkout-telefono">Teléfono</Label>
              <Input
                id="checkout-telefono"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                aria-invalid={!!errores.campos.telefono || undefined}
              />
              {errores.campos.telefono ? (
                <FieldError>{errores.campos.telefono}</FieldError>
              ) : (
                <FieldHint>Por acá coordinamos la entrega y el pago.</FieldHint>
              )}
            </div>
          </div>

          <p className="text-caption text-ink-secondary">
            Lo que cambies acá vale para este pedido. Los datos de tu cuenta se
            cambian en{" "}
            <Link
              href="/mi-cuenta"
              className="rounded-pill underline underline-offset-4"
            >
              Mis datos
            </Link>
            .
          </p>
        </Seccion>

        <Seccion id="entrega-titulo" titulo="Entrega">
          <fieldset className="flex flex-col gap-3">
            <legend className="sr-only">¿Cómo querés recibirlo?</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Opcion
                nombre="entrega"
                elegida={entrega === "envio"}
                onElegir={() => setEntrega("envio")}
                titulo="Que me lo envíen"
                detalle="A domicilio, en Viedma, Carmen de Patagones y alrededores."
              />
              <Opcion
                nombre="entrega"
                elegida={entrega === "retiro"}
                onElegir={() => setEntrega("retiro")}
                titulo="Lo retiro"
                detalle="Te pasamos por WhatsApp dónde y cuándo retirarlo."
              />
            </div>
          </fieldset>

          {entrega === "envio" ? (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <p id="direccion-titulo" className="text-body font-medium text-ink">
                ¿A dónde te lo enviamos?
              </p>

              {direcciones.length > 0 ? (
                <fieldset
                  aria-labelledby="direccion-titulo"
                  className="flex flex-col gap-3"
                >
                  {direcciones.map((d) => (
                    <Opcion
                      key={d.id}
                      nombre="direccion"
                      elegida={d.id === elegida}
                      onElegir={() => setDireccionId(d.id)}
                      titulo={d.nombre}
                      detalle={d.detalle}
                    />
                  ))}
                </fieldset>
              ) : null}

              <FieldError>{errores.campos.addressId}</FieldError>

              {cargando ? (
                <div className="flex flex-col gap-4 rounded-image bg-surface-sunken p-4 sm:p-5">
                  <p className="text-body font-medium text-ink">
                    Nueva dirección
                  </p>
                  <FormularioDeDireccion
                    inicial={nuevaDireccion}
                    alGuardar={(id) => {
                      setDireccionId(id);
                      setCargando(false);
                      router.refresh();
                    }}
                    alCancelar={
                      direcciones.length > 0
                        ? () => setCargando(false)
                        : undefined
                    }
                  />
                </div>
              ) : maximoAlcanzado ? (
                <FieldHint>
                  Ya tenés 3 direcciones guardadas, que es el máximo. Las
                  cambiás desde{" "}
                  <Link
                    href="/mi-cuenta/direcciones"
                    className="rounded-pill underline underline-offset-4"
                  >
                    tus direcciones
                  </Link>
                  .
                </FieldHint>
              ) : (
                <Button
                  type="button"
                  variant="tertiary"
                  size="md"
                  className="self-start"
                  onClick={() => setCargando(true)}
                >
                  <Plus aria-hidden />
                  Agregar una dirección
                </Button>
              )}
            </div>
          ) : null}

          <p className="text-caption text-ink-secondary">
            Entregamos en Viedma, Carmen de Patagones y alrededores. El costo
            del envío se coordina y abona junto con el pago por WhatsApp.
          </p>
        </Seccion>

        {mediosDePago.length > 0 ? (
          <Seccion id="pagos-titulo" titulo="Medios de pago">
            <ul className="flex flex-wrap gap-2">
              {mediosDePago.map((m) => (
                <li
                  key={m.id}
                  className="rounded-pill bg-surface-sunken px-3 py-1 text-body-sm text-ink"
                >
                  {m.nombre}
                </li>
              ))}
            </ul>
            <p className="text-caption text-ink-secondary">
              Son los que aceptamos. No se cobra nada acá: el pago lo
              coordinamos por WhatsApp cuando confirmás.
            </p>
          </Seccion>
        ) : null}
      </div>

      <section
        aria-labelledby="resumen-titulo"
        className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-md lg:sticky lg:top-18"
      >
        <h2 id="resumen-titulo" className="text-body-lg font-medium text-ink">
          Resumen
        </h2>

        {resumen}

        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            variant="brand"
            className="w-full"
            disabled={motivo !== null}
            aria-describedby={motivo ? "confirmar-motivo" : undefined}
            loading={confirmando}
            loadingLabel="Confirmando el pedido"
            onClick={confirmar}
          >
            Confirmar pedido
          </Button>
          {motivo ? (
            <p id="confirmar-motivo" className="text-body-sm text-ink-secondary">
              {motivo}
            </p>
          ) : null}
          <FieldError>{errores.general}</FieldError>
        </div>

        <p className="text-caption text-ink-secondary">
          Al confirmar guardamos el stock, y el pago lo coordinamos por
          WhatsApp.
        </p>
      </section>
    </div>
  );
}

function Seccion({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="flex flex-col gap-4 rounded-card bg-surface p-5 shadow-md sm:p-6"
    >
      <h2 id={id} className="text-body-lg font-medium text-ink">
        {titulo}
      </h2>
      {children}
    </section>
  );
}

/**
 * Una opción de una lista: la forma de entrega, o la dirección.
 *
 * Es un `<input type="radio">` de verdad y a la vista, como en el selector de
 * color de la ficha: el recorrido con flechas, el agrupado por nombre y el
 * anuncio de «1 de 2» salen del navegador. La tarjeta entera es la etiqueta,
 * así que se elige tocando en cualquier parte.
 */
function Opcion({
  nombre,
  elegida,
  onElegir,
  titulo,
  detalle,
}: {
  nombre: string;
  elegida: boolean;
  onElegir: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-3 rounded-image border border-border bg-surface p-4",
        "transition-colors duration-150",
        "has-checked:border-brand has-checked:bg-brand-tint",
        "has-focus-visible:shadow-focus",
      )}
    >
      <input
        type="radio"
        name={nombre}
        checked={elegida}
        onChange={onElegir}
        className="mt-0.5 size-5 shrink-0 accent-brand"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-body font-medium text-ink">{titulo}</span>
        <span className="text-body-sm text-ink-secondary">{detalle}</span>
      </span>
    </label>
  );
}

/**
 * RF-11: un email sin verificar no confirma, «con acción para reenviar la
 * verificación». El enlace vuelve al checkout (F5.7).
 */
function SinVerificar({ email }: { email: string }) {
  const [reenviando, iniciar] = useTransition();
  const [reenviado, setReenviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reenviar = () => {
    setError(null);
    iniciar(async () => {
      const r = await enviarVerificacion({ email, volver: "/checkout" });
      if (r.ok) setReenviado(true);
      else setError(r.message);
    });
  };

  return (
    <div
      role="status"
      className="flex flex-col items-start gap-3 rounded-image bg-warning-tint p-4"
    >
      <p className="text-body-sm text-ink">
        Antes de confirmar necesitás verificar tu email. Abrí el enlace que te
        mandamos a <span className="font-medium">{email}</span>.
      </p>
      {reenviado ? (
        <p className="text-body-sm text-success">Listo, te mandamos otro.</p>
      ) : (
        <Button
          type="button"
          variant="secondary"
          size="md"
          loading={reenviando}
          loadingLabel="Reenviando"
          onClick={reenviar}
        >
          No me llegó, reenviar
        </Button>
      )}
      <FieldError>{error}</FieldError>
    </div>
  );
}
