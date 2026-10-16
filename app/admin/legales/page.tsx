import { redirect } from "next/navigation";

import { PAGINAS_LEGALES } from "@/modules/content/paginas";

/** El menú lleva acá; la sección empieza en la primera página. */
export default function Legales() {
  redirect(`/admin/legales/${PAGINAS_LEGALES[0].slug}`);
}
