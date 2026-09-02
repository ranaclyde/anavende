import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/shop/forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function Recuperar() {
  return <ForgotPasswordForm />;
}
