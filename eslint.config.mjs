import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Montos `numeric(12,2)` como `string` (TECHNICAL-SPEC §7.1): convertirlos a
 * flotante pierde precisión. La única excepción es `lib/money.ts`.
 */
const MOTIVO_MONTOS =
  "Los montos son numeric(12,2) y viajan como string (TECHNICAL-SPEC §7.1). " +
  "Usá lib/money.ts: add, subtract, multiply, sum, compare, formatMoney. " +
  "Convertir a número pierde precisión.";

const reglasDeDinero = {
  "no-restricted-globals": [
    "error",
    { name: "parseFloat", message: MOTIVO_MONTOS },
    {
      name: "parseInt",
      message:
        MOTIVO_MONTOS + " Para enteros usá Number.parseInt explícitamente.",
    },
  ],
  "no-restricted-properties": [
    "error",
    { object: "Number", property: "parseFloat", message: MOTIVO_MONTOS },
  ],
  "no-restricted-syntax": [
    "error",
    {
      selector: 'CallExpression[callee.name="Number"]',
      message: MOTIVO_MONTOS,
    },
    {
      // `+monto` es el mismo error escrito más corto.
      selector: 'UnaryExpression[operator="+"][argument.type!="Literal"]',
      message: MOTIVO_MONTOS,
    },
  ],
};

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    // El build del gancho de pre-push (`distDir` en `next.config.ts`).
    ".next-verificacion/**",
    "coverage/**",
    "node_modules/**",
    "next-env.d.ts",
    "db/migrations/**",
  ]),
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{ts,tsx}"],
    rules: reglasDeDinero,
  },
  {
    files: ["lib/money.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
]);

export default eslintConfig;
