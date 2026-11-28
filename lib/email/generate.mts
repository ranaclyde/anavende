// GoTrue pide las plantillas por HTTP contra `SITE_URL` (no lee archivos):
// la salida va a `public/` y se commitea, porque es lo que se despliega.
import { mkdir, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { render } from "react-email";

import { Invitation } from "@/lib/email/templates/invitation";
import { NewOrder } from "@/lib/email/templates/new-order";
import { PasswordReset } from "@/lib/email/templates/password-reset";
import { Verification } from "@/lib/email/templates/verification";

const CONFIRM_PATH = "/api/auth/confirmar";

// `{{ .RedirectTo }}` ya trae `?next=…`, por eso se sigue con `&`. No
// `{{ .ConfirmationURL }}`: devuelve la sesión en el fragmento de la URL.
const fromRedirectTarget = (type: string) =>
  `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=${type}`;

// E3 desde `{{ .SiteURL }}`: sin `redirectTo`, `{{ .RedirectTo }}` sale vacío.
const fromSite = (type: string, redirectTarget: string) =>
  `{{ .SiteURL }}${CONFIRM_PATH}?next=${encodeURIComponent(redirectTarget)}` +
  `&token_hash={{ .TokenHash }}&type=${type}`;

// Los dos `if` anidados no son adorno: en Go, pedirle un campo a un `.Data`
// nulo revienta la plantilla entera y el email no sale.
const GREETING =
  "{{ if .Data }}{{ if .Data.first_name }}, {{ .Data.first_name }}{{ end }}{{ end }}";

// Un `token_hash` con el largo de uno real, para que el enlace ocupe lo que va
// a ocupar.
const TEST_SITE = "http://localhost:3000";
const testLink = (type: string, redirectTarget: string) =>
  `${TEST_SITE}${CONFIRM_PATH}?next=${encodeURIComponent(redirectTarget)}` +
  `&token_hash=a560326d775928e2e20ef765fe112f95113dbb0522345fd203be5a04&type=${type}`;

const NEW_PASSWORD_PATH = "/recuperar/nueva-contrasena";

const TEMPLATES = [
  {
    file: "verificacion.html",
    template: Verification,
    link: fromRedirectTarget("signup"),
    testLink: testLink("signup", "/mi-cuenta"),
  },
  {
    // El reenvío sale como enlace mágico (`/resend` no registra el desafío
    // PKCE y `signInWithOtp` sí): con `type=signup` no se canjearía.
    file: "verificacion-reenvio.html",
    template: Verification,
    link: fromRedirectTarget("magiclink"),
    testLink: testLink("magiclink", "/mi-cuenta"),
  },
  {
    file: "recuperacion.html",
    template: PasswordReset,
    link: fromRedirectTarget("recovery"),
    testLink: testLink("recovery", NEW_PASSWORD_PATH),
  },
  {
    file: "invitacion.html",
    template: Invitation,
    link: fromSite("invite", NEW_PASSWORD_PATH),
    testLink: testLink("invite", NEW_PASSWORD_PATH),
  },
];

const outputDir = new URL("../../public/emails/", import.meta.url);
const previewDir = new URL("vista-previa/", outputDir);
await mkdir(previewDir, { recursive: true });

// E4 lo manda la aplicación, no GoTrue: solo vista previa, fuera de
// `public/emails/`.
const PREVIEW_ONLY = [{ file: "nueva-orden.html", template: NewOrder }];

for (const p of PREVIEW_ONLY) {
  const preview = await render(createElement(p.template), {
    pretty: true,
  });
  await writeFile(new URL(p.file, previewDir), preview, "utf8");
  console.log(`👁  vista previa de ${p.file} (E4 no se sirve por HTTP)`);
}

for (const p of TEMPLATES) {
  // Sin `pretty`: parte las expresiones de Go en renglones distintos y
  // rompe el enlace.
  const html = await render(
    createElement(p.template, {
      site: "{{ .SiteURL }}",
      link: p.link,
      greeting: GREETING,
    }),
  );
  await writeFile(new URL(p.file, outputDir), html, "utf8");

  // La vista previa no se commitea.
  const preview = await render(
    createElement(p.template, {
      site: TEST_SITE,
      link: p.testLink,
      greeting: ", Matías",
    }),
    { pretty: true },
  );
  await writeFile(new URL(p.file, previewDir), preview, "utf8");

  console.log(`✅ public/emails/${p.file}`);
}

console.log(
  `\nPara mirarlos, con \`npm run dev\` levantado:\n` +
    [...TEMPLATES, ...PREVIEW_ONLY]
      .map((p) => `   ${TEST_SITE}/emails/vista-previa/${p.file}`)
      .join("\n"),
);
