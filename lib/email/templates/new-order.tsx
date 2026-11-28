import { Column, Row, Section, Text } from "react-email";

import { Button, COLOR, Frame, SmallPrint, Paragraph } from "@/lib/email/base";

// E4 (TECHNICAL-SPEC §14, RF-30): lo emite la aplicación, no GoTrue.

export type NoticeItem = {
  name: string;
  brand: string;
  color: string | null;
  quantity: number;
  /** Ya formateado: acá no se hace aritmética de dinero. */
  unitPrice: string;
  subtotal: string;
};

export type NewOrderProps = {
  site: string;
  orderNumber: number;
  customer: string;
  phone: string;
  email: string | null;
  items: NoticeItem[];
  total: string;
  delivery: string;
  link: string;
};

const SAMPLE_ITEMS: NoticeItem[] = [
  {
    name: "Auricular Cloud II",
    brand: "HyperX",
    color: "Negro",
    quantity: 2,
    unitPrice: "$ 89.900,00",
    subtotal: "$ 179.800,00",
  },
  {
    name: "Mouse M170 Inalámbrico",
    brand: "Logitech",
    color: null,
    quantity: 1,
    unitPrice: "$ 11.200,00",
    subtotal: "$ 11.200,00",
  },
];

/** Export nombrado: ver `verification.tsx`. */
export function NewOrder({
  // Para la previsualización local (`npm run email`).
  site = "http://localhost:3000",
  orderNumber = 1043,
  customer = "Rosa Pereyra",
  phone = "+5492920111111",
  email = "rosa@ejemplo.test",
  items = SAMPLE_ITEMS,
  total = "$ 191.000,00",
  delivery = "Envío a Colón 820, Viedma, Río Negro",
  link = "http://localhost:3000/admin/ordenes/1043",
}: Partial<NewOrderProps> = {}) {
  return (
    <Frame
      site={site}
      preview={`${total} · ${customer} · pedido #${orderNumber}`}
      footer={
        <SmallPrint>
          Este aviso lo manda AnaVende sola, cada vez que alguien confirma un
          pedido en la web. La dirección a la que llega se cambia en el panel,
          en Configuración.
        </SmallPrint>
      }
    >
      <Paragraph>
        <strong style={{ fontSize: "20px" }}>Pedido #{orderNumber}</strong>
      </Paragraph>

      <Details
        rows={[
          ["Comprador", customer],
          ["Teléfono", phone],
          ...(email ? ([["Email", email]] as [string, string][]) : []),
          ["Entrega", delivery],
        ]}
      />

      <Section
        style={{
          margin: "24px 0 8px",
          padding: "4px 0 0",
          borderTop: `1px solid ${COLOR.border}`,
        }}
      >
        {items.map((item) => (
          <ItemRow key={`${item.name}-${item.color ?? ""}`} item={item} />
        ))}

        <Row style={{ borderTop: `1px solid ${COLOR.border}` }}>
          <Column style={{ padding: "14px 0 0" }}>
            <Text style={{ ...CELL, fontWeight: 600 }}>Total</Text>
          </Column>
          <Column style={{ padding: "14px 0 0", textAlign: "right" }}>
            <Text style={{ ...CELL, fontSize: "18px", fontWeight: 600 }}>
              {total}
            </Text>
          </Column>
        </Row>
      </Section>

      <Paragraph>
        El stock quedó reservado. El pago y la entrega se coordinan por
        WhatsApp.
      </Paragraph>

      <Button href={link}>Ver la orden en el panel</Button>
    </Frame>
  );
}

const CELL = {
  margin: 0,
  fontSize: "15px",
  lineHeight: "1.5",
  color: COLOR.ink,
} as const;

// `Row`/`Column` son una tabla de verdad: con `div`, Outlook apila las
// columnas.
function Details({ rows }: { rows: [string, string][] }) {
  return (
    <Section style={{ margin: "0 0 4px" }}>
      {rows.map(([label, value]) => (
        <Row key={label}>
          <Column style={{ width: "96px", verticalAlign: "top" }}>
            <Text
              style={{
                ...CELL,
                padding: "0 0 8px",
                color: COLOR.inkSecondary,
              }}
            >
              {label}
            </Text>
          </Column>
          <Column style={{ verticalAlign: "top" }}>
            <Text style={{ ...CELL, padding: "0 0 8px" }}>{value}</Text>
          </Column>
        </Row>
      ))}
    </Section>
  );
}

function ItemRow({ item }: { item: NoticeItem }) {
  return (
    <Row>
      <Column style={{ padding: "14px 12px 0 0", verticalAlign: "top" }}>
        <Text style={{ ...CELL, fontWeight: 500 }}>
          {item.name}
          {item.color ? ` · ${item.color}` : ""}
        </Text>
        <Text
          style={{
            ...CELL,
            fontSize: "13px",
            color: COLOR.inkSecondary,
          }}
        >
          {item.brand} · {item.quantity} × {item.unitPrice}
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
        <Text style={{ ...CELL, fontWeight: 500 }}>{item.subtotal}</Text>
      </Column>
    </Row>
  );
}
