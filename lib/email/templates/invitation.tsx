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
 * E3 (TECHNICAL-SPEC §14, RF-26). Lo emite GoTrue con `inviteUserByEmail`.
 *
 * Sin `{{ .RedirectTo }}` a propósito: si quien invita no pasa `redirectTo`,
 * sale vacío y el enlace queda roto. Se arma desde `{{ .SiteURL }}`.
 */
export function Invitation({
  site = "http://localhost:3000",
  link = "http://localhost:3000/api/auth/confirmar",
  greeting = ", Matías",
}: Partial<LinkProps> = {}) {
  return (
    <Frame
      site={site}
      preview="Te crearon una cuenta en AnaVende. Elegí tu contraseña."
      footer={
        <LinkFooter href={link}>
          Si no esperabas este mensaje, escribinos antes de usar el enlace y lo
          revisamos.
        </LinkFooter>
      }
    >
      <Paragraph>¡Hola{greeting}!</Paragraph>

      <Paragraph>
        Te creamos una cuenta en AnaVende. Para empezar a usarla, elegí tu
        contraseña con el botón de abajo.
      </Paragraph>

      <Button href={link}>Definir mi contraseña</Button>

      <Help />

      <Signature>
        Gracias,
        <br />
        el equipo de AnaVende
      </Signature>
    </Frame>
  );
}
