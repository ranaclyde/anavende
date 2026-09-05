import {
  Boton,
  Enlace,
  EnlaceDeRespaldo,
  Firma,
  Marco,
  Menor,
  Parrafo,
} from "@/lib/email/base";

/**
 * E1 — Verificación de email (TECHNICAL-SPEC §14, FUNCTIONAL-SPEC RF-05).
 * Lo emite GoTrue al registrarse y al pedir el reenvío.
 *
 * **El enlace no pasa por `/auth/v1/verify`.** Va derecho a
 * `/api/auth/confirmar` con `token_hash`, que es lo que la documentación de
 * Supabase recomienda para aplicaciones que renderizan en el servidor. Por el
 * otro camino la sesión vuelve en el fragmento de la URL (`#access_token=…`),
 * que el navegador nunca le manda al servidor: la cuenta queda confirmada y
 * la sesión se pierde. Nos pasó en producción; está en PROGRESO.md.
 *
 * **No lleva el código de seis dígitos** que trae la plantilla por defecto de
 * Supabase: no hay ninguna pantalla donde escribirlo, y ofrecer una salida que
 * no existe es peor que no ofrecerla.
 */

/** Dónde escribe alguien que se quedó trabado. Es una constante y no sale de
 *  `site_settings`: GoTrue arma estos emails sin consultar nuestra base, así
 *  que el día que cambie hay que cambiarlo acá y regenerar. */
export const CASILLA_DE_AYUDA = "hola@anavende.com.ar";

type Props = {
  sitio: string;
  enlace: string;
  /** Lo que va después de «¡Hola». En la plantilla de GoTrue llega una
   *  condición que resuelve el nombre o no pone nada: ver `generar.mts`. */
  saludo: string;
};

/**
 * Export NOMBRADO y no `export default`, que es la convención de React Email:
 * `generar.mts` es un módulo ES y estos `.tsx` se compilan a CommonJS, así que
 * un `export default` le llega envuelto en el objeto del módulo y React lo
 * rechaza con «Element type is invalid». Los nombrados no pasan por ahí.
 */
export function Verificacion({
  // Valores para la previsualización local (`npm run email`). En la plantilla
  // de GoTrue los reemplazan sus variables.
  sitio = "http://localhost:3000",
  enlace = "http://localhost:3000/api/auth/confirmar",
  saludo = ", Matías",
}: Partial<Props> = {}) {
  return (
    <Marco
      sitio={sitio}
      adelanto="Te queda un paso para acceder a tu cuenta de AnaVende."
      pie={
        <>
          <EnlaceDeRespaldo href={enlace} />
          <Menor>
            Si no fuiste vos, podés ignorar este mensaje: sin confirmar, la
            cuenta no se activa.
          </Menor>
        </>
      }
    >
      <Parrafo>¡Hola{saludo}!</Parrafo>

      <Parrafo>
        Solo te queda un paso más para acceder a tu cuenta de AnaVende. Hacé
        clic en el botón de abajo para verificar tu email.
      </Parrafo>

      <Boton href={enlace}>Confirmar mi email</Boton>

      <Parrafo>
        ¿Necesitás ayuda? Escribinos a{" "}
        <Enlace href={`mailto:${CASILLA_DE_AYUDA}`}>{CASILLA_DE_AYUDA}</Enlace>.
      </Parrafo>

      <Firma>
        Gracias,
        <br />
        el equipo de AnaVende
      </Firma>
    </Marco>
  );
}
