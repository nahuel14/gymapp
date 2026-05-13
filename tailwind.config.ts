import { heroui } from "@heroui/theme";
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // Esta línea es VITAL para que los estilos de HeroUI funcionen
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Configuramos el amarillo para componentes de Shadcn
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#facc15", // yellow-400
          foreground: "#000000",
        },
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        dark: {
          colors: {
            background: "#09090b", // zinc-950
            foreground: "#fafafa", // zinc-50
            // Configuramos el amarillo para componentes de HeroUI
            warning: {
              DEFAULT: "#facc15",
              foreground: "#000000",
            },
            focus: "#facc15",
          },
        },
      },
    }),
  ],
};

export default config;