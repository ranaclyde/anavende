import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "react-email";
import type { ReactNode } from "react";

// Tablas, `style` en línea y píxeles enteros a propósito: los clientes de
// email no tienen flexbox ni grid y descartan las hojas de estilo. Solo paleta
// clara, con cada fondo declarado: el modo oscuro en email no es confiable.

// Los clientes de email casi nunca cargan fuentes web.
const TIPOGRAFIA =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const COLOR = {
  marca: "#832833",
  lienzo: "#f2f4f5",
  superficie: "#ffffff",
  texto: "#16181a",
  textoSecundario: "#6b6f73",
  textoTerciario: "#9aa0a5",
  borde: "#e6e9ea",
} as const;

export type MarcoProps = {
  /**
   * Raíz absoluta: Gmail bloquea las imágenes en `data:`, el logo va por HTTP.
   */
  sitio: string;
  adelanto: string;
  children: ReactNode;
  pie?: ReactNode;
};

export function Marco({ sitio, adelanto, children, pie }: MarcoProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{adelanto}</Preview>
      <Body
        lang="es"
        style={{
          margin: 0,
          padding: "32px 16px",
          backgroundColor: COLOR.lienzo,
          fontFamily: TIPOGRAFIA,
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "40px",
            backgroundColor: COLOR.superficie,
            borderRadius: "24px",
          }}
        >
          <Section style={{ textAlign: "center", paddingBottom: "28px" }}>
            {/* En imagen: el correo no tiene la letra del logo. */}
            <Img
              src={`${sitio}/marca/logo-horizontal.png`}
              width="176"
              height="40"
              alt="AnaVende"
              style={{ display: "inline-block" }}
            />
          </Section>

          {children}

          <Hr
            style={{
              margin: "32px 0 20px",
              border: "none",
              borderTop: `1px solid ${COLOR.borde}`,
            }}
          />

          {pie}

          {/* La forma canónica del eslogan (DESIGN-REFERENCE §2.4). */}
          <Text
            style={{
              margin: "16px 0 0",
              fontSize: "13px",
              lineHeight: "1.5",
              color: COLOR.textoTerciario,
            }}
          >
            Ana vende, vos elegís la tecnología.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function Parrafo({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontSize: "16px",
        lineHeight: "1.6",
        color: COLOR.texto,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Sin el `Button` de React Email: el `href` tiene que salir tal cual para que
 * GoTrue sustituya sus variables.
 */
export function Boton({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Section style={{ padding: "8px 0 24px" }}>
      <a
        href={href}
        style={{
          display: "inline-block",
          padding: "14px 28px",
          backgroundColor: COLOR.marca,
          color: "#ffffff",
          fontSize: "16px",
          fontWeight: 600,
          borderRadius: "9999px",
          textDecoration: "none",
        }}
      >
        {children}
      </a>
    </Section>
  );
}

export function Enlace({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a href={href} style={{ color: COLOR.marca, textDecoration: "underline" }}>
      {children}
    </a>
  );
}

/**
 * Constante y no de `site_settings`: GoTrue arma E1, E2 y E3 sin consultar la
 * base. Si cambia, regenerar.
 */
export const CASILLA_DE_AYUDA = "ana_vende@outlook.com";

export function Ayuda() {
  return (
    <Parrafo>
      ¿Necesitás ayuda? Escribinos a{" "}
      <Enlace href={`mailto:${CASILLA_DE_AYUDA}`}>{CASILLA_DE_AYUDA}</Enlace>.
    </Parrafo>
  );
}

export function Firma({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0",
        fontSize: "16px",
        lineHeight: "1.6",
        color: COLOR.texto,
      }}
    >
      {children}
    </Text>
  );
}

export function Menor({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        margin: "0 0 12px",
        fontSize: "13px",
        lineHeight: "1.5",
        color: COLOR.textoSecundario,
      }}
    >
      {children}
    </Text>
  );
}

/** No es redundante: hay clientes que no pintan el botón. */
export function EnlaceDeRespaldo({ href }: { href: string }) {
  return (
    <>
      <Text
        style={{
          margin: "0 0 6px",
          fontSize: "13px",
          lineHeight: "1.5",
          color: COLOR.textoTerciario,
        }}
      >
        Si el botón no te funciona, copiá y pegá esta dirección en el navegador:
      </Text>
      {/* También como enlace, por si el botón no se pintó. */}
      <a
        href={href}
        style={{
          display: "block",
          marginBottom: "16px",
          fontSize: "13px",
          lineHeight: "1.5",
          color: COLOR.textoSecundario,
          wordBreak: "break-all",
        }}
      >
        {href}
      </a>
    </>
  );
}

export function PieDeEnlace({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <>
      <EnlaceDeRespaldo href={href} />
      <Menor>{children}</Menor>
    </>
  );
}
