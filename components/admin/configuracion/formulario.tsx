"use client";

import { useId, useRef, useState, useTransition } from "react";

import { EstadoDeGuardado } from "@/components/admin/estado-de-guardado";
import { Apartado, TarjetaDeSeccion } from "@/components/admin/tarjeta";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field-error";
import { Input } from "@/components/ui/input";
import { FieldHint, Label } from "@/components/ui/label";
import type { Scene } from "@/lib/scenes";
import { readErrors, NO_ERRORS, type FormErrors } from "@/lib/form";
import { localPhone } from "@/lib/phone";
import { guardarLaConfiguracion } from "@/modules/settings/actions";
import { AYUDA_DEL_UMBRAL, ENTERO } from "@/modules/settings/limites";
import type { ConfiguracionDelSitio } from "@/modules/settings/queries";

/** En el orden en que se ven: al fallar el envío el foco va al primero con error. */
const CAMPOS = [
  "whatsappNumber",
  "instagramUrl",
  "facebookUrl",
  "adminNotificationEmail",
  "lowStockThreshold",
] as const;

type Campo = (typeof CAMPOS)[number];

/**
 * Las escenas por fecha (RF-38), en el orden del año. El período escrito lo
 * trae la página, del mismo lugar que decide cuándo se encienden.
 */
const FECHAS = [
  { escena: "pascua", nombre: "Pascua", columna: "easterScene" },
  { escena: "halloween", nombre: "Halloween", columna: "halloweenScene" },
  { escena: "navidad", nombre: "Navidad", columna: "christmasScene" },
] as const satisfies readonly {
  escena: Scene;
  nombre: string;
  columna: keyof ConfiguracionDelSitio;
}[];

type Columna = (typeof FECHAS)[number]["columna"];

/**
 * Configuración del sitio — RF-20. La fila puede no existir todavía: la
 * escribe este formulario la primera vez que se guarda.
 */
export function FormularioDeConfiguracion({
  configuracion,
  umbralPorDefecto,
  periodos,
}: {
  /** `null` = todavía no se guardó nunca. */
  configuracion: ConfiguracionDelSitio | null;
  /** El que usa el sistema mientras la fila no existe. */
  umbralPorDefecto: number;
  /** Cada período escrito, «Del 1 de diciembre al 7 de enero.». */
  periodos: Record<Scene, string>;
}) {
  const idBase = useId();
  const [enviando, iniciar] = useTransition();
  const [errores, setErrores] = useState<FormErrors<Campo>>(NO_ERRORS);

  /**
   * Lo último que se sabe guardado: lo que devuelve la acción, no lo enviado
   * (el número vuelve normalizado a `+549…`).
   */
  const [guardado, setGuardado] = useState(configuracion);
  const [seGuardoRecien, setSeGuardoRecien] = useState(false);

  // Sin el `+549`: el campo ya muestra el +54 (`Input`, `type="tel"`).
  const [whatsapp, setWhatsapp] = useState(
    localPhone(configuracion?.whatsappNumber ?? ""),
  );
  const [instagram, setInstagram] = useState(configuracion?.instagramUrl ?? "");
  const [facebook, setFacebook] = useState(configuracion?.facebookUrl ?? "");
  const [email, setEmail] = useState(
    configuracion?.adminNotificationEmail ?? "",
  );
  // Se muestra el umbral que el sistema ya usa: otro número haría que guardar
  // sin tocar nada cambiara el listado.
  const [umbral, setUmbral] = useState(
    String(configuracion?.lowStockThreshold ?? umbralPorDefecto),
  );
  // Sin fila, prendidas: es lo que la tienda está haciendo (`ALL_ALLOWED`).
  const [escenas, setEscenas] = useState<Record<Columna, boolean>>({
    easterScene: configuracion?.easterScene ?? true,
    halloweenScene: configuracion?.halloweenScene ?? true,
    christmasScene: configuracion?.christmasScene ?? true,
  });

  const errorGeneral = useRef<HTMLDivElement | null>(null);

  /**
   * Se calcula durante el render: tocar un campo apaga la confirmación y
   * volver atrás la enciende.
   */
  const sinCambios =
    guardado !== null &&
    whatsapp === localPhone(guardado.whatsappNumber) &&
    instagram === (guardado.instagramUrl ?? "") &&
    facebook === (guardado.facebookUrl ?? "") &&
    email === guardado.adminNotificationEmail &&
    umbral === String(guardado.lowStockThreshold) &&
    FECHAS.every(({ columna }) => escenas[columna] === guardado[columna]);

  // `conAyuda: false` para los campos sin ayuda, o `aria-describedby` apunta
  // a un id que no existe.
  const campo = (nombre: Campo, conAyuda = true) => ({
    id: `${idBase}-${nombre}`,
    "aria-invalid": Boolean(errores.fields[nombre]) || undefined,
    "aria-describedby": errores.fields[nombre]
      ? `${idBase}-${nombre}-error`
      : conAyuda
        ? `${idBase}-${nombre}-ayuda`
        : undefined,
  });

  /**
   * Escribir en un campo apaga su error y el general: si no, corregir el valor
   * hasta igualar lo guardado apaga «Guardar» y deja un error que no se puede
   * sacar de la pantalla.
   */
  const escribir =
    (nombre: Campo, poner: (v: string) => void) =>
    (evento: React.ChangeEvent<HTMLInputElement>) => {
      poner(evento.target.value);

      if (errores.fields[nombre] || errores.general) {
        setErrores((previos) => ({
          ...previos,
          general: null,
          fields: { ...previos.fields, [nombre]: undefined },
        }));
      }
    };

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setErrores(NO_ERRORS);
    setSeGuardoRecien(false);

    // Sin dígitos no hay número que mandar y `NaN` no sobrevive al viaje. El
    // mensaje es el mismo que daría el servidor.
    if (!ENTERO.test(umbral.trim())) {
      setErrores({
        ...NO_ERRORS,
        fields: { lowStockThreshold: AYUDA_DEL_UMBRAL },
      });
      document.getElementById(`${idBase}-lowStockThreshold`)?.focus();
      return;
    }

    iniciar(async () => {
      const resultado = await guardarLaConfiguracion({
        whatsappNumber: whatsapp,
        instagramUrl: instagram,
        facebookUrl: facebook,
        adminNotificationEmail: email,
        // `Number.parseInt` explícito, como pide la regla de lint (TS §7.1):
        // es un conteo, no un monto.
        lowStockThreshold: Number.parseInt(umbral.trim(), 10),
        ...escenas,
      });

      if (!resultado.ok) {
        const nuevos = readErrors<Campo>(resultado);
        setErrores(nuevos);

        const primero = CAMPOS.find((c) => nuevos.fields[c]);
        if (primero) document.getElementById(`${idBase}-${primero}`)?.focus();
        else errorGeneral.current?.focus();
        return;
      }

      // Se pisan los campos con lo guardado: el número normalizado confirma
      // que se entendió.
      setGuardado(resultado.data);
      setWhatsapp(localPhone(resultado.data.whatsappNumber));
      setInstagram(resultado.data.instagramUrl ?? "");
      setFacebook(resultado.data.facebookUrl ?? "");
      setEmail(resultado.data.adminNotificationEmail);
      setUmbral(String(resultado.data.lowStockThreshold));
      setEscenas({
        easterScene: resultado.data.easterScene,
        halloweenScene: resultado.data.halloweenScene,
        christmasScene: resultado.data.christmasScene,
      });
      setSeGuardoRecien(true);
    });
  }

  return (
    // Una tarjeta con «Guardar» adentro y al pie (DESIGN.md, «Guardar»).
    <form onSubmit={enviar} noValidate className="min-w-0">
      <TarjetaDeSeccion id="datos-de-la-tienda" titulo="Datos de la tienda">
        {guardado === null ? <SinConfigurar umbral={umbralPorDefecto} /> : null}

        {/* Lo que ve el comprador */}
        <Apartado
          primero
          id="contacto"
          titulo="Contacto"
          ayuda="Por dónde te contactan los compradores."
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={campo("whatsappNumber").id}>
              Número de WhatsApp
            </Label>
            <Input
              {...campo("whatsappNumber", false)}
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={whatsapp}
              onChange={escribir("whatsappNumber", setWhatsapp)}
              className="sm:max-w-64"
            />
            <FieldError id={`${idBase}-whatsappNumber-error`}>
              {errores.fields.whatsappNumber}
            </FieldError>
          </div>

          {/* Las redes se pegan como vengan y vuelven normalizadas. */}
          {(
            [
              ["instagramUrl", "Instagram", instagram, setInstagram],
              ["facebookUrl", "Facebook", facebook, setFacebook],
            ] as const
          ).map(([nombre, red, valor, poner]) => (
            <div key={nombre} className="flex flex-col gap-1.5">
              <Label htmlFor={campo(nombre).id}>
                {red}
                <span className="font-normal text-ink-secondary">
                  (opcional)
                </span>
              </Label>
              <Input
                {...campo(nombre, false)}
                type="text"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={valor}
                onChange={escribir(nombre, poner)}
                placeholder={`${red.toLowerCase()}.com/anavende`}
                className="sm:max-w-96"
              />
              <FieldError id={`${idBase}-${nombre}-error`}>
                {errores.fields[nombre]}
              </FieldError>
            </div>
          ))}
        </Apartado>

        {/* Las escenas por fecha */}
        <Apartado
          id="fechas"
          titulo="Fechas especiales"
          ayuda="En estas fechas la tienda se decora sola."
        >
          <ul className="flex flex-col gap-1">
            {FECHAS.map(({ escena, nombre, columna }) => (
              <li key={escena} className="flex min-h-11 items-start gap-3 py-1">
                <Checkbox
                  id={`${idBase}-${columna}`}
                  checked={escenas[columna]}
                  onCheckedChange={(v) =>
                    setEscenas((previas) => ({
                      ...previas,
                      [columna]: v === true,
                    }))
                  }
                  aria-describedby={`${idBase}-${columna}-ayuda`}
                  className="mt-0.5"
                />
                <div className="flex flex-col gap-0.5">
                  <label
                    htmlFor={`${idBase}-${columna}`}
                    className="text-body-sm font-medium text-ink"
                  >
                    {nombre}
                  </label>
                  <FieldHint id={`${idBase}-${columna}-ayuda`}>
                    {periodos[escena]}
                  </FieldHint>
                </div>
              </li>
            ))}
          </ul>
        </Apartado>

        {/* Lo que ve solo la vendedora */}
        <Apartado
          id="avisos"
          titulo="Avisos"
          ayuda="Los avisos que te manda la tienda."
        >
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
              className="sm:max-w-80"
            />
            {errores.fields.adminNotificationEmail ? (
              <FieldError id={`${idBase}-adminNotificationEmail-error`}>
                {errores.fields.adminNotificationEmail}
              </FieldError>
            ) : (
              <FieldHint id={`${idBase}-adminNotificationEmail-ayuda`}>
                Acá te llegan las órdenes nuevas.
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
                // La unidad está al lado del campo y no en la etiqueta: sin
                // esto el lector de pantalla no dice de qué es el número.
                aria-describedby={
                  errores.fields.lowStockThreshold
                    ? `${idBase}-lowStockThreshold-error ${idBase}-unidades`
                    : `${idBase}-unidades`
                }
                // `inputMode` y no `type="number"`: la rueda del mouse cambiaría
                // el umbral de todo el catálogo al bajar la página.
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
            <FieldError id={`${idBase}-lowStockThreshold-error`}>
              {errores.fields.lowStockThreshold}
            </FieldError>
          </div>
        </Apartado>

        <div ref={errorGeneral} tabIndex={-1} className="outline-none">
          <FieldError>{errores.general}</FieldError>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
          {/* Por qué «Guardar» está apagado, escrito y no en un `title` (§8). */}
          <EstadoDeGuardado
            estado={
              !sinCambios
                ? "sin-guardar"
                : seGuardoRecien
                  ? "actualizado"
                  : "guardado"
            }
          />

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
      </TarjetaDeSeccion>
    </form>
  );
}

/**
 * El estado vacío (§8): la configuración nunca se guardó. Dice qué usa el
 * sistema mientras tanto, o los campos parecerían guardados.
 */
function SinConfigurar({ umbral }: { umbral: number }) {
  return (
    <p className="rounded-panel-card border border-dashed border-border bg-surface-sunken px-4 py-3 text-body-sm text-ink-secondary">
      Todavía no guardaste la configuración. Hasta que lo hagas no hay número de
      WhatsApp para mostrar en la tienda, y el aviso de stock bajo se enciende
      con {umbral} unidades.
    </p>
  );
}
