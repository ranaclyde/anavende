import type { Metadata } from "next";

import { UpdatePasswordForm } from "@/components/shop/update-password-form";

export const metadata: Metadata = { title: "Definir contraseña" };

export default function NuevaContrasena() {
  return <UpdatePasswordForm />;
}
