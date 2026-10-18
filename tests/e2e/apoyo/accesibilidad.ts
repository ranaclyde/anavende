import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * axe sobre la página tal como está — DESIGN-REFERENCE §9, FS RNF-02. F10.3.
 *
 * Revisa lo que una máquina puede revisar: contraste, etiquetas, nombres de
 * botones y enlaces, textos alternativos, roles, `lang`, área táctil. **No
 * revisa** el orden del foco, que un flujo se complete con teclado, el zoom
 * al 200% ni que un estado no dependa solo del color: eso está en la lista de
 * `DESIGN.md`, y se mira a mano.
 *
 * Las reglas son las de WCAG 2.2 AA, que es lo que pide §9.
 */
const NORMAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Lo que encontró, en una línea por elemento: la regla, qué dice y dónde.
 * Vacío si no hay nada. Se devuelve como texto para que el fallo del test se
 * lea sin abrir el reporte.
 *
 * Con `dentroDe`, solo esa parte: un diálogo abierto, sin volver a revisar
 * la página que queda debajo.
 */
export async function hallazgosDeAxe(
  page: Page,
  dentroDe?: string,
): Promise<string[]> {
  const axe = new AxeBuilder({ page }).withTags(NORMAS);
  if (dentroDe) axe.include(dentroDe);
  const { violations } = await axe.analyze();

  return violations.flatMap((v) =>
    v.nodes.map(
      (n) =>
        `${v.id} (${v.impact}): ${n.failureSummary?.split("\n")[1]?.trim() ?? v.help} — ${n.target.join(" ")}`,
    ),
  );
}
