import type { NextConfig } from "next";

// En Dokploy los datos los responde PostgREST por la red interna.
// El navegador sigue llamando a <esta app>/rest/v1/... (como en Supabase)
// y Next reenvia esas llamadas a POSTGREST_URL.
// Se lee al compilar: si cambia, hacer Rebuild en Dokploy.
const postgrestUrl = process.env.POSTGREST_URL;

// Logo e iconos: el navegador los guarda 7 dias en vez de revalidarlos en cada carga.
// Si se cambia alguno, cambiarle el nombre para que se vea de inmediato.
const IMAGENES_CACHE = ["/logo.png", "/icon-192.png", "/icon-512.png", "/apple-icon.png"];

const nextConfig: NextConfig = {
  async headers() {
    return IMAGENES_CACHE.map((source) => ({
      source,
      headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
    }));
  },
  async rewrites() {
    if (!postgrestUrl) return [];
    return [
      {
        source: "/rest/v1/:path*",
        destination: `${postgrestUrl.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

export default nextConfig;
