import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Error de identidad — DESIGN-REFERENCE §8 y §10.
 * Dice qué pasó y qué hacer. Nunca un código ni el mensaje crudo del
 * proveedor: el motivo llega como una clave conocida y se traduce acá.
 */
const MOTIVOS: Record<string, { titulo: string; detalle: string }> = {
  "enlace-vencido": {
    titulo: "Ese enlace ya venció",
    detalle:
      "Los enlaces de confirmación duran poco tiempo por seguridad. Pedí uno nuevo y volvé a intentar.",
  },
  "enlace-invalido": {
    titulo: "Ese enlace no es válido",
    detalle:
      "Puede que se haya cortado al copiarlo. Probá abrirlo de nuevo desde el email, sin modificarlo.",
  },
};

const POR_OMISION = {
  titulo: "No pudimos completar el paso",
  detalle: "Algo salió mal de nuestro lado. Probá de nuevo en un momento.",
};

export default async function ErrorDeIdentidad({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  const { motivo } = await searchParams;
  const { titulo, detalle } = (motivo && MOTIVOS[motivo]) || POR_OMISION;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{titulo}</CardTitle>
        <CardDescription>{detalle}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="brand" size="lg">
          <Link href="/ingresar">Ir a ingresar</Link>
        </Button>
        <Button asChild variant="tertiary" size="lg">
          <Link href="/">Volver a la tienda</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
