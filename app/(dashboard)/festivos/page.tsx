"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/lib/theme-context"

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
const DIAS_SEM = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]

function fechaStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export default function FestivosPage() {
  const theme = useTheme()
  const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
  const [year, setYear] = useState(hoy.getFullYear())
  const [month, setMonth] = useState(hoy.getMonth())
  const [festivos, setFestivos] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError("")
    const { data, error: err } = await supabase.from("festivos").select("fecha")
    if (err) { setError("No se pudieron cargar los festivos: " + err.message); setLoading(false); return }
    setFestivos(new Set((data || []).map(f => f.fecha)))
    setLoading(false)
  }

  async function toggleDia(fecha: string) {
    setGuardando(fecha); setError("")
    try {
      if (festivos.has(fecha)) {
        const { error: err } = await supabase.from("festivos").delete().eq("fecha", fecha)
        if (err) { setError("No se pudo quitar el festivo: " + err.message); setGuardando(null); return }
        setFestivos(prev => { const n = new Set(prev); n.delete(fecha); return n })
      } else {
        const { error: err } = await supabase.from("festivos").insert({ fecha })
        if (err) { setError("No se pudo marcar el festivo: " + err.message); setGuardando(null); return }
        setFestivos(prev => new Set(prev).add(fecha))
      }
    } catch {
      setError("Ocurrió un error. Vuelve a intentar.")
    }
    setGuardando(null)
  }

  function cambiarMes(delta: number) {
    let m = month + delta, y = year
    if (m < 0) { m = 11; y-- }
    if (m > 11) { m = 0; y++ }
    setMonth(m); setYear(y)
  }

  // Construir la grilla del mes (empezando en lunes)
  const primerDia = new Date(year, month, 1).getDay() // 0=Dom..6=Sab
  const offset = (primerDia + 6) % 7                   // Lun=0..Dom=6
  const diasEnMes = new Date(year, month + 1, 0).getDate()
  const celdas: (number | null)[] = []
  for (let i = 0; i < offset; i++) celdas.push(null)
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d)

  const hoyStr = fechaStr(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
  const festivosDelMes = [...festivos].filter(f => f.startsWith(`${year}-${String(month + 1).padStart(2, "0")}`)).length

  const navBtn = { width: "38px", height: "38px", borderRadius: "8px", border: `1px solid ${theme.border}`, background: theme.cardAlt, color: theme.text, fontSize: "16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Festivos</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>Haz clic en un día para marcarlo o quitarlo como festivo.</p>
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px" }}>{error}</div>
      )}

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "20px", maxWidth: "560px" }}>
        {/* Navegación de mes */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
          <button onClick={() => cambiarMes(-1)} style={navBtn}>◀</button>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "18px", fontWeight: "bold", color: theme.text, margin: 0 }}>{MESES[month]} {year}</p>
            <p style={{ fontSize: "12px", color: theme.muted, margin: "2px 0 0" }}>{festivosDelMes} festivo{festivosDelMes !== 1 ? "s" : ""} este mes</p>
          </div>
          <button onClick={() => cambiarMes(1)} style={navBtn}>▶</button>
        </div>

        {/* Encabezado días de la semana */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px", marginBottom: "8px" }}>
          {DIAS_SEM.map(d => (
            <div key={d} style={{ textAlign: "center", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase" }}>{d}</div>
          ))}
        </div>

        {/* Grilla de días */}
        {loading ? (
          <p style={{ textAlign: "center", color: theme.muted, padding: "30px" }}>Cargando...</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
            {celdas.map((d, i) => {
              if (d === null) return <div key={`v${i}`} />
              const fecha = fechaStr(year, month, d)
              const esFestivo = festivos.has(fecha)
              const esHoy = fecha === hoyStr
              return (
                <button
                  key={fecha}
                  onClick={() => toggleDia(fecha)}
                  disabled={guardando === fecha}
                  style={{
                    aspectRatio: "1", borderRadius: "10px", cursor: "pointer",
                    border: esHoy ? `2px solid #3b82f6` : `1px solid ${theme.border}`,
                    background: esFestivo ? "#D72638" : theme.cardAlt,
                    color: esFestivo ? "white" : theme.text,
                    fontSize: "15px", fontWeight: esFestivo ? 700 : 500,
                    opacity: guardando === fecha ? 0.5 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "background 0.15s",
                  }}
                >
                  {d}
                </button>
              )
            })}
          </div>
        )}

        {/* Leyenda */}
        <div style={{ display: "flex", gap: "18px", marginTop: "18px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "16px", height: "16px", borderRadius: "5px", background: "#D72638", display: "inline-block" }} />
            <span style={{ fontSize: "12px", color: theme.muted }}>Festivo</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <span style={{ width: "16px", height: "16px", borderRadius: "5px", border: "2px solid #3b82f6", display: "inline-block" }} />
            <span style={{ fontSize: "12px", color: theme.muted }}>Hoy</span>
          </div>
        </div>
      </div>
    </div>
  )
}
