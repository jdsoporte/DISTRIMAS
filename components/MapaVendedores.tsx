"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/lib/theme-context"

// Coordenadas aproximadas de los municipios de Córdoba (y algunos vecinos)
const MUNICIPIOS: Record<string, [number, number]> = {
  "monteria": [8.7479, -75.8814],
  "cerete": [8.8853, -75.7920],
  "lorica": [9.2397, -75.8140],
  "sahagun": [8.9472, -75.4456],
  "planeta rica": [8.4083, -75.5836],
  "montelibano": [7.9800, -75.4169],
  "tierralta": [8.1719, -76.0594],
  "cienaga de oro": [8.8758, -75.6219],
  "chinu": [9.1058, -75.4006],
  "san andres de sotavento": [9.1467, -75.5083],
  "pueblo nuevo": [8.5000, -75.5072],
  "san bernardo del viento": [9.3539, -75.9544],
  "san bernardo": [9.3539, -75.9544],
  "san antero": [9.3744, -75.7592],
  "monitos": [9.2486, -76.1306],
  "moñitos": [9.2486, -76.1306],
  "puerto escondido": [9.0083, -76.2606],
  "los cordobas": [8.8939, -76.3556],
  "canalete": [8.7886, -76.2436],
  "valencia": [8.2581, -76.1497],
  "san carlos": [8.8000, -75.6989],
  "san pelayo": [8.9586, -75.8367],
  "pelayo": [8.9586, -75.8367],
  "cotorra": [9.0394, -75.7889],
  "momil": [9.2425, -75.6756],
  "purisima": [9.2386, -75.7250],
  "chima": [9.1503, -75.6256],
  "buenavista": [8.2247, -75.4811],
  "la apartada": [8.0511, -75.3367],
  "ayapel": [8.3128, -75.1456],
  "puerto libertador": [7.8889, -75.6711],
  "tuchin": [9.1869, -75.5556],
  "san jose de ure": [7.7869, -75.5314],
  "rabolargo": [8.9500, -75.7200],
  "las palomas": [8.8300, -75.6800],
  "arboletes": [8.8497, -76.4267],
}

const norm = (s: string) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim()

// Busca las coordenadas de una ruta a partir de su nombre (match parcial)
function coordsDeRuta(nombreRuta: string): [number, number] | null {
  const n = norm(nombreRuta)
  if (MUNICIPIOS[n]) return MUNICIPIOS[n]
  // Match parcial: el nombre de la ruta contiene un municipio conocido
  for (const muni in MUNICIPIOS) {
    if (n.includes(muni)) return MUNICIPIOS[muni]
  }
  return null
}

interface PuntoVendedor { nombre: string; ruta: string; municipio: string; lat: number; lng: number }

declare global { interface Window { L: any } }

export default function MapaVendedores() {
  const theme = useTheme()
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)
  const [puntos, setPuntos] = useState<PuntoVendedor[]>([])
  const [sinUbicar, setSinUbicar] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    setLoading(true)
    // Día de hoy en Colombia: 0=Domingo..6=Sábado
    const diaCol = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" })).getDay()

    const [u, a] = await Promise.all([
      supabase.from("usuarios").select("*, perfil:perfiles(*)").eq("activo", true).order("nombre"),
      supabase.from("asignaciones_ruta").select("usuario_id, descanso, ruta:rutas(nombre)").eq("dia_semana", diaCol),
    ])
    const vendedores = (u.data || []).filter(x => (x.perfil?.nombre || "").toLowerCase() !== "administrador")
    const asigs = a.data || []

    const pts: PuntoVendedor[] = []
    const sin: string[] = []
    const usados: Record<string, number> = {}

    for (const v of vendedores) {
      const asig = asigs.find(x => x.usuario_id === v.id)
      if (!asig || asig.descanso) { continue }
      const rutaRel = Array.isArray(asig.ruta) ? asig.ruta[0] : asig.ruta
      const nombreRuta = rutaRel?.nombre || ""
      if (!nombreRuta) continue
      const coords = coordsDeRuta(nombreRuta)
      if (!coords) { sin.push(`${v.nombre} (${nombreRuta})`); continue }
      // Si varios vendedores caen en el mismo punto, dispersarlos un poco
      const key = `${coords[0]},${coords[1]}`
      const n = usados[key] || 0
      usados[key] = n + 1
      const offset = n * 0.02
      pts.push({ nombre: v.nombre, ruta: nombreRuta, municipio: nombreRuta, lat: coords[0] + offset, lng: coords[1] + offset })
    }

    setPuntos(pts)
    setSinUbicar(sin)
    setLoading(false)
  }

  // Cargar Leaflet desde CDN y pintar el mapa
  useEffect(() => {
    if (loading) return
    let cancelado = false

    function cargarLeaflet(): Promise<void> {
      return new Promise((resolve) => {
        if (window.L) { resolve(); return }
        if (!document.getElementById("leaflet-css")) {
          const link = document.createElement("link")
          link.id = "leaflet-css"
          link.rel = "stylesheet"
          link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          document.head.appendChild(link)
        }
        const existing = document.getElementById("leaflet-js") as HTMLScriptElement | null
        if (existing) { existing.addEventListener("load", () => resolve()); return }
        const script = document.createElement("script")
        script.id = "leaflet-js"
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        script.onload = () => resolve()
        document.body.appendChild(script)
      })
    }

    cargarLeaflet().then(() => {
      if (cancelado || !mapRef.current || !window.L) return
      const L = window.L
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null }
      const map = L.map(mapRef.current, { scrollWheelZoom: false }).setView([8.55, -75.75], 8)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap", maxZoom: 18,
      }).addTo(map)

      puntos.forEach(p => {
        const marker = L.circleMarker([p.lat, p.lng], {
          radius: 9, fillColor: "#D72638", color: "white", weight: 2, fillOpacity: 1,
        }).addTo(map)
        marker.bindTooltip(p.nombre, { permanent: true, direction: "top", offset: [0, -8] })
        marker.bindPopup(`<b>${p.nombre}</b><br>Ruta: ${p.ruta}`)
      })

      mapInstance.current = map
      setTimeout(() => map.invalidateSize(), 200)
    })

    return () => { cancelado = true }
  }, [loading, puntos])

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", color: theme.text, margin: "0 0 2px" }}>Ubicación de vendedores hoy</h3>
          <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>Según la ruta asignada a cada vendedor para el día de hoy.</p>
        </div>
        <span style={{ fontSize: "12px", fontWeight: 600, color: theme.muted, background: theme.cardAlt, padding: "5px 12px", borderRadius: "99px" }}>
          {puntos.length} en ruta
        </span>
      </div>

      {loading ? (
        <div style={{ height: "380px", display: "flex", alignItems: "center", justifyContent: "center", color: theme.muted, background: theme.cardAlt, borderRadius: "10px" }}>Cargando mapa...</div>
      ) : puntos.length === 0 ? (
        <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", color: theme.muted, background: theme.cardAlt, borderRadius: "10px", padding: "20px" }}>
          Ningún vendedor tiene ruta asignada hoy (o es día de descanso). Asigna rutas en Programación.
        </div>
      ) : (
        <div ref={mapRef} style={{ height: "380px", width: "100%", borderRadius: "10px", overflow: "hidden", zIndex: 1 }} />
      )}

      {sinUbicar.length > 0 && (
        <p style={{ fontSize: "12px", color: "#f59e0b", marginTop: "10px" }}>
          Sin ubicar en el mapa (la ruta no coincide con un municipio conocido): {sinUbicar.join(", ")}.
        </p>
      )}
    </div>
  )
}
