import {
  Ayuda,
  Boton,
  Firma,
  Marco,
  Parrafo,
  PieDeEnlace,
} from "@/lib/email/base";

/**
 * E1 (TECHNICAL-SPEC §14, RF-05). Lo emite GoTrue.
 *
 * El enlace va a `/api/auth/confirmar` con `token_hash`, no a
 * `/auth/v1/verify`: por ahí la sesión vuelve en el fragmento de la URL, que
 * el servidor nunca recibe, y se pierde. Sin el código de seis dígitos: no
 * hay dónde escribirlo.
 */

export type PropsDeEnlace = {
  sitio: string;
  enlace: string;
  /** Lo que va después de «¡Hola». */
  saludo: string;
};

/**
 * Export nombrado y no `default`: `generar.mts` (ES) recibe estos `.tsx`
 * compilados a CommonJS, y un `default` llega envuelto y React lo rechaza.
 */
export function Verificacion({
  // Para la previsualización local (`npm run email`).
  sitio = "http://localhost:3000",
  enlace = "http://localhost:3000/api/auth/confirmar",
  saludo = ", Matías",
}: Partial<PropsDeEnlace> = {}) {
  return (
    <Marco
      sitio={sitio}
      adelanto="Te queda un paso para acceder a tu cuenta de AnaVende."
      pie={
        <PieDeEnlace href={enlace}>
          Si no fuiste vos, podés ignorar este mensaje: sin confirmar, la cuenta
          no se activa.
        </PieDeEnlace>
      }
    >
      <Parrafo>¡Hola{saludo}!</Parrafo>

      <Parrafo>
        Solo te queda un paso más para acceder a tu cuenta de AnaVende. Hacé
        clic en el botón de abajo para verificar tu email.
      </Parrafo>

      <Boton href={enlace}>Confirmar mi email</Boton>

      <Ayuda />

      <Firma>
        Gracias,
        <br />
        el equipo de AnaVende
      </Firma>
    </Marco>
  );
}
