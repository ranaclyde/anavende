import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

/**
 * axe con las reglas de WCAG 2.2 AA (DESIGN-REFERENCE §9). **No revisa** el
 * orden del foco, el teclado, el zoom al 200% ni el color como único
 * portador: eso se mira a mano con la lista de `DESIGN.md`.
 */
const NORMAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Lo que encontró, una línea por elemento (vacío si nada), como texto para
 * que el fallo se lea sin abrir el reporte. Con `dentroDe`, solo esa parte.
 */
export async function hallazgosDeAxe(
  page: Page,
  dentroDe?: string,
  /**
   * Reglas que no aplican a lo que se revisa. Cada uso dice por qué en el
   * test: es una excepción, no una forma de callar un hallazgo.
   */
  sinReglas: string[] = [],
): Promise<string[]> {
  const axe = new AxeBuilder({ page }).withTags(NORMAS);
  if (dentroDe) axe.include(dentroDe);
  if (sinReglas.length) axe.disableRules(sinReglas);
  const { violations } = await axe.analyze();

  return violations.flatMap((v) =>
    v.nodes.map(
      (n) =>
        `${v.id} (${v.impact}): ${n.failureSummary?.split("\n")[1]?.trim() ?? v.help} — ${n.target.join(" ")}`,
    ),
  );
}
