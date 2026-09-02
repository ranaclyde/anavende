import type { Metadata } from "next";

import { LoginForm } from "@/components/shop/login-form";

export const metadata: Metadata = { title: "Ingresar" };

export default function Ingresar() {
  return <LoginForm />;
}
