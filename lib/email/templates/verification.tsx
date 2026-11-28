import {
  Help,
  Button,
  Signature,
  Frame,
  Paragraph,
  LinkFooter,
} from "@/lib/email/base";

/**
 * E1 (TECHNICAL-SPEC §14, RF-05). Lo emite GoTrue.
 *
 * El enlace va a `/api/auth/confirmar` con `token_hash`, no a
 * `/auth/v1/verify`: por ahí la sesión vuelve en el fragmento de la URL, que
 * el servidor nunca recibe, y se pierde. Sin el código de seis dígitos: no
 * hay dónde escribirlo.
 */

export type LinkProps = {
  site: string;
  link: string;
  /** Lo que va después de «¡Hola». */
  greeting: string;
};

/**
 * Export nombrado y no `default`: `generate.mts` (ES) recibe estos `.tsx`
 * compilados a CommonJS, y un `default` llega envuelto y React lo rechaza.
 */
export function Verification({
  // Para la previsualización local (`npm run email`).
  site = "http://localhost:3000",
  link = "http://localhost:3000/api/auth/confirmar",
  greeting = ", Matías",
}: Partial<LinkProps> = {}) {
  return (
    <Frame
      site={site}
      preview="Te queda un paso para acceder a tu cuenta de AnaVende."
      footer={
        <LinkFooter href={link}>
          Si no fuiste vos, podés ignorar este mensaje: sin confirmar, la cuenta
          no se activa.
        </LinkFooter>
      }
    >
      <Paragraph>¡Hola{greeting}!</Paragraph>

      <Paragraph>
        Solo te queda un paso más para acceder a tu cuenta de AnaVende. Hacé
        clic en el botón de abajo para verificar tu email.
      </Paragraph>

      <Button href={link}>Confirmar mi email</Button>

      <Help />

      <Signature>
        Gracias,
        <br />
        el equipo de AnaVende
      </Signature>
    </Frame>
  );
}
