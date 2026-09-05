import { Ayuda, Boton, Firma, Marco, Parrafo, PieDeEnlace } from "@/lib/email/base";
import type { PropsDeEnlace } from "@/lib/email/plantillas/verificacion";

/**
 * E3 — Definición de contraseña de cuenta nueva (TECHNICAL-SPEC §14,
 * FUNCTIONAL-SPEC RF-26). Lo emite GoTrue con `inviteUserByEmail`, cuando la
 * vendedora da de alta a alguien a mano desde el panel.
 *
 * **Este NO usa `{{ .RedirectTo }}`, y es a propósito.** En E1 y E2 el enlace
 * lo arma la aplicación y siempre pasa un destino. Acá quien invita es una
 * pantalla del panel que todavía no existe (RF-26): si el día que se escriba
 * nadie se acuerda de pasar `redirectTo`, `{{ .RedirectTo }}` sale vacío y el
 * enlace queda roto —y se descubre cuando una persona real no puede entrar—.
 * Armarlo desde `{{ .SiteURL }}` lo hace imposible de olvidar. La asimetría
 * está acá escrita para que se vea que fue una decisión.
 *
 * **El saludo puede quedar en «¡Hola!» y está bien.** El alta por invitación
 * no conoce el nombre de pila salvo que RF-26 lo cargue en los metadatos; la
 * condición del generador lo resuelve sin romper nada.
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
