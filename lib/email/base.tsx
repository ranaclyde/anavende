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

/**
 * Marco compartido de los cuatro emails — TECHNICAL-SPEC §14, RF-30.
 * La identidad sale de DESIGN-REFERENCE, no se inventa acá:
 * §2.3 fija el logo en emails (40px, isotipo + palabra, centrado), §3.1 los
 * colores y §3.5 los radios.
 *
 * **Por qué el código se ve viejo.** Los clientes de email no tienen flexbox
 * ni grid —Outlook usa el motor de Word— y descartan las hojas de estilo. Todo
 * va en tablas y en `style` en línea, y las medidas son píxeles enteros. No es
 * descuido: es lo único que se ve igual en Gmail, Outlook y Apple Mail.
 *
 * **Una sola paleta, la clara.** No hay modo oscuro confiable en email: cada
 * cliente lo resuelve distinto y algunos invierten los colores por su cuenta.
 * Por eso cada fondo se declara explícitamente en vez de dejarse heredar.
 */

/** Inter no viaja: los clientes de email casi nunca cargan fuentes web. Esta
 *  pila es la que más se le parece con lo que ya está instalado. */
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
  /** Raíz absoluta del sitio. En las plantillas de GoTrue llega `{{ .SiteURL }}`.
   *  El logo NO puede ser una ruta relativa ni ir incrustado: Gmail bloquea las
   *  imágenes en `data:` y hay que servirlas por HTTP desde el dominio. */
  sitio: string;
  /** Lo que se lee al lado del asunto en la bandeja, antes de abrir. */
  adelanto: string;
  titulo: string;
  children: ReactNode;
  /** Va DEBAJO del separador, en el tono más bajo: la salida para quien no
   *  esperaba este email. Separada del cuerpo a propósito — si compite con el
   *  mensaje principal, los dos pierden. */
  nota?: ReactNode;
};

export function Marco({ sitio, adelanto, titulo, children, nota }: MarcoProps) {
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
            // §3.5: el radio de la tarjeta de la tienda. El email le habla a
            // la compradora, no a la vendedora, así que usa ese lenguaje.
            borderRadius: "24px",
          }}
        >
          <Section style={{ textAlign: "center", paddingBottom: "28px" }}>
            <Img
              src={`${sitio}/marca/logo.png`}
              width="40"
              height="38"
              alt="AnaVende"
              style={{ display: "inline-block", verticalAlign: "middle" }}
            />
            <span
              style={{
                display: "inline-block",
                verticalAlign: "middle",
                paddingLeft: "10px",
                fontSize: "20px",
                fontWeight: 600,
                letterSpacing: "-0.01em",
                color: COLOR.texto,
              }}
            >
              AnaVende
            </span>
          </Section>

          <Text
            style={{
              margin: "0 0 16px",
              fontSize: "22px",
              lineHeight: "1.3",
              fontWeight: 600,
              color: COLOR.texto,
            }}
          >
            {titulo}
          </Text>

          {children}

          <Hr
            style={{
              margin: "32px 0 20px",
              border: "none",
              borderTop: `1px solid ${COLOR.borde}`,
            }}
          />

          {nota ? (
            <Text
              style={{
                margin: "0 0 12px",
                fontSize: "13px",
                lineHeight: "1.5",
                color: COLOR.textoSecundario,
              }}
            >
              {nota}
            </Text>
          ) : null}

          <Text
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: "1.5",
              color: COLOR.textoTerciario,
            }}
          >
            AnaVende — Tecnología y gaming
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/** Párrafo del cuerpo. Existe para que los cuatro emails no ajusten cada uno
 *  su interlineado a ojo. */
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
 * Botón de acción.
 *
 * No usa el componente `Button` de React Email a propósito: necesitamos que el
 * `href` salga tal cual para que GoTrue pueda sustituir sus variables adentro.
 *
 * DESIGN-REFERENCE §10: dice la acción concreta, nunca «Aceptar».
 */
export function Boton({ href, children }: { href: string; children: ReactNode }) {
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
          // §3.5: la tienda usa el botón pastilla.
          borderRadius: "9999px",
          textDecoration: "none",
        }}
      >
        {children}
      </a>
    </Section>
  );
}

/**
 * El mismo enlace, en texto.
 *
 * No es redundancia: hay clientes que no pintan el botón, y hay gente que
 * copia y pega. Un email de verificación sin salida alternativa es una cuenta
 * que no se puede crear.
 */
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
      {/* Además de estar a la vista para copiar, va como enlace: si el botón
          no se pintó pero los enlaces sí, con tocarlo alcanza. */}
      <a
        href={href}
        style={{
          display: "block",
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
