import { Badge } from "@/components/ui/badge";
import type { RolDeUsuario } from "@/modules/users/panel/queries";

/**
 * Las etiquetas de un usuario en el panel — DR §6.4. Tarea F7.6.
 *
 * **Sólo se etiqueta la excepción**, igual que el origen de una orden (F7.1):
 * casi todas las cuentas son compradores activos, y una etiqueta «Comprador»
 * repetida cuarenta veces por pantalla es ruido. Lo que hay que ver de un
 * vistazo es quién entra al panel y quién no puede entrar a ningún lado.
 */
export function RolDelUsuario({ rol }: { rol: RolDeUsuario }) {
  if (rol !== "admin") return null;
  return <Badge tone="brand">Administradora</Badge>;
}

/** La misma palabra, para un texto corrido. */
export function nombreDelRol(rol: RolDeUsuario): string {
  return rol === "admin" ? "Administradora" : "Comprador";
}

/**
 * El estado de la cuenta.
 *
 * **Bloqueado y baja pedida son dos cosas distintas** (RN-13, §13.5b) y por eso
 * son dos etiquetas: el bloqueo lo decide la vendedora (RF-27) y la baja la
 * pide la persona (RF-34). Se ven acá desde F7.6; ejecutarlas es de F7.7 y
 * F7.9.
 */
export function EstadoDelUsuario({
  bloqueado,
  bajaPedida,
}: {
  bloqueado: boolean;
  bajaPedida: boolean;
}) {
  return (
    <>
      {bloqueado ? <Badge tone="danger">Bloqueado</Badge> : null}
      {bajaPedida ? <Badge tone="warning">Baja pedida</Badge> : null}
    </>
  );
}
