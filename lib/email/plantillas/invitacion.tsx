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
 * E3 (TECHNICAL-SPEC §14, RF-26). Lo emite GoTrue con `inviteUserByEmail`.
 *
 * Sin `{{ .RedirectTo }}` a propósito: si quien invita no pasa `redirectTo`,
 * sale vacío y el enlace queda roto. Se arma desde `{{ .SiteURL }}`.
 */
export function Invitacion({
  sitio = "http://localhost:3000",
  enlace = "http://localhost:3000/api/auth/confirmar",
  saludo = ", Matías",
}: Partial<PropsDeEnlace> = {}) {
  return (
    <Marco
      sitio={sitio}
      adelanto="Te crearon una cuenta en AnaVende. Elegí tu contraseña."
      pie={
        <PieDeEnlace href={enlace}>
          Si no esperabas este mensaje, escribinos antes de usar el enlace y lo
          revisamos.
        </PieDeEnlace>
      }
    >
      <Parrafo>¡Hola{saludo}!</Parrafo>

      <Parrafo>
        Te creamos una cuenta en AnaVende. Para empezar a usarla, elegí tu
        contraseña con el botón de abajo.
      </Parrafo>

      <Boton href={enlace}>Definir mi contraseña</Boton>

      <Ayuda />

      <Firma>
        Gracias,
        <br />
        el equipo de AnaVende
      </Firma>
    </Marco>
  );
}
