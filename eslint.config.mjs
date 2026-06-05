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
    "coverage/**",
    "next-env.d.ts",
    "src/types/supabase.ts",
    "database.types.ts",
  ]),
  {
    rules: {
      // `any` se usa intencionalmente en todo el proyecto (Supabase, state genérico)
      "@typescript-eslint/no-explicit-any": "off",
      // Unused vars: error — usar prefijo _ para ignorar intencionalmente
      "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      // React Compiler: falsos positivos en patrones de sincronización de estado válidos
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
      // Accesibilidad: inputs deben tener autocomplete válido y estar asociados a un label
      "jsx-a11y/autocomplete-valid": "error",
      "jsx-a11y/no-autofocus": "warn",
    },
  },
]);

export default eslintConfig;
