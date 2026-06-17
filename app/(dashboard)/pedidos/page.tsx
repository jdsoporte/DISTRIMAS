"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Pedido } from "@/lib/types"
import { getSession } from "@/lib/auth"
import { useTheme } from "@/lib/theme-context"

const ESTADOS = ["todos", "borrador", "confirmado", "entregado", "cancelado"] as const
const COLOR_ESTADO: Record<string, { bg: string; color: string }> = {
  borrador:   { bg: "rgba(107,114,128,0.15)", color: "#6B7280" },
  confirmado: { bg: "rgba(59,130,246,0.15)",  color: "#3b82f6" },
  entregado:  { bg: "rgba(34,197,94,0.15)",   color: "#16a34a" },
  cancelado:  { bg: "rgba(215,38,56,0.15)",   color: "#D72638" },
}

// toISOString() usa UTC — Colombia es UTC-5, por eso aparece el día siguiente
function hoy() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) }

export default function PedidosPage() {
  const theme = useTheme()
  const router = useRouter()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState("")
  const [filtroEstado, setFiltroEstado] = useState<typeof ESTADOS[number]>("todos")
  const [detalle, setDetalle] = useState<Pedido | null>(null)
  const [fechaIni, setFechaIni] = useState(hoy())
  const [fechaFin, setFechaFin] = useState(hoy())
  const isAdmin = getSession()?.perfil?.nombre === "Administrador"
  const userId = getSession()?.id

  useEffect(() => { load() }, [fechaIni, fechaFin])

  async function load() {
    setLoading(true)
    // Usar timestamps con offset Colombia (-05:00) para comparación exacta contra created_at UTC
    const ini = fechaIni + "T00:00:00-05:00"   // medianoche Colombia del día inicial
    const fin = fechaFin + "T23:59:59-05:00"   // último segundo Colombia del día final

    let q = supabase
      .from("pedidos")
      .select("*, cliente:clientes(*), usuario:usuarios(nombre), items:pedido_items(*, producto:productos(nombre,unidad))")
      .gte("created_at", ini)
      .lte("created_at", fin)
      .order("created_at", { ascending: false })
    if (!isAdmin) q = q.eq("usuario_id", userId)
    const { data } = await q
    setPedidos(data || [])
    setLoading(false)
  }

  async function cambiarEstado(id: string, estado: string) {
    await supabase.from("pedidos").update({ estado }).eq("id", id)
    load()
    if (detalle?.id === id) setDetalle(d => d ? { ...d, estado: estado as Pedido["estado"] } : d)
  }

  async function eliminar(id: string) {
    if (!confirm("¿Eliminar este pedido?")) return
    await supabase.from("pedido_items").delete().eq("pedido_id", id)
    await supabase.from("pedidos").delete().eq("id", id)
    setDetalle(null); load()
  }

  function irHoy() { setFechaIni(hoy()); setFechaFin(hoy()) }
  function irSemana() {
    const d = new Date()
    const lunes = new Date(d)
    lunes.setDate(d.getDate() - d.getDay() + 1)
    setFechaIni(lunes.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }))
    setFechaFin(hoy())
  }
  function irMes() {
    const d = new Date()
    setFechaIni(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`)
    setFechaFin(hoy())
  }

  const filtrados = pedidos.filter(p => {
    const q = buscar.toLowerCase()
    const coincide = p.cliente?.nombre?.toLowerCase().includes(q) || p.id.includes(q)
    return coincide && (filtroEstado === "todos" || p.estado === filtroEstado)
  })

  // Solo cuentan confirmados y entregados para las sumatorias en pesos
  const contables = filtrados.filter(p => p.estado === "confirmado" || p.estado === "entregado")
  const totalGeneral = contables.reduce((s, p) => s + (p.total || 0), 0)
  const porVendedor = Object.values(
    contables.reduce((acc, p) => {
      const nombre = p.usuario?.nombre || "Sin vendedor"
      if (!acc[nombre]) acc[nombre] = { nombre, cantidad: 0, total: 0 }
      acc[nombre].cantidad++
      acc[nombre].total += p.total || 0
      return acc
    }, {} as Record<string, { nombre: string; cantidad: number; total: number }>)
  ).sort((a, b) => b.total - a.total)

  const esHoy = fechaIni === hoy() && fechaFin === hoy()
  const inputFecha = {
    background: theme.cardAlt,
    border: `1.5px solid ${theme.border}`,
    borderRadius: "8px",
    color: theme.text,
    fontSize: "13px",
    padding: "7px 10px",
    outline: "none",
    cursor: "pointer",
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Pedidos</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>
            {filtrados.length} pedido{filtrados.length !== 1 ? "s" : ""} · {esHoy ? "Hoy" : `${fechaIni} → ${fechaFin}`}
          </p>
        </div>
        <button onClick={() => router.push("/pedidos/nuevo")} style={{ padding: "10px 20px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
          + Nuevo pedido
        </button>
      </div>

      {/* Filtro de fechas */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "14px 16px", marginBottom: "12px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
          {/* Atajos rápidos */}
          <div style={{ display: "flex", gap: "6px" }}>
            {[
              { label: "Hoy", fn: irHoy },
              { label: "Esta semana", fn: irSemana },
              { label: "Este mes", fn: irMes },
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn}
                style={{ padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, background: theme.cardAlt, color: theme.muted }}>
                {label}
              </button>
            ))}
          </div>
          <div style={{ width: "1px", height: "24px", background: theme.border }} />
          {/* Rango manual */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <label style={{ fontSize: "12px", color: theme.muted, fontWeight: 600 }}>Desde</label>
            <input type="date" value={fechaIni} max={fechaFin} onChange={e => setFechaIni(e.target.value)} style={inputFecha} />
            <label style={{ fontSize: "12px", color: theme.muted, fontWeight: 600 }}>Hasta</label>
            <input type="date" value={fechaFin} min={fechaIni} max={hoy()} onChange={e => setFechaFin(e.target.value)} style={inputFecha} />
          </div>
        </div>
      </div>

      {/* Búsqueda y estados */}
      <div className="filtros-wrap" style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "12px 16px", marginBottom: "14px" }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar cliente o ID..." style={{ background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "8px 12px", outline: "none", flex: "1", minWidth: "160px" }} />
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {ESTADOS.map(e => (
            <button key={e} onClick={() => setFiltroEstado(e)} style={{ padding: "6px 12px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, background: filtroEstado === e ? "#D72638" : theme.cardAlt, color: filtroEstado === e ? "white" : theme.muted, textTransform: "capitalize" }}>
              {e === "todos" ? "Todos" : e}
            </button>
          ))}
        </div>
      </div>

      {/* Resumen de totales (confirmados + entregados) */}
      <div style={{ display: "grid", gridTemplateColumns: isAdmin && porVendedor.length > 0 ? "minmax(220px, 1fr) 2fr" : "1fr", gap: "12px", marginBottom: "14px" }}>
        {/* Total general */}
        <div style={{ background: "#0f1f3d", borderRadius: "12px", padding: "16px 18px", color: "white" }}>
          <p style={{ fontSize: "11px", fontWeight: 700, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 6px" }}>Total en pesos</p>
          <p style={{ fontSize: "26px", fontWeight: 800, margin: "0 0 2px" }}>${totalGeneral.toLocaleString("es-CO")}</p>
          <p style={{ fontSize: "12px", opacity: 0.7, margin: 0 }}>{contables.length} pedido{contables.length !== 1 ? "s" : ""} confirmado/entregado</p>
        </div>

        {/* Resumen por vendedor (solo admin) */}
        {isAdmin && porVendedor.length > 0 && (
          <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "14px 16px" }}>
            <p style={{ fontSize: "11px", fontWeight: 700, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 10px" }}>Por vendedor</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {porVendedor.map(v => (
                <div key={v.nombre} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "10px 12px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: theme.text, margin: "0 0 3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nombre}</p>
                  <p style={{ fontSize: "16px", fontWeight: 800, color: "#16a34a", margin: "0 0 1px" }}>${v.total.toLocaleString("es-CO")}</p>
                  <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>{v.cantidad} pedido{v.cantidad !== 1 ? "s" : ""}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tabla */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div className="tabla-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {["Cliente", "Vendedor", "Estado", "Total", "Fecha", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>No hay pedidos en este período</td></tr>
              ) : filtrados.map(p => {
                const col = COLOR_ESTADO[p.estado] || COLOR_ESTADO.borrador
                return (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${theme.border}`, cursor: "pointer" }} onClick={() => setDetalle(p)}>
                    <td style={{ padding: "11px 14px", fontSize: "14px", fontWeight: 500, color: theme.text }}>{p.cliente?.nombre || "-"}</td>
                    <td style={{ padding: "11px 14px", fontSize: "13px", color: theme.muted, whiteSpace: "nowrap" }}>{(p.usuario as unknown as { nombre: string })?.nombre || "-"}</td>
                    <td style={{ padding: "11px 14px" }}>
                      <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, ...col, whiteSpace: "nowrap" }}>{p.estado}</span>
                    </td>
                    <td style={{ padding: "11px 14px", fontSize: "14px", fontWeight: 600, color: theme.text, whiteSpace: "nowrap" }}>${p.total.toLocaleString("es-CO")}</td>
                    <td style={{ padding: "11px 14px", fontSize: "13px", color: theme.muted, whiteSpace: "nowrap" }}>
                      <span>{new Date(p.created_at).toLocaleDateString("es-CO")}</span>
                      <span style={{ display: "block", fontSize: "11px", color: theme.muted, opacity: 0.7 }}>{new Date(p.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}</span>
                    </td>
                    <td style={{ padding: "11px 14px" }} onClick={e => e.stopPropagation()}>
                      <div className="acciones-wrap">
                        {(p.estado === "borrador" || (isAdmin && p.estado === "confirmado")) &&
                          <button onClick={() => router.push(`/pedidos/nuevo?id=${p.id}`)} style={{ padding: "5px 10px", background: theme.cardAlt, color: theme.text, fontSize: "12px", borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer", whiteSpace: "nowrap" }}>Editar</button>}
                        {p.estado === "borrador" && <button onClick={() => cambiarEstado(p.id, "confirmado")} style={{ padding: "5px 10px", background: "rgba(59,130,246,0.15)", color: "#3b82f6", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Confirmar</button>}
                        {p.estado === "confirmado" && <button onClick={() => cambiarEstado(p.id, "entregado")} style={{ padding: "5px 10px", background: "rgba(34,197,94,0.15)", color: "#16a34a", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Entregar</button>}
                        {(p.estado === "borrador" || p.estado === "confirmado") && <button onClick={() => cambiarEstado(p.id, "cancelado")} style={{ padding: "5px 10px", background: "rgba(215,38,56,0.1)", color: "#D72638", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Cancelar</button>}
                        {(p.estado === "borrador" || isAdmin) && <button onClick={() => eliminar(p.id)} style={{ padding: "5px 10px", background: theme.cardAlt, color: theme.muted, fontSize: "12px", borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer", whiteSpace: "nowrap" }}>Eliminar</button>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detalle modal */}
      {detalle && (
        <div className="modal-overlay" onClick={() => setDetalle(null)}>
          <div className="modal-box" style={{ background: theme.card, border: `1px solid ${theme.border}`, padding: "24px", maxWidth: "560px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 3px", color: theme.text }}>Detalle del pedido</h3>
                <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>{detalle.cliente?.nombre}</p>
              </div>
              <span style={{ padding: "4px 12px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, ...(COLOR_ESTADO[detalle.estado] || COLOR_ESTADO.borrador) }}>{detalle.estado}</span>
            </div>
            <div className="form-grid-2" style={{ marginBottom: "16px", padding: "14px", background: theme.cardAlt, borderRadius: "10px" }}>
              <div><p style={{ color: theme.muted, fontSize: "11px", margin: "0 0 2px" }}>MUNICIPIO</p><p style={{ fontSize: "13px", margin: 0, color: theme.text }}>{detalle.cliente?.municipio || "-"}</p></div>
              <div><p style={{ color: theme.muted, fontSize: "11px", margin: "0 0 2px" }}>TELÉFONO</p><p style={{ fontSize: "13px", margin: 0, color: theme.text }}>{detalle.cliente?.telefono || "-"}</p></div>
              <div><p style={{ color: theme.muted, fontSize: "11px", margin: "0 0 2px" }}>FECHA Y HORA</p><p style={{ fontSize: "13px", margin: 0, color: theme.text }}>{new Date(detalle.created_at).toLocaleDateString("es-CO")} · {new Date(detalle.created_at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })}</p></div>
              <div><p style={{ color: theme.muted, fontSize: "11px", margin: "0 0 2px" }}>VENDEDOR</p><p style={{ fontSize: "13px", margin: 0, color: theme.text }}>{(detalle.usuario as unknown as { nombre: string })?.nombre || "-"}</p></div>
            </div>
            {detalle.observaciones && <p style={{ color: theme.muted, fontSize: "13px", marginBottom: "14px", fontStyle: "italic" }}>"{detalle.observaciones}"</p>}
            <div className="tabla-wrap">
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {["Producto", "Und", "Cant.", "Precio", "Subtotal"].map(h => (
                      <th key={h} style={{ padding: "7px 0", textAlign: "left", fontSize: "11px", color: theme.muted, textTransform: "uppercase" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detalle.items?.map(item => (
                    <tr key={item.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: "8px 0", fontSize: "13px", color: theme.text }}>{item.producto?.nombre || "-"}</td>
                      <td style={{ padding: "8px 0", fontSize: "12px", color: theme.muted }}>{item.producto?.unidad}</td>
                      <td style={{ padding: "8px 0", fontSize: "13px", color: theme.text }}>{item.cantidad}</td>
                      <td style={{ padding: "8px 0", fontSize: "13px", color: theme.text }}>${item.precio_unitario.toLocaleString("es-CO")}</td>
                      <td style={{ padding: "8px 0", fontSize: "13px", fontWeight: 600, color: theme.text }}>${item.subtotal.toLocaleString("es-CO")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "17px", fontWeight: "bold", color: theme.text }}>Total: ${detalle.total.toLocaleString("es-CO")}</span>
              <button onClick={() => setDetalle(null)} style={{ padding: "9px 20px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
