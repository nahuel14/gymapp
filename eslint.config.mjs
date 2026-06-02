import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/types/supabase.ts",
    "database.types.ts",
  ]),
  {
    rules: {
      // `any` se usa intencionalmente en todo el proyecto (Supabase, state genérico)
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars: warn en lugar de error
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      // React Compiler: falsos positivos en patrones de sincronización de estado válidos
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
]);

export default eslintConfig;
