// Service worker de Distrimas - Nivel 1 (app shell offline)
// Cachea la interfaz para que la app abra rápido y sin internet.
// NO cachea las llamadas a Supabase: los datos siempre van a la red,
// para no mostrar informacion vieja o falsa.

const CACHE = "distrimas-v1"
const APP_SHELL = ["/", "/manifest.webmanifest"]

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (e) => {
  const { request } = e
  const url = new URL(request.url)

  if (request.method !== "GET") return

  // Supabase y autenticacion: siempre a la red, nunca cache
  if (url.hostname.includes("supabase.co") || url.pathname.startsWith("/auth")) return

  // Assets estaticos (JS, CSS, imagenes, fuentes): cache primero
  const esEstatico =
    url.pathname.startsWith("/_next/static") ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/.test(url.pathname)

  if (esEstatico) {
    e.respondWith(
      caches.match(request).then((cached) =>
        cached ||
        fetch(request).then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        }).catch(() => cached)
      )
    )
    return
  }

  // Navegacion (paginas): red primero, si falla usa cache
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {})
          return res
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    )
    return
  }
})
