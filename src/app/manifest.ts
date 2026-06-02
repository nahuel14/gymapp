import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GymApp",
    short_name: "GymApp",
    description: "App de entrenamiento para coaches y alumnos",
    start_url: "/",
    display: "standalone",
    background_color: "#09090B",
    theme_color: "#09090B",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
