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
 * Cloudflare Turnstile (TECHNICAL-SPEC §16). Lo valida GoTrue, no la tienda:
 * el token viaja como `captchaToken`. Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no
 * dibuja nada y la pantalla no espera token.
 *
 * Cada token sirve para un solo pedido: la pantalla llama a `reiniciar()`
 * después de cada envío, haya salido bien o mal.
 */

const CLAVE_DEL_SITIO = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

/** Sin verificación, la pantalla no espera ningún token. */
export const TURNSTILE_ACTIVO = CLAVE_DEL_SITIO !== "";

/**
 * Letras, números, `-` y `_`, hasta 32: lo que acepta Cloudflare. GoTrue no
 * la compara: sirve para contar intentos por pantalla, no para frenarlos.
 */
export type AccionDeTurnstile = "ingreso" | "alta" | "recuperacion" | "reenvio";

const SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type ApiDeTurnstile = {
  render(
    elemento: HTMLElement,
    opciones: {
      sitekey: string;
      action: AccionDeTurnstile;
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
      // Si no, un fallo de red dejaría la promesa rechazada para siempre.
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
  accion,
  onToken,
  idDelAviso,
  ref,
}: {
  accion: AccionDeTurnstile;
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
          action: accion,
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
    // `accion` no cambia en la vida de una pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!TURNSTILE_ACTIVO) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Alto reservado: si no, el formulario salta al aparecer el widget. */}
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
