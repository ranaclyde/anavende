import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Revisá tu email" };

export default function Verificar() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Revisá tu email</CardTitle>
        <CardDescription>Te mandamos un enlace para confirmar la cuenta</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-body-sm text-ink-secondary">
          Abrí el enlace desde el mismo dispositivo, así quedás dentro. Si no
          te llega en unos minutos, fijate en el correo no deseado.
        </p>
      </CardContent>
    </Card>
  );
}
