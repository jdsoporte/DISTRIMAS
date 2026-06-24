"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/lib/theme-context"

const rel = (v: any) => Array.isArray(v) ? v[0] : v
function hoyCol() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) }
function primerDiaMes() {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

interface FilaVendedor {
  nombre: string
  compro: number
  tienda_cerrada: number
  no_estaba: number
  precio_alto: number
  otro: number
  no_visitado: number
}

async function traerTodo(tabla: string, columnas: string, filtro: (q: any) => any) {
  const acc: any[] = []
  let desde = 0
  const TAM = 1000
  while (true) {
    const { data, error } = await filtro(supabase.from(tabla).select(columnas)).range(desde, desde + TAM - 1)
    if (error || !data || data.length === 0) break
    acc.push(...data)
    if (data.length < TAM) break
    desde += TAM
  }
  return acc
}

export default function ReporteVisitas() {
  const theme = useTheme()
  const [desde, setDesde] = useState(primerDiaMes())
  const [hasta, setHasta] = useState(hoyCol())
  const [filas, setFilas] = useState<FilaVendedor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { cargar() }, [desde, hasta])

  function rango(tipo: "hoy" | "semana" | "mes") {
    const hoy = hoyCol()
    if (tipo === "hoy") { setDesde(hoy); setHasta(hoy); return }
    if (tipo === "mes") { setDesde(primerDiaMes()); setHasta(hoy); return }
    // semana: lunes a hoy
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
    const dow = (d.getDay() + 6) % 7 // 0 = lunes
    d.setDate(d.getDate() - dow)
    setDesde(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    setHasta(hoy)
  }

  async function cargar() {
    setLoading(true)
    const ini = desde + "T00:00:00-05:00"
    const fin = hasta + "T23:59:59-05:00"

    // Visitas registradas en el rango (no compró + no visitado)
    const visitas = await traerTodo(
      "visitas",
      "usuario_id, cliente_id, fecha, resultado, usuario:usuarios(nombre)",
      (q) => q.gte("fecha", desde).lte("fecha", hasta)
    )

    // Pedidos confirmados/entregados en el rango (de aquí sale "compró")
    const pedidos = await traerTodo(
      "pedidos",
      "usuario_id, cliente_id, created_at, usuario:usuarios(nombre)",
      (q) => q.in("estado", ["confirmado", "entregado"]).gte("created_at", ini).lte("created_at", fin)
    )

    const mapa: Record<string, FilaVendedor> = {}
    const get = (uid: string, nombre: string) => {
      if (!mapa[uid]) mapa[uid] = { nombre: nombre || "Sin vendedor", compro: 0, tienda_cerrada: 0, no_estaba: 0, precio_alto: 0, otro: 0, no_visitado: 0 }
      return mapa[uid]
    }

    // Visitas por resultado
    for (const v of visitas) {
      const f = get(v.usuario_id, rel(v.usuario)?.nombre)
      if (v.resultado === "tienda_cerrada") f.tienda_cerrada++
      else if (v.resultado === "no_estaba") f.no_estaba++
      else if (v.resultado === "precio_alto") f.precio_alto++
      else if (v.resultado === "otro") f.otro++
      else if (v.resultado === "no_visitado") f.no_visitado++
    }

    // Compras = combinaciones únicas (vendedor, cliente, día)
    const vistos = new Set<string>()
    for (const p of pedidos) {
      const dia = new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
      const key = `${p.usuario_id}|${p.cliente_id}|${dia}`
      if (vistos.has(key)) continue
      vistos.add(key)
      const f = get(p.usuario_id, rel(p.usuario)?.nombre)
      f.compro++
    }

    setFilas(Object.values(mapa).sort((a, b) => b.compro - a.compro))
    setLoading(false)
  }

  const btnRango = (label: string, tipo: "hoy" | "semana" | "mes") => (
    <button onClick={() => rango(tipo)} style={{ padding: "6px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", fontWeight: 600, borderRadius: "7px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>{label}</button>
  )

  const dato = (n: number, label: string, color: string) => (
    <div style={{ textAlign: "center", minWidth: "60px" }}>
      <p style={{ fontSize: "18px", fontWeight: 800, color, margin: 0 }}>{n}</p>
      <p style={{ fontSize: "10px", color: theme.muted, margin: 0, textTransform: "uppercase" }}>{label}</p>
    </div>
  )

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "14px", padding: "18px", marginBottom: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "bold", color: theme.text, margin: 0 }}>Control de visitas por vendedor</h3>
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "14px" }}>
        {btnRango("Hoy", "hoy")}
        {btnRango("Esta semana", "semana")}
        {btnRango("Este mes", "mes")}
        <span style={{ color: theme.muted, fontSize: "12px" }}>Desde</span>
        <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "7px", color: theme.text, fontSize: "13px", padding: "6px 8px" }} />
        <span style={{ color: theme.muted, fontSize: "12px" }}>Hasta</span>
        <input type="date" value={hasta} min={desde} max={hoyCol()} onChange={e => setHasta(e.target.value)} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "7px", color: theme.text, fontSize: "13px", padding: "6px 8px" }} />
      </div>

      {loading ? (
        <p style={{ color: theme.muted, fontSize: "13px", textAlign: "center", padding: "20px" }}>Cargando...</p>
      ) : filas.length === 0 ? (
        <p style={{ color: theme.muted, fontSize: "13px", textAlign: "center", padding: "20px" }}>No hay visitas registradas en este rango.</p>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {filas.map((f, i) => {
            const noCompro = f.tienda_cerrada + f.no_estaba + f.precio_alto + f.otro
            const visitados = f.compro + noCompro
            const total = visitados + f.no_visitado
            return (
              <div key={i} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: theme.text, margin: 0 }}>{f.nombre}</p>
                  <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>{visitados}/{total} visitados</p>
                </div>
                <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", justifyContent: "space-around" }}>
                  {dato(f.compro, "Compró", "#16a34a")}
                  {dato(noCompro, "No compró", "#d97706")}
                  {dato(f.no_visitado, "No visitó", "#D72638")}
                </div>
                {noCompro > 0 && (
                  <p style={{ fontSize: "11px", color: theme.muted, margin: "10px 0 0", textAlign: "center" }}>
                    Tienda cerrada: {f.tienda_cerrada} · No estaba: {f.no_estaba} · Precio alto: {f.precio_alto} · Otro: {f.otro}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
