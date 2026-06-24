"use client"
import { useEffect, useState } from "react"
import { getSession } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Usuario } from "@/lib/types"
import { useTheme } from "@/lib/theme-context"
import MapaVendedores from "@/components/MapaVendedores"
import ReporteVisitas from "@/components/ReporteVisitas"
import HistorialDia from "@/components/HistorialDia"
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  PieChart, Pie, Cell,
} from "recharts"

const COLORS = ["#D72638", "#8E1B25", "#e05c68", "#b71c2a", "#f0989f"]

// Íconos de línea (estilo minimalista, sin emojis)
function Ico({ name, color = "#D72638", size = 18 }: { name: string; color?: string; size?: number }) {
  const p: Record<string, React.ReactNode> = {
    cart: <><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" /></>,
    money: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
    store: <><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></>,
    trophy: <><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>,
    bars: <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /></>,
    pie: <><path d="M21.21 15.89A10 10 0 1 1 8 2.83" /><path d="M22 12A10 10 0 0 0 12 2v10z" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {p[name]}
    </svg>
  )
}

interface TopItem  { nombre: string; total: number; cantidad: number }
interface DiaItem  { dia: string; pedidos: number }

interface Stats {
  pedidosHoy: number
  pedidosAyer: number
  ventasMes: number
  tiendasActivas: number
  stockBajo: number
  tiendasVisitadas: number
  miRanking: number
  promedioDiario: number
}

export default function DashboardPage() {
  const theme = useTheme()
  const [user, setUser]                   = useState<Usuario | null>(null)
  const [stats, setStats]                 = useState<Stats>({ pedidosHoy: 0, pedidosAyer: 0, ventasMes: 0, tiendasActivas: 0, stockBajo: 0, tiendasVisitadas: 0, miRanking: 0, promedioDiario: 0 })
  const [topVendedores, setTopVendedores] = useState<TopItem[]>([])
  const [topProductos, setTopProductos]   = useState<TopItem[]>([])
  const [topTiendas, setTopTiendas]       = useState<(TopItem & { municipio: string })[]>([])
  const [diasData, setDiasData]           = useState<DiaItem[]>([])
  const [recientes, setRecientes]         = useState<any[]>([])
  const [loading, setLoading]             = useState(true)
  const [alertaStock, setAlertaStock]     = useState<{ agotados: any[]; bajos: any[] }>({ agotados: [], bajos: [] })
  const [alertaCerrada, setAlertaCerrada] = useState(false)

  useEffect(() => {
    const session = getSession()
    setUser(session)
    loadAll(session)
  }, [])

  async function loadAll(session: Usuario | null) {
    setLoading(true)
    const col = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
    const hoy       = col(new Date()) + "T00:00:00-05:00"
    const manana    = col(new Date(Date.now() + 86400000)) + "T00:00:00-05:00"
    const ayer      = col(new Date(Date.now() - 86400000)) + "T00:00:00-05:00"
    const inicioMes = col(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) + "T00:00:00-05:00"
    const hace30    = col(new Date(Date.now() - 30 * 86400000)) + "T00:00:00-05:00"

    const isAdmin = session?.perfil?.nombre === "Administrador"
    const uid = session?.id

    let qHoy = supabase.from("pedidos").select("id", { count: "exact", head: true }).gte("created_at", hoy).lt("created_at", manana)
    let qAyer = supabase.from("pedidos").select("id", { count: "exact", head: true }).gte("created_at", ayer).lt("created_at", hoy)
    let q30   = supabase.from("pedidos").select("created_at").gte("created_at", hace30).neq("estado", "cancelado")
    let qRec  = supabase.from("pedidos").select("id, total, estado, created_at, cliente:clientes(nombre), usuario:usuarios(nombre)").order("created_at", { ascending: false }).limit(5)

    if (!isAdmin && uid) {
      qHoy = qHoy.eq("usuario_id", uid)
      qAyer = qAyer.eq("usuario_id", uid)
      q30   = q30.eq("usuario_id", uid)
      qRec  = qRec.eq("usuario_id", uid)
    }

    const [
      { count: pedidosHoy },
      { count: pedidosAyer },
      { data: pedidosMes },
      { count: tiendas },
      { data: bajo },
      { data: pedidos30 },
      { data: recientesRaw },
    ] = await Promise.all([
      qHoy,
      qAyer,
      supabase.from("pedidos")
        .select("total, usuario_id, usuario:usuarios(nombre), cliente:clientes(nombre, municipio), items:pedido_items(cantidad, precio_unitario, producto:productos(nombre))")
        .gte("created_at", inicioMes)
        .neq("estado", "cancelado"),
      supabase.from("clientes").select("id", { count: "exact", head: true }).eq("activo", true),
      supabase.from("productos").select("id,nombre,stock,stock_minimo").eq("activo", true),
      q30,
      qRec,
    ])

    const todosProductos = bajo || []
    const agotados = todosProductos.filter((p: any) => p.stock <= 0)
    const bajos    = todosProductos.filter((p: any) => p.stock > 0 && p.stock < p.stock_minimo)
    setAlertaStock({ agotados, bajos })
    setAlertaCerrada(false)

    const allPedidosMes = pedidosMes || []
    const misPedidosMes = isAdmin ? allPedidosMes : allPedidosMes.filter((p: any) => p.usuario_id === uid)

    const ventasMes      = misPedidosMes.reduce((a: number, p: any) => a + (p.total || 0), 0)
    const tiendasVisitadas = new Set(misPedidosMes.map((p: any) => (p.cliente as any)?.nombre).filter(Boolean)).size
    const diaDelMes      = new Date().getDate()
    const promedioDiario = Math.round(ventasMes / Math.max(1, diaDelMes))

    // Top vendedores siempre del mes completo (para ranking)
    const vendMap: Record<string, TopItem> = {}
    allPedidosMes.forEach((p: any) => {
      const nombre = (p.usuario as any)?.nombre || "Desconocido"
      if (!vendMap[nombre]) vendMap[nombre] = { nombre, total: 0, cantidad: 0 }
      vendMap[nombre].total    += p.total || 0
      vendMap[nombre].cantidad += 1
    })

    // Top tiendas y productos filtrados por vendedor
    const tiendaMap: Record<string, TopItem & { municipio: string }> = {}
    const prodMap: Record<string, TopItem> = {}

    misPedidosMes.forEach((p: any) => {
      const c = p.cliente as any
      const tc = c?.nombre || "Desconocida"
      if (!tiendaMap[tc]) tiendaMap[tc] = { nombre: tc, municipio: c?.municipio || "", total: 0, cantidad: 0 }
      tiendaMap[tc].total    += p.total || 0
      tiendaMap[tc].cantidad += 1

      ;(p.items || []).forEach((item: any) => {
        const pn = item.producto?.nombre || "Desconocido"
        if (!prodMap[pn]) prodMap[pn] = { nombre: pn, total: 0, cantidad: 0 }
        prodMap[pn].total    += item.cantidad * item.precio_unitario
        prodMap[pn].cantidad += item.cantidad
      })
    })

    const diaMap: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
      diaMap[d] = 0
    }
    ;(pedidos30 || []).forEach((p: any) => {
      const d = new Date(p.created_at).toLocaleDateString("en-CA", { timeZone: "America/Bogota" })
      if (d in diaMap) diaMap[d]++
    })

    const sort = <T extends TopItem>(m: Record<string, T>) =>
      Object.values(m).sort((a, b) => b.total - a.total).slice(0, 5)

    const sortedVend = sort(vendMap)
    const miNombre   = session?.nombre || ""
    const miRankingPos = sortedVend.findIndex(v => v.nombre === miNombre) + 1

    setStats({
      pedidosHoy: pedidosHoy || 0,
      pedidosAyer: pedidosAyer || 0,
      ventasMes,
      tiendasActivas: tiendas || 0,
      stockBajo: agotados.length + bajos.length,
      tiendasVisitadas,
      miRanking: miRankingPos,
      promedioDiario,
    })
    setTopVendedores(sortedVend)
    setTopTiendas(sort(tiendaMap as any) as any)
    setTopProductos(sort(prodMap))
    setDiasData(Object.entries(diaMap).map(([dia, pedidos]) => ({ dia: dia.slice(5), pedidos })))
    setRecientes(recientesRaw || [])
    setLoading(false)
  }

  const isAdmin = user?.perfil?.nombre === "Administrador"

  const pctVsAyer = stats.pedidosAyer === 0
    ? null
    : Math.round(((stats.pedidosHoy - stats.pedidosAyer) / stats.pedidosAyer) * 100)

  const rankingLabel = stats.miRanking === 0 ? "Sin ventas aún" : `${stats.miRanking}° del mes`
  const rankingColor = stats.miRanking === 1 ? "#D72638" : stats.miRanking === 2 ? "#6B7280" : stats.miRanking === 3 ? "#d97706" : "#D72638"

  const card = {
    background: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: "14px",
    padding: "20px",
    boxShadow: theme.dark ? "none" : "0 2px 8px rgba(0,0,0,0.06)",
  }
  const sectionTitle = { fontSize: "14px", fontWeight: "bold" as const, color: theme.text, margin: "0 0 16px" }

  const CustomTooltipBar = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "8px", padding: "8px 12px", fontSize: "13px", color: theme.text, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{label}</p>
        <p style={{ margin: 0, color: "#D72638" }}>{payload[0].value} pedidos</p>
      </div>
    )
  }

  const CustomTooltipPie = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "8px", padding: "8px 12px", fontSize: "13px", color: theme.text, boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{payload[0].name}</p>
        <p style={{ margin: 0, color: "#D72638" }}>${payload[0].value.toLocaleString("es-CO")}</p>
      </div>
    )
  }

  const totalProd = topProductos.reduce((a, p) => a + p.total, 0) || 1

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "40px", height: "40px", borderRadius: "50%", border: `3px solid ${theme.border}`, borderTopColor: "#D72638", margin: "0 auto 12px", animation: "spin 0.8s linear infinite" }} />
        <p style={{ color: theme.muted, fontSize: "14px" }}>Cargando dashboard...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Alerta de stock */}
      {!alertaCerrada && (alertaStock.agotados.length > 0 || alertaStock.bajos.length > 0) && (
        <div style={{
          background: alertaStock.agotados.length > 0 ? "rgba(215,38,56,0.08)" : "rgba(245,158,11,0.08)",
          border: `1px solid ${alertaStock.agotados.length > 0 ? "rgba(215,38,56,0.3)" : "rgba(245,158,11,0.3)"}`,
          borderRadius: "12px", padding: "16px 20px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "14px", fontWeight: 700, margin: "0 0 10px", color: alertaStock.agotados.length > 0 ? "#D72638" : "#d97706" }}>
                {alertaStock.agotados.length > 0 ? "Productos agotados y con stock bajo" : "Productos con stock bajo"}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {alertaStock.agotados.map((p: any) => (
                  <span key={p.id} style={{ padding: "4px 10px", background: "rgba(215,38,56,0.12)", color: "#D72638", borderRadius: "99px", fontSize: "12px", fontWeight: 600 }}>
                    {p.nombre} — AGOTADO
                  </span>
                ))}
                {alertaStock.bajos.map((p: any) => (
                  <span key={p.id} style={{ padding: "4px 10px", background: "rgba(245,158,11,0.12)", color: "#d97706", borderRadius: "99px", fontSize: "12px", fontWeight: 600 }}>
                    {p.nombre} — {p.stock} uds.
                  </span>
                ))}
              </div>
            </div>
            <button onClick={() => setAlertaCerrada(true)} style={{ background: "none", border: "none", cursor: "pointer", color: theme.muted, fontSize: "18px", padding: "0", flexShrink: 0, lineHeight: 1 }}>✕</button>
          </div>
        </div>
      )}

      {/* Saludo */}
      <div>
        <h2 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>
          Hola, {user?.nombre?.split(" ")[0]}
        </h2>
        <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>
          {isAdmin ? "Resumen general del sistema" : "Tu resumen personal del mes"}
        </p>
      </div>

      {/* Ventas del día (admin y vendedor) */}
      <HistorialDia />

      {/* ── TARJETAS ── */}
      <div className="cards-grid">

        {/* Pedidos hoy */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>
              {isAdmin ? "Pedidos hoy" : "Mis pedidos hoy"}
            </p>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(215,38,56,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}><Ico name="cart" /></div>
          </div>
          <p style={{ fontSize: "32px", fontWeight: "bold", margin: "0 0 6px", color: theme.text }}>{stats.pedidosHoy}</p>
          {pctVsAyer !== null && (
            <p style={{ fontSize: "12px", margin: 0, color: pctVsAyer >= 0 ? "#16a34a" : "#D72638", fontWeight: 600 }}>
              {pctVsAyer >= 0 ? "▲" : "▼"} {Math.abs(pctVsAyer)}% vs ayer
            </p>
          )}
          {pctVsAyer === null && <p style={{ fontSize: "12px", margin: 0, color: theme.muted }}>Sin pedidos ayer</p>}
        </div>

        {/* Ventas del mes */}
        <div style={card}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>
              {isAdmin ? "Ventas del mes" : "Mis ventas del mes"}
            </p>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(215,38,56,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}><Ico name="money" /></div>
          </div>
          <p style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 6px", color: theme.text }}>${stats.ventasMes.toLocaleString("es-CO")}</p>
          {!isAdmin && (
            <p style={{ fontSize: "12px", margin: 0, color: theme.muted }}>
              ~${stats.promedioDiario.toLocaleString("es-CO")} / día este mes
            </p>
          )}
          {isAdmin && <p style={{ fontSize: "12px", margin: 0, color: theme.muted }}>Mes actual · sin cancelados</p>}
        </div>

        {/* 3ra tarjeta: admin → tiendas activas | vendedor → tiendas visitadas */}
        {isAdmin ? (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>Tiendas activas</p>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(215,38,56,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}><Ico name="store" /></div>
            </div>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: "0 0 6px", color: theme.text }}>{stats.tiendasActivas}</p>
            <p style={{ fontSize: "12px", margin: 0, color: theme.muted }}>Clientes habilitados</p>
          </div>
        ) : (
          <div style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>Tiendas visitadas</p>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(215,38,56,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}><Ico name="store" /></div>
            </div>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: "0 0 6px", color: theme.text }}>{stats.tiendasVisitadas}</p>
            <p style={{ fontSize: "12px", margin: 0, color: theme.muted }}>
              de {stats.tiendasActivas} tiendas activas este mes
            </p>
          </div>
        )}

        {/* 4ta tarjeta: admin → stock bajo | vendedor → mi puesto */}
        {isAdmin ? (
          <div style={{ ...card, border: stats.stockBajo > 0 ? "1px solid rgba(215,38,56,0.4)" : `1px solid ${theme.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>Stock bajo</p>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: stats.stockBajo > 0 ? "rgba(215,38,56,0.12)" : "rgba(245,158,11,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}><Ico name="alert" /></div>
            </div>
            <p style={{ fontSize: "32px", fontWeight: "bold", margin: "0 0 6px", color: stats.stockBajo > 0 ? "#D72638" : theme.text }}>{stats.stockBajo}</p>
            <p style={{ fontSize: "12px", margin: 0, color: stats.stockBajo > 0 ? "#D72638" : theme.muted, fontWeight: stats.stockBajo > 0 ? 600 : 400 }}>
              {stats.stockBajo > 0 ? "¡Requiere atención!" : "Todo en orden"}
            </p>
          </div>
        ) : (
          <div style={{ ...card, border: `1px solid ${rankingColor}40` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: theme.muted, textTransform: "uppercase", letterSpacing: "0.6px", margin: 0 }}>Mi puesto</p>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${rankingColor}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><Ico name="trophy" color={rankingColor} /></div>
            </div>
            <p style={{ fontSize: "28px", fontWeight: "bold", margin: "0 0 6px", color: rankingColor }}>{rankingLabel}</p>
            <p style={{ fontSize: "12px", margin: 0, color: theme.muted }}>
              {stats.miRanking === 1 ? "¡Vas primero! Mantén el ritmo" :
               stats.miRanking === 2 ? "Cerca del primero, ¡dale más!" :
               stats.miRanking === 3 ? "Top 3 del equipo, sigue así" :
               stats.miRanking > 3 ? "¡Sube en el ranking vendiendo más!" :
               "Realiza tu primer pedido del mes"}
            </p>
          </div>
        )}
      </div>

      {/* Control de visitas por vendedor (solo admin) */}
      {isAdmin && <ReporteVisitas />}

      {/* Mapa de ubicación de vendedores (solo admin) */}
      {isAdmin && <MapaVendedores />}

      {/* ── FILA MEDIA ── */}
      <div className="dash-mid">

        {/* Bar chart — filtrado por vendedor */}
        <div style={card}>
          <p style={sectionTitle}>{isAdmin ? "Pedidos" : "Mis pedidos"} — últimos 30 días</p>
          {diasData.every(d => d.pedidos === 0) ? (
            <p style={{ color: theme.muted, fontSize: "13px" }}>Sin pedidos en este período</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={diasData} margin={{ top: 0, right: 0, left: -28, bottom: 0 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 10, fill: theme.muted }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 10, fill: theme.muted }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltipBar />} cursor={{ fill: theme.cardAlt }} />
                <Bar dataKey="pedidos" fill="#D72638" radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top vendedores — admin: ranking general | vendedor: ranking con su fila resaltada */}
        <div style={card}>
          <p style={sectionTitle}>{isAdmin ? "Top vendedores del mes" : "Ranking del mes"}</p>
          {topVendedores.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: "13px" }}>Sin datos este mes</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {topVendedores.map((v, i) => {
                const esMio = !isAdmin && v.nombre === user?.nombre
                return (
                  <div key={v.nombre} style={{
                    display: "flex", alignItems: "center", gap: "12px",
                    background: esMio ? "rgba(215,38,56,0.06)" : "transparent",
                    borderRadius: "8px", padding: esMio ? "6px 8px" : "0",
                    border: esMio ? "1px solid rgba(215,38,56,0.2)" : "none",
                    margin: esMio ? "-6px -8px" : "0",
                  }}>
                    <span style={{ width: "26px", height: "26px", borderRadius: "50%", background: i === 0 ? "#D72638" : i === 1 ? "#f59e0b" : i === 2 ? "#D72638" : theme.cardAlt, color: i < 3 ? "white" : theme.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: "bold", flexShrink: 0 }}>
                      {i + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13px", fontWeight: esMio ? 700 : 600, color: esMio ? "#D72638" : theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {v.nombre}{esMio ? " (tú)" : ""}
                        </span>
                        <span style={{ fontSize: "12px", color: theme.muted, flexShrink: 0, marginLeft: "8px" }}>{v.cantidad} ped.</span>
                      </div>
                      <div style={{ height: "4px", background: theme.cardAlt, borderRadius: "99px" }}>
                        <div style={{ height: "100%", width: `${(v.total / (topVendedores[0]?.total || 1)) * 100}%`, background: esMio ? "#D72638" : COLORS[i], borderRadius: "99px" }} />
                      </div>
                      <span style={{ fontSize: "11px", color: theme.muted }}>${v.total.toLocaleString("es-CO")}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── FILA INFERIOR ── */}
      <div className="dash-bot">

        {/* Top productos */}
        <div style={card}>
          <p style={sectionTitle}>{isAdmin ? "Top productos del mes" : "Mis top productos"}</p>
          {topProductos.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: "13px" }}>Sin datos este mes</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={topProductos} dataKey="total" nameKey="nombre" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3}>
                    {topProductos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<CustomTooltipPie />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "grid", gap: "6px" }}>
                {topProductos.map((p, i) => (
                  <div key={p.nombre} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: COLORS[i], flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: theme.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</span>
                    <span style={{ fontSize: "12px", color: theme.muted, flexShrink: 0 }}>{Math.round((p.total / totalProd) * 100)}%</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Top tiendas */}
        <div style={card}>
          <p style={sectionTitle}>{isAdmin ? "Top tiendas del mes" : "Mis top tiendas"}</p>
          {topTiendas.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: "13px" }}>Sin datos</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {topTiendas.map((t, i) => (
                <div key={t.nombre} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "6px", background: i === 0 ? "#D72638" : theme.cardAlt, color: i === 0 ? "white" : theme.muted, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", flexShrink: 0, marginTop: "1px" }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 1px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.nombre}</p>
                    <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>{t.municipio} · {t.cantidad} ped. · ${t.total.toLocaleString("es-CO")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos pedidos */}
        <div style={card}>
          <p style={sectionTitle}>{isAdmin ? "Últimos pedidos" : "Mis últimos pedidos"}</p>
          {recientes.length === 0 ? (
            <p style={{ color: theme.muted, fontSize: "13px" }}>Sin pedidos recientes</p>
          ) : (
            <div style={{ display: "grid", gap: "10px" }}>
              {recientes.map((p: any) => {
                const col = { borrador: "#6B7280", confirmado: "#D72638", entregado: "#16a34a", cancelado: "#D72638" }[p.estado as string] || "#6B7280"
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "13px", fontWeight: 600, margin: "0 0 1px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(p.cliente as any)?.nombre || "-"}</p>
                      <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>${p.total.toLocaleString("es-CO")} · {p.estado}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
