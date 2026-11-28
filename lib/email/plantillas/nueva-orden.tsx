import { Column, Row, Section, Text } from "react-email";

import { Boton, COLOR, Marco, Menor, Parrafo } from "@/lib/email/base";

// E4 (TECHNICAL-SPEC §14, RF-30): lo emite la aplicación, no GoTrue.

export type ItemDelAviso = {
  nombre: string;
  marca: string;
  color: string | null;
  cantidad: number;
  /** Ya formateado: acá no se hace aritmética de dinero. */
  precioUnitario: string;
  subtotal: string;
};

export type PropsDeNuevaOrden = {
  sitio: string;
  numero: number;
  comprador: string;
  telefono: string;
  email: string | null;
  items: ItemDelAviso[];
  total: string;
  entrega: string;
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

/** Export nombrado: ver `verificacion.tsx`. */
export function NuevaOrden({
  // Para la previsualización local (`npm run email`).
  sitio = "http://localhost:3000",
  numero = 1043,
  comprador = "Rosa Pereyra",
  telefono = "+5492920111111",
  email = "rosa@ejemplo.test",
  items = ITEMS_DE_MUESTRA,
  total = "$ 191.000,00",
  entrega = "Envío a Colón 820, Viedma, Río Negro",
  enlace = "http://localhost:3000/admin/ordenes/1043",
}: Partial<PropsDeNuevaOrden> = {}) {
  return (
    <Marco
      sitio={sitio}
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

      <Boton href={enlace}>Ver la orden en el panel</Boton>
    </Marco>
  );
}

const CELDA = {
  margin: 0,
  fontSize: "15px",
  lineHeight: "1.5",
  color: COLOR.texto,
} as const;

// `Row`/`Column` son una tabla de verdad: con `div`, Outlook apila las
// columnas.
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
