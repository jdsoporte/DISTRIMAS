"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getSession } from "@/lib/auth"
import { useTheme } from "@/lib/theme-context"

function hoyCol() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
}

interface PedidoDia {
  id: string
  total: number
  estado: string
  created_at: string
  cliente?: { nombre: string } | { nombre: string }[]
  usuario?: { nombre: string } | { nombre: string }[]
  usuario_id: string
}

function rel<T>(v: T | T[] | undefined): T | undefined {
  return Array.isArray(v) ? v[0] : v
}

export default function HistorialDia() {
  const theme = useTheme()
  const session = getSession()
  const isAdmin = (session?.perfil?.nombre || "").toLowerCase() === "administrador"
  const uid = session?.id

  const [fecha, setFecha] = useState(hoyCol())
  const [pedidos, setPedidos] = useState<PedidoDia[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [fecha])

  async function load() {
    setLoading(true)
    const ini = fecha + "T00:00:00-05:00"
    const fin = fecha + "T23:59:59-05:00"
    let q = supabase
      .from("pedidos")
      .select("id, total, estado, created_at, usuario_id, cliente:clientes(nombre), usuario:usuarios(nombre)")
      .gte("created_at", ini).lte("created_at", fin)
      .in("estado", ["confirmado", "entregado"])
      .order("created_at", { ascending: false })
    if (!isAdmin && uid) q = q.eq("usuario_id", uid)
    const { data } = await q
    setPedidos(data || [])
    setLoading(false)
  }

  const totalDia = pedidos.reduce((s, p) => s + (p.total || 0), 0)

  // Desglose por vendedor (admin)
  const porVendedor = Object.values(
    pedidos.reduce((acc, p) => {
      const nombre = rel(p.usuario)?.nombre || "Sin vendedor"
      if (!acc[nombre]) acc[nombre] = { nombre, cantidad: 0, total: 0 }
      acc[nombre].cantidad++
      acc[nombre].total += p.total || 0
      return acc
    }, {} as Record<string, { nombre: string; cantidad: number; total: number }>)
  ).sort((a, b) => b.total - a.total)

  const esHoy = fecha === hoyCol()

  return (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h3 style={{ fontSize: "16px", fontWeight: "bold", color: theme.text, margin: "0 0 2px" }}>
            {isAdmin ? "Historial de ventas por día" : "Mis ventas del día"}
          </h3>
          <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>Solo pedidos confirmados y entregados.</p>
        </div>
        <input
          type="date" value={fecha} max={hoyCol()} onChange={e => setFecha(e.target.value)}
          style={{ background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "13px", padding: "8px 10px", outline: "none", cursor: "pointer" }}
        />
      </div>

      {/* Total del día */}
      <div style={{ background: "#0f1f3d", borderRadius: "12px", padding: "16px 18px", color: "white", marginBottom: porVendedor.length > 0 && isAdmin ? "12px" : "0" }}>
        <p style={{ fontSize: "11px", fontWeight: 700, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 6px" }}>
          {isAdmin ? "Total del día" : "Hiciste este día"} {esHoy ? "(hoy)" : ""}
        </p>
        <p style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 2px" }}>${totalDia.toLocaleString("es-CO")}</p>
        <p style={{ fontSize: "12px", opacity: 0.7, margin: 0 }}>{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Por vendedor (solo admin) */}
      {isAdmin && porVendedor.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: "8px", marginBottom: "12px" }}>
          {porVendedor.map(v => (
            <div key={v.nombre} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "10px 12px" }}>
              <p style={{ fontSize: "13px", fontWeight: 700, color: theme.text, margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nombre}</p>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "#16a34a", margin: "0 0 1px" }}>${v.total.toLocaleString("es-CO")}</p>
              <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>{v.cantidad} pedido{v.cantidad !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}

      {/* Lista de pedidos del día */}
      <div style={{ marginTop: "4px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: theme.muted, padding: "20px", fontSize: "13px" }}>Cargando...</p>
        ) : pedidos.length === 0 ? (
          <p style={{ textAlign: "center", color: theme.muted, padding: "20px", fontSize: "13px" }}>
            No hay ventas confirmadas o entregadas este día.
          </p>
        ) : (
          <div className="tabla-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                  {["Cliente", ...(isAdmin ? ["Vendedor"] : []), "Estado", "Hora", "Total"].map(h => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.6px", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pedidos.map(p => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: "9px 12px", fontSize: "13px", color: theme.text }}>{rel(p.cliente)?.nombre || "-"}</td>
                    {isAdmin && <td style={{ padding: "9px 12px", fontSize: "13px", color: theme.muted }}>{rel(p.usuario)?.nombre || "-"}</td>}
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ padding: "2px 9px", borderRadius: "99px", fontSize: "11px", fontWeight: 600, background: p.estado === "entregado" ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)", color: p.estado === "entregado" ? "#16a34a" : "#3b82f6", textTransform: "capitalize" }}>{p.estado}</span>
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "12px", color: theme.muted, whiteSpace: "nowrap" }}>
                      {new Date(p.created_at).toLocaleTimeString("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "9px 12px", fontSize: "13px", fontWeight: 600, color: theme.text, whiteSpace: "nowrap" }}>${(p.total || 0).toLocaleString("es-CO")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
