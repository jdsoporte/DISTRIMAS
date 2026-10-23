import type { NextConfig } from "next";

// En Dokploy los datos los responde PostgREST por la red interna.
// El navegador sigue llamando a <esta app>/rest/v1/... (como en Supabase)
// y Next reenvia esas llamadas a POSTGREST_URL.
// Se lee al compilar: si cambia, hacer Rebuild en Dokploy.
const postgrestUrl = process.env.POSTGREST_URL;

const nextConfig: NextConfig = {
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
