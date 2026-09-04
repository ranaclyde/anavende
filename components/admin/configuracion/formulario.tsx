"use client";

import { CheckCircle2 } from "lucide-react";
import { useId, useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import { leerErrores, SIN_ERRORES, type ErroresDeFormulario } from "@/lib/form";
import { guardarLaConfiguracion } from "@/modules/settings/actions";
import {
  AYUDA_DEL_UMBRAL,
  ENTERO,
  UMBRAL_MAXIMO,
  UMBRAL_MINIMO,
} from "@/modules/settings/limites";
import type { ConfiguracionDelSitio } from "@/modules/settings/queries";

/**
 * En el ORDEN EN QUE SE VEN: al fallar el envío el foco va al primero de
 * esta lista que tenga error, y «el primero» tiene que ser el de más arriba
 * en la pantalla.
 */
const CAMPOS = [
  "whatsappNumber",
  "adminNotificationEmail",
  "lowStockThreshold",
] as const;

type Campo = (typeof CAMPOS)[number];

/**
 * Configuración del sitio — RF-20, F2.7.
 *
 * Tres valores que la vendedora tiene que poder cambiar sin que nadie
 * despliegue nada: el número por el que vende, la casilla donde le avisamos
 * y a partir de cuántas unidades considera que algo se está por acabar.
 *
 * **La fila puede no existir todavía** (§5.9): la escribe este formulario la
 * primera vez que se guarda. Por eso `configuracion` puede ser `null`, y por
 * eso la pantalla lo dice en vez de mostrar campos vacíos que parecerían un
 * error de carga.
 */
export function FormularioDeConfiguracion({
  configuracion,
  umbralPorDefecto,
}: {
  /** `null` = todavía no se guardó nunca. */
  configuracion: ConfiguracionDelSitio | null;
  /** El que usa el sistema mientras la fila no existe (§10.3). */
  umbralPorDefecto: number;
}) {
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] =
    useState<ErroresDeFormulario<Campo>>(SIN_ERRORES);

  /**
   * Lo último que se sabe guardado. Arranca en lo que trajo el servidor y se
   * reemplaza por lo que DEVUELVE la acción, que no es lo mismo que lo
   * enviado: el número vuelve normalizado a `+549…`.
   */
  const [guardado, setGuardado] = useState(configuracion);
  const [seGuardoRecien, setSeGuardoRecien] = useState(false);

  const [whatsapp, setWhatsapp] = useState(configuracion?.whatsappNumber ?? "");
  const [email, setEmail] = useState(
    configuracion?.adminNotificationEmail ?? "",
  );
  // El umbral vive como texto porque un campo de formulario devuelve texto.
  // Se muestra el que el sistema YA está usando: ofrecer otro número haría
  // que guardar sin tocar nada cambiara el listado sin que nadie lo pidiera.
  const [umbral, setUmbral] = useState(
    String(configuracion?.lowStockThreshold ?? umbralPorDefecto),
  );

  const errorGeneral = useRef<HTMLDivElement | null>(null);

  /**
   * Se calcula durante el render, sin efecto ni limpieza en cada `onChange`:
   * la confirmación se muestra mientras lo que hay en pantalla siga siendo
   * lo guardado. Tocar un campo la apaga sola, y volver atrás la enciende,
   * que es exactamente lo que corresponde: el formulario vuelve a coincidir
   * con lo que está en la base.
   */
  const sinCambios =
    guardado !== null &&
    whatsapp === guardado.whatsappNumber &&
    email === guardado.adminNotificationEmail &&
    umbral === String(guardado.lowStockThreshold);

  const campo = (nombre: Campo) => ({
    id: `${idBase}-${nombre}`,
    "aria-invalid": Boolean(errores.campos[nombre]) || undefined,
    "aria-describedby": errores.campos[nombre]
      ? `${idBase}-${nombre}-error`
      : `${idBase}-${nombre}-ayuda`,
  });

  /**
   * Escribir en un campo apaga SU error y el general.
   *
   * Sin esto la pantalla se contradice, y no es una hipótesis: se vio.
   * Después de un envío rechazado, corregir el número hasta dejarlo igual al
   * guardado apaga el botón —no hay nada que guardar— y el aviso rojo se
   * queda al lado de un «Todo guardado.», señalando un problema que ya no
   * existe y que no hay forma de sacar de la pantalla.
   *
   * No es validar mientras se escribe, que §6.6 no quiere: es dejar de
   * afirmar algo que se dijo sobre un valor que ya no está.
   */
  const escribir = (nombre: Campo, poner: (v: string) => void) => (
    evento: React.ChangeEvent<HTMLInputElement>,
  ) => {
    poner(evento.target.value);

    if (errores.campos[nombre] || errores.general) {
      setErrores((previos) => ({
        ...previos,
        general: null,
        campos: { ...previos.campos, [nombre]: undefined },
      }));
    }
  };

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores(SIN_ERRORES);
    setSeGuardoRecien(false);

    // El único caso que no puede viajar: sin dígitos no hay número que
    // mandar, y `NaN` no sobrevive al viaje. El mensaje es EL MISMO que
    // daría el servidor, que es lo que hace que la comprobación de acá sea
    // un adelanto y no una segunda regla.
    if (!ENTERO.test(umbral.trim())) {
      setErrores({
        ...SIN_ERRORES,
        campos: { lowStockThreshold: AYUDA_DEL_UMBRAL },
      });
      document.getElementById(`${idBase}-lowStockThreshold`)?.focus();
      return;
    }

    iniciar(async () => {
      const resultado = await guardarLaConfiguracion({
        whatsappNumber: whatsapp,
        adminNotificationEmail: email,
        // `Number.parseInt` explícito, que es lo que pide la regla de lint de
        // §7.1: acá no hay un monto sino un conteo de unidades. La guarda de
        // arriba ya garantizó que hay dígitos y nada más.
        lowStockThreshold: Number.parseInt(umbral.trim(), 10),
      });

      if (!resultado.ok) {
        const nuevos = leerErrores<Campo>(resultado);
        setErrores(nuevos);

        const primero = CAMPOS.find((c) => nuevos.campos[c]);
        if (primero) document.getElementById(`${idBase}-${primero}`)?.focus();
        else errorGeneral.current?.focus();
        return;
      }

      // Se pisan los campos con lo GUARDADO: escribir «11 5555 5555» y ver
      // «+5491155555555» es la confirmación de que se entendió el número.
      setGuardado(resultado.data);
      setWhatsapp(resultado.data.whatsappNumber);
      setEmail(resultado.data.adminNotificationEmail);
      setUmbral(String(resultado.data.lowStockThreshold));
      setSeGuardoRecien(true);
    });
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
      {guardado === null ? <SinConfigurar umbral={umbralPorDefecto} /> : null}

      {/* ── Lo que ve el comprador ───────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading text-ink">Contacto</h2>
          <p className="text-body-sm text-ink-secondary">
            Es lo único de esta pantalla que ve el comprador.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo("whatsappNumber").id}>Número de WhatsApp</Label>
          <Input
            {...campo("whatsappNumber")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            value={whatsapp}
            onChange={escribir("whatsappNumber", setWhatsapp)}
            placeholder="11 5555 5555"
            className="sm:max-w-64"
          />
          {errores.campos.whatsappNumber ? (
            <FieldError id={`${idBase}-whatsappNumber-error`}>
              {errores.campos.whatsappNumber}
            </FieldError>
          ) : (
            <FieldHint id={`${idBase}-whatsappNumber-ayuda`}>
              Es el número al que llegan las consultas y las compras por
              WhatsApp. Escribilo como te salga: se guarda siempre igual.
            </FieldHint>
          )}
        </div>
      </section>

      {/* ── Lo que ve solo la vendedora ──────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded-panel-card bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-heading text-ink">Avisos</h2>
          <p className="text-body-sm text-ink-secondary">
            Nada de esto se muestra en la tienda.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo("adminNotificationEmail").id}>
            Email para los avisos
          </Label>
          <Input
            {...campo("adminNotificationEmail")}
            type="email"
            autoComplete="off"
            value={email}
            onChange={escribir("adminNotificationEmail", setEmail)}
            placeholder="ventas@anavende.com.ar"
            className="sm:max-w-80"
          />
          {errores.campos.adminNotificationEmail ? (
            <FieldError id={`${idBase}-adminNotificationEmail-error`}>
              {errores.campos.adminNotificationEmail}
            </FieldError>
          ) : (
            <FieldHint id={`${idBase}-adminNotificationEmail-ayuda`}>
              Acá te llegan las órdenes nuevas. Puede ser distinto del email
              con el que entrás al panel.
            </FieldHint>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={campo("lowStockThreshold").id}>
            Avisar «stock bajo» a partir de
          </Label>
          <div className="flex items-center gap-2">
            <Input
              {...campo("lowStockThreshold")}
              // La unidad está al lado del campo y no en la etiqueta, así que
              // sin esto un lector de pantalla lee «avisar stock bajo a partir
              // de: 3» y nunca dice de qué. Se suma a lo que ya describe al
              // campo en vez de reemplazarlo.
              aria-describedby={`${
                errores.campos.lowStockThreshold
                  ? `${idBase}-lowStockThreshold-error`
                  : `${idBase}-lowStockThreshold-ayuda`
              } ${idBase}-unidades`}
              // `inputMode` y no `type="number"`, por lo mismo que el stock de
              // una variante: el campo numérico del navegador sube y baja con
              // la rueda del mouse encima, y acá eso cambiaría el umbral de
              // todo el catálogo mientras alguien baja la página.
              inputMode="numeric"
              autoComplete="off"
              maxLength={3}
              value={umbral}
              onChange={escribir("lowStockThreshold", setUmbral)}
              className="w-20 tabular-nums"
            />
            <span
              id={`${idBase}-unidades`}
              className="text-body-sm text-ink-secondary"
            >
              unidades
            </span>
          </div>
          {errores.campos.lowStockThreshold ? (
            <FieldError id={`${idBase}-lowStockThreshold-error`}>
              {errores.campos.lowStockThreshold}
            </FieldError>
          ) : (
            <FieldHint id={`${idBase}-lowStockThreshold-ayuda`}>
              <Ejemplo umbral={umbral} />
            </FieldHint>
          )}
        </div>
      </section>

      <div ref={errorGeneral} tabIndex={-1} className="outline-none">
        <FieldError>{errores.general}</FieldError>
      </div>

      <div className="flex items-center justify-end gap-3">
        {/* El motivo por el que «Guardar» está apagado, escrito y no colgado
            de un `title`: §8 pide que lo deshabilitado diga por qué, y un
            tooltip sobre un botón deshabilitado no siempre llega a aparecer.
            Son dos motivos distintos y se dicen distinto: recién guardado es
            algo que pasó —verde, con ícono—; llegar con todo guardado no es
            un logro, es el estado normal. `polite` para que el lector de
            pantalla anuncie el primero sin interrumpir. */}
        <p aria-live="polite" className="text-body-sm">
          {seGuardoRecien && sinCambios ? (
            <span className="flex items-center gap-1.5 text-success">
              <CheckCircle2 aria-hidden className="size-4" />
              Listo, se guardó.
            </span>
          ) : sinCambios ? (
            <span className="text-ink-secondary">Todo guardado.</span>
          ) : null}
        </p>

        <Button
          type="submit"
          variant="brand"
          loading={enviando}
          loadingLabel="Guardando"
          disabled={sinCambios}
        >
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}

/**
 * El estado vacío de esta pantalla (§8): no es una lista sin filas, es una
 * configuración que nunca se guardó. Lo que hay que decir es qué está
 * usando el sistema mientras tanto, porque los campos ya muestran valores y
 * sin esto parecerían guardados.
 */
function SinConfigurar({ umbral }: { umbral: number }) {
  return (
    <p className="rounded-panel-card border border-dashed border-border bg-surface-sunken px-4 py-3 text-body-sm text-ink-secondary">
      Todavía no guardaste la configuración. Hasta que lo hagas no hay número
      de WhatsApp para mostrar en la tienda, y el aviso de stock bajo se
      enciende con {umbral} unidades.
    </p>
  );
}

/**
 * Qué va a pasar con el número que hay escrito, dicho con las palabras que
 * usa el listado —«Quedan N»— y no con las del formulario. Es la misma idea
 * que el precio final en vivo del alta de producto: se ve la consecuencia
 * antes de guardarla.
 */
function Ejemplo({ umbral }: { umbral: string }) {
  const texto = umbral.trim();

  if (!ENTERO.test(texto)) {
    return <>El listado avisa cuando a un producto le queda poco stock.</>;
  }

  const n = Number.parseInt(texto, 10);
  if (n < UMBRAL_MINIMO || n > UMBRAL_MAXIMO) {
    return <>El listado avisa cuando a un producto le queda poco stock.</>;
  }

  return (
    <>
      Un producto con {n === 1 ? "1 unidad" : `${n} unidades`} o menos aparece
      como «Quedan {n}» en el listado de productos.
    </>
  );
}
