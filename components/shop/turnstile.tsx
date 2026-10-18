"use client";

import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";

/**
 * La verificación de Cloudflare Turnstile — F10.5b, TECHNICAL-SPEC §16.
 *
 * **La valida GoTrue, no la tienda**: el token viaja con la acción y la
 * acción se lo pasa a GoTrue (`captchaToken`), que lo comprueba contra
 * Cloudflare (`GOTRUE_SECURITY_CAPTCHA_*` en el servidor DATA). Con el
 * captcha prendido GoTrue lo pide para el alta, el ingreso con contraseña, la
 * recuperación y los reenvíos, y por eso esto está en esas cuatro pantallas.
 *
 * **Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no dibuja nada** y la pantalla no
 * espera ningún token: es el desarrollo sin claves, donde GoTrue tampoco lo
 * pide. Con las claves de prueba de Cloudflare se prueba entero en local.
 *
 * **El script se carga a mano, una sola vez y solo acá**: es de un tercero y
 * no tiene por qué viajar en el resto del sitio. Cada token sirve para un
 * solo pedido, así que la pantalla llama a `reiniciar()` después de cada
 * envío, haya salido bien o mal.
 */

const CLAVE_DEL_SITIO = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** ¿Hay verificación? Sin ella la pantalla no espera ningún token. */
export const TURNSTILE_ACTIVO = CLAVE_DEL_SITIO !== "";

const SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type ApiDeTurnstile = {
  render(
    elemento: HTMLElement,
    opciones: {
      sitekey: string;
      language: string;
      theme: "light" | "dark" | "auto";
      size: "normal" | "flexible" | "compact";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(id: string): void;
  remove(id: string): void;
};

declare global {
  interface Window {
    turnstile?: ApiDeTurnstile;
  }
}

let cargando: Promise<ApiDeTurnstile> | null = null;

function cargarElScript(): Promise<ApiDeTurnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  cargando ??= new Promise((listo, fallo) => {
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? listo(window.turnstile)
        : fallo(new Error("Turnstile no quedó disponible"));
    script.onerror = () => {
      // Sin esto, un fallo de red dejaría la promesa rechazada para siempre y
      // ni recargando el formulario se volvería a intentar.
      cargando = null;
      fallo(new Error("No se pudo cargar Turnstile"));
    };
    document.head.appendChild(script);
  });

  return cargando;
}

export type ControlDeTurnstile = {
  /** Descarta el token usado y pide uno nuevo. */
  reiniciar(): void;
};

export function Turnstile({
  onToken,
  idDelAviso,
  ref,
}: {
  /** El token listo, o `null` cuando vence, falla o se reinicia. */
  onToken: (token: string | null) => void;
  /** Para el `aria-describedby` del botón, que espera al token. */
  idDelAviso: string;
  ref?: Ref<ControlDeTurnstile>;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const [listo, setListo] = useState(false);
  const [noCargo, setNoCargo] = useState(false);

  const avisar = useEffectEvent((token: string | null) => {
    setListo(token !== null);
    onToken(token);
  });

  useImperativeHandle(ref, () => ({
    reiniciar() {
      setListo(false);
      onToken(null);
      if (widget.current) window.turnstile?.reset(widget.current);
    },
  }));

  useEffect(() => {
    if (!TURNSTILE_ACTIVO) return;
    let montado = true;

    cargarElScript()
      .then((turnstile) => {
        if (!montado || !contenedor.current) return;
        widget.current = turnstile.render(contenedor.current, {
          sitekey: CLAVE_DEL_SITIO,
          language: "es",
          theme: "light",
          size: "flexible",
          callback: (token) => avisar(token),
          "expired-callback": () => avisar(null),
          "error-callback": () => avisar(null),
        });
      })
      .catch(() => {
        if (montado) setNoCargo(true);
      });

    return () => {
      montado = false;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, []);

  if (!TURNSTILE_ACTIVO) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* El alto del widget reservado: sin esto, el formulario salta al
          aparecer. */}
      <div ref={contenedor} className="min-h-[65px]" />
      <p
        id={idDelAviso}
        aria-live="polite"
        className={
          noCargo
            ? "text-caption text-danger"
            : "text-caption text-ink-secondary"
        }
      >
        {noCargo
          ? "No pudimos cargar la verificación. Revisá la conexión, desactivá el bloqueador de anuncios si tenés uno, y recargá la página."
          : listo
            ? ""
            : "Esperá un segundo: estamos comprobando que sos una persona."}
      </p>
    </div>
  );
}
