import { redirect } from "next/navigation";

import { PAGINAS_LEGALES } from "@/modules/content/paginas";
import { requireAdmin } from "@/lib/session";

/** El menú lleva acá; la sección empieza en la primera página. */
export default async function Legales() {
  await requireAdmin();

  redirect(`/admin/legales/${PAGINAS_LEGALES[0].slug}`);
}
