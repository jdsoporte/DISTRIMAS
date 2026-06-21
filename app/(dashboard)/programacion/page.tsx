"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Usuario, Ruta, AsignacionRuta } from "@/lib/types"
import { useTheme } from "@/lib/theme-context"

const DIAS = [
  { num: 1, nombre: "Lunes" },
  { num: 2, nombre: "Martes" },
  { num: 3, nombre: "Miércoles" },
  { num: 4, nombre: "Jueves" },
  { num: 5, nombre: "Viernes" },
  { num: 6, nombre: "Sábado" },
]

const DESCANSO = "__descanso__"
const SIN = ""

export default function ProgramacionPage() {
  const theme = useTheme()
  const [vendedores, setVendedores] = useState<Usuario[]>([])
  const [rutas, setRutas] = useState<Ruta[]>([])
  const [asignaciones, setAsignaciones] = useState<AsignacionRuta[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  const [guardandoCelda, setGuardandoCelda] = useState<string | null>(null)
  const [quincena, setQuincena] = useState(1)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError("")
    const [u, r, a] = await Promise.all([
      supabase.from("usuarios").select("*, perfil:perfiles(*)").eq("activo", true).order("nombre"),
      supabase.from("rutas").select("*").eq("activo", true).order("nombre"),
      supabase.from("asignaciones_ruta").select("*"),
    ])
    // Vendedores = usuarios activos cuyo perfil NO es Administrador
    const vend = (u.data || []).filter(x => (x.perfil?.nombre || "").toLowerCase() !== "administrador")
    setVendedores(vend)
    setRutas(r.data || [])
    setAsignaciones(a.data || [])
    setLoading(false)
  }

  // Devuelve el valor actual de la celda (ruta_id, "descanso" o "")
  function valorCelda(usuarioId: string, dia: number): string {
    const a = asignaciones.find(x => x.usuario_id === usuarioId && x.dia_semana === dia && x.quincena === quincena)
    if (!a) return SIN
    if (a.descanso) return DESCANSO
    return a.ruta_id || SIN
  }

  async function cambiar(usuarioId: string, dia: number, valor: string) {
    const key = `${usuarioId}-${dia}`
    setGuardandoCelda(key); setError(""); setMsg("")

    const descanso = valor === DESCANSO
    const ruta_id = (valor === DESCANSO || valor === SIN) ? null : valor

    // Buscar si ya existe la asignacion para esta quincena
    const existente = asignaciones.find(x => x.usuario_id === usuarioId && x.dia_semana === dia && x.quincena === quincena)

    try {
      if (valor === SIN && existente) {
        // Sin asignar = borrar el registro
        const { error: err } = await supabase.from("asignaciones_ruta").delete().eq("id", existente.id)
        if (err) { setError("No se pudo guardar: " + err.message); setGuardandoCelda(null); return }
        setAsignaciones(prev => prev.filter(x => x.id !== existente.id))
      } else if (existente) {
        const { data, error: err } = await supabase.from("asignaciones_ruta")
          .update({ ruta_id, descanso }).eq("id", existente.id).select().single()
        if (err) { setError("No se pudo guardar: " + err.message); setGuardandoCelda(null); return }
        setAsignaciones(prev => prev.map(x => x.id === existente.id ? data : x))
      } else if (valor !== SIN) {
        const { data, error: err } = await supabase.from("asignaciones_ruta")
          .insert({ usuario_id: usuarioId, dia_semana: dia, ruta_id, descanso, quincena }).select().single()
        if (err) { setError("No se pudo guardar: " + err.message); setGuardandoCelda(null); return }
        setAsignaciones(prev => [...prev, data])
      }
      setMsg("✓ Guardado")
      setTimeout(() => setMsg(""), 1500)
    } catch (e) {
      setError("Ocurrió un error al guardar. Vuelve a intentar.")
    }
    setGuardandoCelda(null)
  }

  const selStyle = {
    background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "7px",
    color: theme.text, fontSize: "13px", padding: "7px 8px", outline: "none", width: "100%",
    cursor: "pointer", boxSizing: "border-box" as const,
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Programación de rutas</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>Asigna la ruta de cada vendedor por día. La quincena 1 aplica del 1 al 15, y la quincena 2 del 16 al fin de mes.</p>
        </div>
      </div>

      {/* Pestañas de quincena */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        {[1, 2].map(q => (
          <button
            key={q}
            onClick={() => setQuincena(q)}
            style={{
              padding: "9px 18px", borderRadius: "9px", fontSize: "13px", fontWeight: 700, cursor: "pointer",
              border: quincena === q ? "2px solid #D72638" : `1px solid ${theme.border}`,
              background: quincena === q ? "rgba(215,38,56,0.08)" : theme.card,
              color: quincena === q ? "#D72638" : theme.muted,
            }}
          >
            Quincena {q} <span style={{ fontWeight: 500, fontSize: "12px" }}>({q === 1 ? "días 1–15" : "días 16–fin"})</span>
          </button>
        ))}
      </div>

      {msg && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", borderRadius: "8px", padding: "8px 14px", fontSize: "13px", marginBottom: "12px", display: "inline-block" }}>{msg}</div>
      )}
      {error && (
        <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px" }}>{error}</div>
      )}

      {loading ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "40px", textAlign: "center", color: theme.muted }}>Cargando...</div>
      ) : vendedores.length === 0 ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "40px", textAlign: "center", color: theme.muted }}>
          No hay vendedores activos. Crea usuarios con perfil de vendedor en la sección Usuarios.
        </div>
      ) : rutas.length === 0 ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "40px", textAlign: "center", color: theme.muted }}>
          No hay rutas activas. Crea o genera las rutas primero en la sección Rutas.
        </div>
      ) : (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden" }}>
          <div className="tabla-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", position: "sticky", left: 0, background: theme.card, minWidth: "150px" }}>Vendedor</th>
                  {DIAS.map(d => (
                    <th key={d.num} style={{ padding: "12px 10px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", minWidth: "140px" }}>{d.nombre}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendedores.map(v => (
                  <tr key={v.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 600, color: theme.text, position: "sticky", left: 0, background: theme.card }}>{v.nombre}</td>
                    {DIAS.map(d => {
                      const val = valorCelda(v.id, d.num)
                      const key = `${v.id}-${d.num}`
                      return (
                        <td key={d.num} style={{ padding: "8px 10px" }}>
                          <select
                            value={val}
                            disabled={guardandoCelda === key}
                            onChange={e => cambiar(v.id, d.num, e.target.value)}
                            style={{ ...selStyle, opacity: guardandoCelda === key ? 0.5 : 1, color: val === DESCANSO ? theme.muted : theme.text }}
                          >
                            <option value={SIN}>— Sin asignar —</option>
                            <option value={DESCANSO}>Descanso</option>
                            {rutas.map(r => (
                              <option key={r.id} value={r.id}>{r.nombre}</option>
                            ))}
                          </select>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p style={{ color: theme.muted, fontSize: "12px", marginTop: "12px" }}>
        Cada cambio se guarda solo. "Descanso" marca el día libre del vendedor; "Sin asignar" lo deja sin ruta ese día. Estás editando la <strong>Quincena {quincena}</strong>.
      </p>
    </div>
  )
}
