import type { MetadataRoute } from "next"

const LOGO = "/logo.png"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Distrimas SC",
    short_name: "Distrimas",
    description: "Sistema de gestión de distribución",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#D72638",
    icons: [
      { src: LOGO, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: LOGO, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: LOGO, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
