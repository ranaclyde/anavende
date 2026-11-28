import {
  Help,
  Button,
  Signature,
  Frame,
  Paragraph,
  LinkFooter,
} from "@/lib/email/base";
import type { LinkProps } from "@/lib/email/templates/verification";

/**
 * E2 (TECHNICAL-SPEC §14, RF-06). Lo emite GoTrue. Usa `token_hash` como E1.
 */
export function PasswordReset({
  site = "http://localhost:3000",
  link = "http://localhost:3000/api/auth/confirmar",
  greeting = ", Matías",
}: Partial<LinkProps> = {}) {
  return (
    <Frame
      site={site}
      preview="Elegí una contraseña nueva para tu cuenta de AnaVende."
      footer={
        <LinkFooter href={link}>
          Si no pediste el cambio, podés ignorar este mensaje: tu contraseña
          actual sigue funcionando.
        </LinkFooter>
      }
    >
      <Paragraph>¡Hola{greeting}!</Paragraph>

      <Paragraph>
        Nos pediste cambiar la contraseña de tu cuenta de AnaVende. Hacé clic en
        el botón de abajo para elegir una nueva.
      </Paragraph>

      <Button href={link}>Elegir una contraseña nueva</Button>

      <Help />

      <Signature>
        Gracias,
        <br />
        el equipo de AnaVende
      </Signature>
    </Frame>
  );
}
