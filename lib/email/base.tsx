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
  /** El cuerpo: saludo, mensaje, acción y firma. Lo que una persona escribiría.
   *
   *  **No hay título.** El asunto del email ya dice de qué se trata, y una
   *  carta que encabeza y además saluda no se lee como escrita por alguien. */
  children: ReactNode;
  /** La letra chica, debajo del separador: el enlace de respaldo, la ayuda y
   *  la salida para quien no esperaba este email. Va aparte a propósito — si
   *  compite con el mensaje principal, los dos pierden. */
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

          {children}

          <Hr
            style={{
              margin: "32px 0 20px",
              border: "none",
              borderTop: `1px solid ${COLOR.borde}`,
            }}
          />

          {pie}

          {/* DESIGN-REFERENCE §2.4: en emails va la forma canónica del
              eslogan, nunca una rotada. Se lee una sola vez y tiene que decir
              de qué se trata; una frase que cambia sin motivo visible parece
              un error, no un gesto. */}
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

/** Enlace dentro de un párrafo. Existe para que las cuatro plantillas no
 *  repitan el estilo: en email no hay hoja de estilos donde ponerlo una vez. */
export function Enlace({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} style={{ color: COLOR.marca, textDecoration: "underline" }}>
      {children}
    </a>
  );
}

/** Dónde escribe alguien que se quedó trabado. Es una constante y no sale de
 *  `site_settings`: GoTrue arma E1, E2 y E3 sin consultar nuestra base, así
 *  que el día que cambie hay que cambiarla acá y regenerar. */
export const CASILLA_DE_AYUDA = "hola@anavende.com.ar";

/** La salida, dentro del cuerpo y debajo del botón: si la persona se traba,
 *  tiene que estar donde está mirando y no en la letra chica. */
export function Ayuda() {
  return (
    <Parrafo>
      ¿Necesitás ayuda? Escribinos a{" "}
      <Enlace href={`mailto:${CASILLA_DE_AYUDA}`}>{CASILLA_DE_AYUDA}</Enlace>.
    </Parrafo>
  );
}

/** Firma del cuerpo. Cierra la carta antes de la letra chica. */
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

/** Texto de la letra chica: mismo tamaño y tono para todo lo que va debajo
 *  del separador, para que ninguna línea de servicio pese más que otra. */
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

/**
 * La letra chica de los tres emails que llevan un enlace de un solo uso
 * (E1, E2, E3): la dirección para copiar y la salida para quien no esperaba
 * el mensaje, que cambia según el email.
 */
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
