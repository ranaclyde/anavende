import { Ayuda, Boton, Firma, Marco, Parrafo, PieDeEnlace } from "@/lib/email/base";
import type { PropsDeEnlace } from "@/lib/email/plantillas/verificacion";

/**
 * E2 — Recuperación de contraseña (TECHNICAL-SPEC §14, FUNCTIONAL-SPEC RF-06).
 * Lo emite GoTrue cuando alguien lo pide desde `/recuperar`, y también cuando
 * se restablece una contraseña desde el panel.
 *
 * El enlace usa `token_hash` por el mismo motivo que E1. Acá el pedido nace en
 * el navegador —`resetPasswordForEmail`, que sí registra el desafío PKCE— así
 * que el otro camino funcionaría; se usa este igual para no tener dos maneras
 * de hacer lo mismo, y porque no depende de que sobreviva una cookie.
 *
 * `{{ .RedirectTo }}` trae `next=/recuperar/nueva-contrasena`, que lo pone
 * `components/shop/forgot-password-form.tsx`: la pantalla donde se elige la
 * contraseña nueva.
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
        Nos pediste cambiar la contraseña de tu cuenta de AnaVende. Hacé clic
        en el botón de abajo para elegir una nueva.
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
