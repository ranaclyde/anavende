/**
 * El buzón del stack local — TS §17.2, caso 2.
 *
 * `supabase start` levanta un Mailpit (`[local_smtp]` en
 * `supabase/config.toml`) y GoTrue le manda ahí los emails de verificación en
 * vez de al mundo. El test lee el enlace de este buzón para confirmar la
 * cuenta igual que lo haría una persona.
 */

const BUZON = "http://127.0.0.1:54324/api/v1";

type Mensaje = { ID: string };

/** Espera el email que le llegó a `para` y devuelve su primer enlace. */
export async function enlaceDelEmail(para: string): Promise<string> {
  const consulta = encodeURIComponent(`to:"${para}"`);

  for (let intento = 0; intento < 40; intento++) {
    const respuesta = await fetch(`${BUZON}/search?query=${consulta}`);
    const { messages } = (await respuesta.json()) as { messages: Mensaje[] };

    if (messages.length > 0) {
      const mensaje = await fetch(`${BUZON}/message/${messages[0].ID}`);
      const { HTML } = (await mensaje.json()) as { HTML: string };
      const enlace = HTML.match(/href="([^"]+)"/)?.[1];
      if (!enlace) throw new Error(`El email a ${para} no trae enlace.`);
      return enlace.replaceAll("&amp;", "&");
    }
    await new Promise((listo) => setTimeout(listo, 250));
  }
  throw new Error(`No llegó ningún email a ${para} en 10 segundos.`);
}

/** Borra lo que le llegó a `para`, para no dejar nada en el buzón. */
export async function vaciarBuzon(para: string): Promise<void> {
  const consulta = encodeURIComponent(`to:"${para}"`);
  await fetch(`${BUZON}/search?query=${consulta}`, { method: "DELETE" });
}
