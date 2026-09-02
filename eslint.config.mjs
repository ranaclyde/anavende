import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * TECHNICAL-SPEC §7.1 y riesgo R2: los montos son `numeric(12,2)` y llegan
 * como `string`. Convertirlos a número flotante pierde precisión, y ese error
 * no se ve hasta que una orden no cuadra por un centavo.
 *
 * La spec lo dice explícitamente: «es una regla de lint, no una
 * recomendación». La única conversión legítima vive en `lib/money.ts`, en la
 * capa de formateo, y ese archivo es la única excepción.
 */
const MOTIVO_MONTOS =
  "Los montos son numeric(12,2) y viajan como string (TECHNICAL-SPEC §7.1). " +
  "Usá lib/money.ts: add, subtract, multiply, sum, compare, formatMoney. " +
  "Convertir a número pierde precisión.";

const reglasDeDinero = {
  "no-restricted-globals": [
    "error",
    { name: "parseFloat", message: MOTIVO_MONTOS },
    { name: "parseInt", message: MOTIVO_MONTOS + " Para enteros usá Number.parseInt explícitamente." },
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

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "next-env.d.ts",
      "db/migrations/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["**/*.{ts,tsx}"],
    rules: reglasDeDinero,
  },
  {
    // La capa de formateo: el único lugar donde un monto se vuelve número.
    files: ["lib/money.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },
];

export default eslintConfig;
