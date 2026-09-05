import { Boton, EnlaceDeRespaldo, Marco, Parrafo } from "@/lib/email/base";

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

type Props = {
  sitio: string;
  enlace: string;
};

/**
 * Export NOMBRADO y no `export default`, que es la convención de React Email:
 * `generar.mts` es un módulo ES y estos `.tsx` se compilan a CommonJS, así que
 * un `export default` le llega envuelto en el objeto del módulo y React lo
 * rechaza con «Element type is invalid». Los nombrados no pasan por ahí.
 */
export function Verificacion({
  // Valores para la previsualización local (`npm run email`). En la plantilla
  // de GoTrue los reemplazan sus variables: ver `generar.mts`.
  sitio = "http://localhost:3000",
  enlace = "http://localhost:3000/api/auth/confirmar?next=%2Fmi-cuenta&token_hash=ejemplo&type=signup",
}: Partial<Props> = {}) {
  return (
    <Marco
      sitio={sitio}
      adelanto="Confirmá tu email para terminar de crear tu cuenta."
      titulo="Confirmá tu email"
      nota="Si no fuiste vos, podés ignorar este mensaje: sin confirmar, la cuenta no se activa."
    >
      <Parrafo>
        Ya casi. Tocá el botón para confirmar tu dirección y terminar de crear
        tu cuenta en AnaVende.
      </Parrafo>

      <Boton href={enlace}>Confirmar mi email</Boton>

      <EnlaceDeRespaldo href={enlace} />
    </Marco>
  );
}
