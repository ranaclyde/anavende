// GoTrue pide las plantillas por HTTP contra `SITE_URL` (no lee archivos):
// la salida va a `public/` y se commitea, porque es lo que se despliega.
import { mkdir, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { render } from "react-email";

import { Invitacion } from "@/lib/email/plantillas/invitacion";
import { NuevaOrden } from "@/lib/email/plantillas/nueva-orden";
import { Recuperacion } from "@/lib/email/plantillas/recuperacion";
import { Verificacion } from "@/lib/email/plantillas/verificacion";

const RUTA = "/api/auth/confirmar";

// `{{ .RedirectTo }}` ya trae `?next=…`, por eso se sigue con `&`. No
// `{{ .ConfirmationURL }}`: devuelve la sesión en el fragmento de la URL.
const desdeElDestino = (tipo: string) =>
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${tipo}`;

// E3 desde `{{ .SiteURL }}`: sin `redirectTo`, `{{ .RedirectTo }}` sale vacío.
const desdeElSitio = (tipo: string, destino: string) =>
  `{{ .SiteURL }}${RUTA}?next=${encodeURIComponent(destino)}` +
  `&token_hash={{ .TokenHash }}&type=${tipo}`;

// Los dos `if` anidados no son adorno: en Go, pedirle un campo a un `.Data`
// nulo revienta la plantilla entera y el email no sale.
const SALUDO =
  "{{ if .Data }}{{ if .Data.first_name }}, {{ .Data.first_name }}{{ end }}{{ end }}";

// Un `token_hash` con el largo de uno real, para que el enlace ocupe lo que va
// a ocupar.
const SITIO_DE_PRUEBA = "http://localhost:3000";
const enlaceDePrueba = (tipo: string, destino: string) =>
  `${SITIO_DE_PRUEBA}${RUTA}?next=${encodeURIComponent(destino)}` +
  `&token_hash=a560326d775928e2e20ef765fe112f95113dbb0522345fd203be5a04&type=${tipo}`;

const NUEVA_CONTRASENA = "/recuperar/nueva-contrasena";

const PLANTILLAS = [
  {
    archivo: "verificacion.html",
    plantilla: Verificacion,
    enlace: desdeElDestino("signup"),
    enlaceDePrueba: enlaceDePrueba("signup", "/mi-cuenta"),
  },
  {
    // El reenvío sale como enlace mágico (`/resend` no registra el desafío
    // PKCE y `signInWithOtp` sí): con `type=signup` no se canjearía.
    archivo: "verificacion-reenvio.html",
    plantilla: Verificacion,
    enlace: desdeElDestino("magiclink"),
    enlaceDePrueba: enlaceDePrueba("magiclink", "/mi-cuenta"),
  },
  {
    archivo: "recuperacion.html",
    plantilla: Recuperacion,
    enlace: desdeElDestino("recovery"),
    enlaceDePrueba: enlaceDePrueba("recovery", NUEVA_CONTRASENA),
  },
  {
    archivo: "invitacion.html",
    plantilla: Invitacion,
    enlace: desdeElSitio("invite", NUEVA_CONTRASENA),
    enlaceDePrueba: enlaceDePrueba("invite", NUEVA_CONTRASENA),
  },
];

const destino = new URL("../../public/emails/", import.meta.url);
const destinoVistaPrevia = new URL("vista-previa/", destino);
await mkdir(destinoVistaPrevia, { recursive: true });

// E4 lo manda la aplicación, no GoTrue: solo vista previa, fuera de
// `public/emails/`.
const SOLO_VISTA_PREVIA = [
  { archivo: "nueva-orden.html", plantilla: NuevaOrden },
];

for (const p of SOLO_VISTA_PREVIA) {
  const vistaPrevia = await render(createElement(p.plantilla), {
    pretty: true,
  });
  await writeFile(new URL(p.archivo, destinoVistaPrevia), vistaPrevia, "utf8");
  console.log(`👁  vista previa de ${p.archivo} (E4 no se sirve por HTTP)`);
}

for (const p of PLANTILLAS) {
  // Sin `pretty`: parte las expresiones de Go en renglones distintos y
  // rompe el enlace.
  const html = await render(
    createElement(p.plantilla, {
      sitio: "{{ .SiteURL }}",
      enlace: p.enlace,
      saludo: SALUDO,
    }),
  );
  await writeFile(new URL(p.archivo, destino), html, "utf8");

  // La vista previa no se commitea.
  const vistaPrevia = await render(
    createElement(p.plantilla, {
      sitio: SITIO_DE_PRUEBA,
      enlace: p.enlaceDePrueba,
      saludo: ", Matías",
    }),
    { pretty: true },
  );
  await writeFile(new URL(p.archivo, destinoVistaPrevia), vistaPrevia, "utf8");

  console.log(`✅ public/emails/${p.archivo}`);
}

console.log(
  `\nPara mirarlos, con \`npm run dev\` levantado:\n` +
    [...PLANTILLAS, ...SOLO_VISTA_PREVIA]
      .map((p) => `   ${SITIO_DE_PRUEBA}/emails/vista-previa/${p.archivo}`)
      .join("\n"),
);
