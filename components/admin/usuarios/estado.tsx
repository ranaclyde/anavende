import { Badge } from "@/components/ui/badge";
import type { RolDeUsuario } from "@/modules/users/panel/queries";

/**
 * Las etiquetas de un usuario en el panel — DR §6.4. Solo se etiqueta la
 * excepción: «Comprador» repetido en cada fila es ruido.
 */
export function RolDelUsuario({ rol }: { rol: RolDeUsuario }) {
  if (rol !== "admin") return null;
  return <Badge tone="brand">Administradora</Badge>;
}

/**
 * El estado de la cuenta. Bloqueado y dado de baja son dos etiquetas
 * (RN-13). «Baja pedida» es `warning`: la cuenta sigue activa, esperando que
 * alguien la ejecute.
 */
export function EstadoDelUsuario({
  bloqueado,
  bajaPedida,
  dadoDeBaja,
}: {
  bloqueado: boolean;
  bajaPedida: boolean;
  dadoDeBaja: boolean;
}) {
  return (
    <>
      {bloqueado ? <Badge tone="danger">Bloqueado</Badge> : null}
      {dadoDeBaja ? <Badge tone="neutral">Dado de baja</Badge> : null}
      {bajaPedida ? <Badge tone="warning">Baja pedida</Badge> : null}
    </>
  );
}
