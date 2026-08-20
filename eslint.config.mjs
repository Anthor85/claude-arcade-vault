import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import eslintConfigPrettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prototipo UMD (React 18 + Babel en el navegador): no es código del proyecto.
    "references/**",
  ]),
  {
    rules: {
      // Hidratar estado de cliente (localStorage) exige leerlo tras el primer
      // paint: el estado arranca en null en SSR y se rellena en un useEffect.
      // Es el patrón que pide SPEC 01 para evitar desajustes de hidratación.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Debe ir el último: apaga las reglas de formato que chocan con Prettier.
  eslintConfigPrettier,
]);

export default eslintConfig;
