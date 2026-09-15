import { Column, Row, Section, Text } from "react-email";

import { Boton, COLOR, Marco, Menor, Parrafo } from "@/lib/email/base";

/**
 * E4 — Nueva orden recibida (TECHNICAL-SPEC §14, FUNCTIONAL-SPEC RF-30).
 * Tarea F6.4. Lo emite **nuestra aplicación**, no GoTrue.
 *
 * **Es el único de los cuatro que no le habla a un comprador**, y eso cambia
 * casi todo. Los otros tres piden una acción de quien los recibe y por eso son
 * una carta: saludan, explican y cierran. Este es un **aviso de trabajo** —lo
 * abre Ana, quizá desde el teléfono, para saber si tiene que ponerse a
 * preparar un pedido—, así que lo importante va arriba y sin rodeos: quién
 * compró, qué, cuánto y cómo se entrega.
 *
 * **Por eso lleva el detalle entero y no un «entrá al panel».** Un email que
 * obliga a abrir otra cosa para saber si hay que hacer algo no sirve de aviso.
 * El enlace está igual, para lo que el email no puede hacer: cambiar el
 * estado, editar el pedido.
 *
 * **Y no lleva enlaces de contacto al comprador.** El teléfono va como texto
 * —es lo que se copia al WhatsApp— y ya está: un `mailto:` y un `wa.me` al
 * lado del botón del panel serían tres acciones compitiendo en un aviso que
 * tiene una sola.
 */

export type ItemDelAviso = {
  nombre: string;
  marca: string;
  /** El del snapshot. `null` si el producto no viene en colores. */
  color: string | null;
  cantidad: number;
  /** Ya formateado: acá no se hace aritmética de dinero (§7.1). */
  precioUnitario: string;
  subtotal: string;
};

export type PropsDeNuevaOrden = {
  sitio: string;
  numero: number;
  comprador: string;
  telefono: string;
  /** `null` si la orden no guardó email. La columna lo permite. */
  email: string | null;
  items: ItemDelAviso[];
  total: string;
  /** Ya resuelta: «Envío a …» o «Retira en el punto de entrega». */
  entrega: string;
  /** A dónde manda el botón. Hasta F7.1 es el inicio del panel. */
  enlace: string;
};

const ITEMS_DE_MUESTRA: ItemDelAviso[] = [
  {
    nombre: "Auricular Cloud II",
    marca: "HyperX",
    color: "Negro",
    cantidad: 2,
    precioUnitario: "$ 89.900,00",
    subtotal: "$ 179.800,00",
  },
  {
    nombre: "Mouse M170 Inalámbrico",
    marca: "Logitech",
    color: null,
    cantidad: 1,
    precioUnitario: "$ 11.200,00",
    subtotal: "$ 11.200,00",
  },
];

/** Export nombrado, como las otras tres: ver la nota en `verificacion.tsx`. */
export function NuevaOrden({
  // Valores para la previsualización local (`npm run email`).
  sitio = "http://localhost:3000",
  numero = 1043,
  comprador = "Rosa Pereyra",
  telefono = "+5492920111111",
  email = "rosa@ejemplo.test",
  items = ITEMS_DE_MUESTRA,
  total = "$ 191.000,00",
  entrega = "Envío a Colón 820, Viedma, Río Negro",
  enlace = "http://localhost:3000/admin",
}: Partial<PropsDeNuevaOrden> = {}) {
  return (
    <Marco
      sitio={sitio}
      // Lo que se lee en la bandeja sin abrir: cuánto y de quién, que es lo
      // que decide si esto se mira ahora o después.
      adelanto={`${total} · ${comprador} · pedido #${numero}`}
      pie={
        <Menor>
          Este aviso lo manda AnaVende sola, cada vez que alguien confirma un
          pedido en la web. La dirección a la que llega se cambia en el panel,
          en Configuración.
        </Menor>
      }
    >
      <Parrafo>
        <strong style={{ fontSize: "20px" }}>Pedido #{numero}</strong>
      </Parrafo>

      <Datos
        filas={[
          ["Comprador", comprador],
          ["Teléfono", telefono],
          ...(email ? ([["Email", email]] as [string, string][]) : []),
          ["Entrega", entrega],
        ]}
      />

      <Section
        style={{
          margin: "24px 0 8px",
          padding: "4px 0 0",
          borderTop: `1px solid ${COLOR.borde}`,
        }}
      >
        {items.map((item) => (
          <Renglon key={`${item.nombre}-${item.color ?? ""}`} item={item} />
        ))}

        <Row style={{ borderTop: `1px solid ${COLOR.borde}` }}>
          <Column style={{ padding: "14px 0 0" }}>
            <Text style={{ ...CELDA, fontWeight: 600 }}>Total</Text>
          </Column>
          <Column style={{ padding: "14px 0 0", textAlign: "right" }}>
            <Text style={{ ...CELDA, fontSize: "18px", fontWeight: 600 }}>
              {total}
            </Text>
          </Column>
        </Row>
      </Section>

      <Parrafo>
        El stock quedó reservado. El pago y la entrega se coordinan por
        WhatsApp.
      </Parrafo>

      <Boton href={enlace}>Abrir el panel</Boton>
    </Marco>
  );
}

const CELDA = {
  margin: 0,
  fontSize: "15px",
  lineHeight: "1.5",
  color: COLOR.texto,
} as const;

/**
 * Los datos del pedido, en dos columnas.
 *
 * `Row`/`Column` de React Email son una tabla de verdad, que es lo único que
 * alinea igual en Gmail y en Outlook. Con `div` y porcentajes, el motor de
 * Word apila las columnas.
 */
function Datos({ filas }: { filas: [string, string][] }) {
  return (
    <Section style={{ margin: "0 0 4px" }}>
      {filas.map(([titulo, valor]) => (
        <Row key={titulo}>
          <Column style={{ width: "96px", verticalAlign: "top" }}>
            <Text
              style={{
                ...CELDA,
                padding: "0 0 8px",
                color: COLOR.textoSecundario,
              }}
            >
              {titulo}
            </Text>
          </Column>
          <Column style={{ verticalAlign: "top" }}>
            <Text style={{ ...CELDA, padding: "0 0 8px" }}>{valor}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

/**
 * Un renglón del pedido.
 *
 * El color va pegado al nombre y no en una columna propia: una variante sin
 * color dejaría el hueco, y en 560px de ancho una columna vacía se lee como
 * un dato que falta.
 */
function Renglon({ item }: { item: ItemDelAviso }) {
  return (
    <Row>
      <Column style={{ padding: "14px 12px 0 0", verticalAlign: "top" }}>
        <Text style={{ ...CELDA, fontWeight: 500 }}>
          {item.nombre}
          {item.color ? ` · ${item.color}` : ""}
        </Text>
        <Text
          style={{
            ...CELDA,
            fontSize: "13px",
            color: COLOR.textoSecundario,
          }}
        >
          {item.marca} · {item.cantidad} × {item.precioUnitario}
        </Text>
      </Column>
      <Column
        style={{
          padding: "14px 0 0",
          textAlign: "right",
          verticalAlign: "top",
          whiteSpace: "nowrap",
        }}
      >
        <Text style={{ ...CELDA, fontWeight: 500 }}>{item.subtotal}</Text>
      </Column>
    </Row>
  );
}
