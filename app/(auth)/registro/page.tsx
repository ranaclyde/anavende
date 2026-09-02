import type { Metadata } from "next";

import { SignUpForm } from "@/components/shop/sign-up-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function Registro() {
  return <SignUpForm />;
}
