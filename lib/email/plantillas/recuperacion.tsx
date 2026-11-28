import {
  Ayuda,
  Boton,
  Firma,
  Marco,
  Parrafo,
  PieDeEnlace,
} from "@/lib/email/base";
import type { PropsDeEnlace } from "@/lib/email/plantillas/verificacion";

/**
 * E2 (TECHNICAL-SPEC §14, RF-06). Lo emite GoTrue. Usa `token_hash` como E1.
 */
export function Recuperacion({
  sitio = "http://localhost:3000",
  enlace = "http://localhost:3000/api/auth/confirmar",
  saludo = ", Matías",
}: Partial<PropsDeEnlace> = {}) {
  return (
    <Marco
      sitio={sitio}
      adelanto="Elegí una contraseña nueva para tu cuenta de AnaVende."
      pie={
        <PieDeEnlace href={enlace}>
          Si no pediste el cambio, podés ignorar este mensaje: tu contraseña
          actual sigue funcionando.
        </PieDeEnlace>
      }
    >
      <Parrafo>¡Hola{saludo}!</Parrafo>

      <Parrafo>
        Nos pediste cambiar la contraseña de tu cuenta de AnaVende. Hacé clic en
        el botón de abajo para elegir una nueva.
      </Parrafo>

      <Boton href={enlace}>Elegir una contraseña nueva</Boton>

      <Ayuda />

      <Firma>
        Gracias,
        <br />
        el equipo de AnaVende
      </Firma>
    </Marco>
  );
}
