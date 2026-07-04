"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/lib/theme-context"

interface TopItem { nombre: string; total: number; cantidad: number }
interface FilaRent { nombre: string; ganancia: number; ventaSinIva: number; unidades: number; margenPct: number }

export default function EstadisticasPage() {
  const theme = useTheme()
  const [topVendedores, setTopVendedores] = useState<TopItem[]>([])
  const [topClientes, setTopClientes] = useState<TopItem[]>([])
  const [topProductos, setTopProductos] = useState<TopItem[]>([])
  const [resumen, setResumen] = useState({ totalMes: 0, pedidosMes: 0, ticketPromedio: 0, entregados: 0 })
  const [masRentables, setMasRentables] = useState<FilaRent[]>([])
  const [bajoCosto, setBajoCosto] = useState<FilaRent[]>([])
  const [rent, setRent] = useState({ ganancia: 0, ventaSinIva: 0, margenPct: 0, sinCosto: 0, conCosto: 0 })
  const [ventasRuta, setVentasRuta] = useState<TopItem[]>([])
  const [ventasMunicipio, setVentasMunicipio] = useState<TopItem[]>([])
  const [margenVendedor, setMargenVendedor] = useState<FilaRent[]>([])
  const [sinMovimiento, setSinMovimiento] = useState<{ codigo: string; nombre: string }[]>([])
  const [sinMovCount, setSinMovCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [mes, setMes] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }).slice(0, 7))

  useEffect(() => { load() }, [mes])

  async function load() {
    setLoading(true)
    const inicio = mes + "-01"
    const fin = new Date(mes + "-01")
    fin.setMonth(fin.getMonth() + 1)
    const finStr = fin.toLocaleDateString("en-CA", { timeZone: "America/Bogota" })

    const { data: pedidos } = await supabase
      .from("pedidos")
      .select("id, total, estado, usuario:usuarios(nombre), cliente:clientes(nombre, municipio, ruta:rutas(nombre)), items:pedido_items(cantidad, precio_unitario, producto:productos(nombre, costo, iva))")
      .gte("created_at", inicio).lt("created_at", finStr)
      .neq("estado", "cancelado")

    if (!pedidos) { setLoading(false); return }

    const totalMes = pedidos.reduce((a, p) => a + (p.total || 0), 0)
    const entregados = pedidos.filter(p => p.estado === "entregado").length

    const vendMap: Record<string, TopItem> = {}
    pedidos.forEach(p => {
      const u = p.usuario as unknown as { nombre: string } | null
      const nombre = u?.nombre || "Desconocido"
      if (!vendMap[nombre]) vendMap[nombre] = { nombre, total: 0, cantidad: 0 }
      vendMap[nombre].total += p.total || 0
      vendMap[nombre].cantidad += 1
    })

    const cliMap: Record<string, TopItem> = {}
    pedidos.forEach(p => {
      const c = p.cliente as unknown as { nombre: string } | null
      const nombre = c?.nombre || "Desconocido"
      if (!cliMap[nombre]) cliMap[nombre] = { nombre, total: 0, cantidad: 0 }
      cliMap[nombre].total += p.total || 0
      cliMap[nombre].cantidad += 1
    })

    const prodMap: Record<string, TopItem> = {}
    pedidos.forEach(p => {
      const items = p.items as unknown as { cantidad: number; precio_unitario: number; producto: { nombre: string } | null }[]
      items?.forEach(item => {
        const nombre = item.producto?.nombre || "Desconocido"
        if (!prodMap[nombre]) prodMap[nombre] = { nombre, total: 0, cantidad: 0 }
        prodMap[nombre].total += item.cantidad * item.precio_unitario
        prodMap[nombre].cantidad += item.cantidad
      })
    })

    const sort = (m: Record<string, TopItem>) => Object.values(m).sort((a, b) => b.total - a.total).slice(0, 5)
    setTopVendedores(sort(vendMap))
    setTopClientes(sort(cliMap))
    setTopProductos(sort(prodMap))
    setResumen({ totalMes, pedidosMes: pedidos.length, ticketPromedio: pedidos.length ? Math.round(totalMes / pedidos.length) : 0, entregados })

    // Ventas por ruta y por municipio (según la ruta/municipio del cliente del pedido)
    const rutaMap: Record<string, TopItem> = {}
    const muniMap: Record<string, TopItem> = {}
    pedidos.forEach(p => {
      const c = p.cliente as any
      const r = Array.isArray(c?.ruta) ? c.ruta[0] : c?.ruta
      const ruta = r?.nombre || "Sin ruta"
      const muni = c?.municipio || "Sin municipio"
      if (!rutaMap[ruta]) rutaMap[ruta] = { nombre: ruta, total: 0, cantidad: 0 }
      rutaMap[ruta].total += p.total || 0; rutaMap[ruta].cantidad += 1
      if (!muniMap[muni]) muniMap[muni] = { nombre: muni, total: 0, cantidad: 0 }
      muniMap[muni].total += p.total || 0; muniMap[muni].cantidad += 1
    })
    setVentasRuta(Object.values(rutaMap).sort((a, b) => b.total - a.total).slice(0, 8))
    setVentasMunicipio(Object.values(muniMap).sort((a, b) => b.total - a.total).slice(0, 8))

    // Rentabilidad: ganancia = (precio sin IVA - costo) x cantidad. Solo productos con costo cargado (> 0)
    const rentMap: Record<string, { nombre: string; ganancia: number; ventaSinIva: number; unidades: number; tieneCosto: boolean }> = {}
    const vendRentMap: Record<string, { nombre: string; ganancia: number; ventaSinIva: number; tieneCosto: boolean }> = {}
    pedidos.forEach(p => {
      const u = p.usuario as any
      const vend = (Array.isArray(u) ? u[0] : u)?.nombre || "Desconocido"
      const items = p.items as unknown as { cantidad: number; precio_unitario: number; producto: { nombre: string; costo: number; iva: number } | null }[]
      items?.forEach(item => {
        const prod = item.producto
        if (!prod) return
        const nombre = prod.nombre || "Desconocido"
        const iva = prod.iva || 0
        const costo = prod.costo || 0
        const precioSinIva = item.precio_unitario / (1 + iva / 100)
        if (!rentMap[nombre]) rentMap[nombre] = { nombre, ganancia: 0, ventaSinIva: 0, unidades: 0, tieneCosto: costo > 0 }
        rentMap[nombre].ventaSinIva += precioSinIva * item.cantidad
        rentMap[nombre].ganancia += (precioSinIva - costo) * item.cantidad
        rentMap[nombre].unidades += item.cantidad
        if (costo > 0) rentMap[nombre].tieneCosto = true
        // Margen por vendedor
        if (!vendRentMap[vend]) vendRentMap[vend] = { nombre: vend, ganancia: 0, ventaSinIva: 0, tieneCosto: false }
        vendRentMap[vend].ventaSinIva += precioSinIva * item.cantidad
        vendRentMap[vend].ganancia += (precioSinIva - costo) * item.cantidad
        if (costo > 0) vendRentMap[vend].tieneCosto = true
      })
    })

    setMargenVendedor(Object.values(vendRentMap).filter(v => v.tieneCosto).map(v => ({
      nombre: v.nombre, ganancia: v.ganancia, ventaSinIva: v.ventaSinIva, unidades: 0,
      margenPct: v.ventaSinIva > 0 ? (v.ganancia / v.ventaSinIva) * 100 : 0,
    })).sort((a, b) => b.ganancia - a.ganancia))

    const conCosto = Object.values(rentMap).filter(r => r.tieneCosto)
    const sinCostoCount = Object.values(rentMap).filter(r => !r.tieneCosto).length
    const filas: FilaRent[] = conCosto.map(r => ({
      nombre: r.nombre, ganancia: r.ganancia, ventaSinIva: r.ventaSinIva, unidades: r.unidades,
      margenPct: r.ventaSinIva > 0 ? (r.ganancia / r.ventaSinIva) * 100 : 0,
    }))
    const gananciaTotal = filas.reduce((a, r) => a + r.ganancia, 0)
    const ventaSinIvaTotal = filas.reduce((a, r) => a + r.ventaSinIva, 0)

    setMasRentables([...filas].sort((a, b) => b.ganancia - a.ganancia).slice(0, 8))
    setBajoCosto(filas.filter(r => r.ganancia < 0).sort((a, b) => a.ganancia - b.ganancia).slice(0, 8))
    setRent({
      ganancia: Math.round(gananciaTotal),
      ventaSinIva: Math.round(ventaSinIvaTotal),
      margenPct: ventaSinIvaTotal > 0 ? (gananciaTotal / ventaSinIvaTotal) * 100 : 0,
      sinCosto: sinCostoCount,
      conCosto: conCosto.length,
    })

    // Productos sin movimiento: activos que no se vendieron este mes
    const { data: prodActivos } = await supabase.from("productos").select("codigo, nombre").eq("activo", true)
    const vendidosNombres = new Set(Object.keys(prodMap))
    const sinMov = (prodActivos || []).filter(pr => !vendidosNombres.has(pr.nombre))
    setSinMovCount(sinMov.length)
    setSinMovimiento(sinMov.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")).slice(0, 100))

    setLoading(false)
  }

  const maxVend = topVendedores[0]?.total || 1
  const maxCli = topClientes[0]?.total || 1
  const maxProd = topProductos[0]?.total || 1

  const Card = ({ label, value }: { label: string; value: string }) => (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "20px" }}>
      <p style={{ color: theme.muted, fontSize: "12px", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.7px" }}>{label}</p>
      <p style={{ fontSize: "26px", fontWeight: "bold", margin: 0, color: theme.text }}>{value}</p>
    </div>
  )

  const TopList = ({ titulo, items, max, unit }: { titulo: string; items: TopItem[]; max: number; unit: string }) => (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "24px" }}>
      <p style={{ fontWeight: "bold", fontSize: "15px", margin: "0 0 20px", color: theme.text }}>{titulo}</p>
      {loading ? <p style={{ color: theme.muted, fontSize: "13px" }}>Cargando...</p> : items.length === 0 ? <p style={{ color: theme.muted, fontSize: "13px" }}>Sin datos</p> : (
        <div style={{ display: "grid", gap: "14px" }}>
          {items.map((item, i) => (
            <div key={item.nombre}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: i === 0 ? "#D72638" : theme.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", color: i === 0 ? "white" : theme.muted, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: "13px", fontWeight: 500, color: theme.text }}>{item.nombre}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: theme.text }}>${item.total.toLocaleString("es-CO")}</span>
                  <span style={{ fontSize: "11px", color: theme.muted, marginLeft: "6px" }}>{item.cantidad} {unit}</span>
                </div>
              </div>
              <div style={{ height: "4px", background: theme.cardAlt, borderRadius: "99px" }}>
                <div style={{ height: "100%", width: `${(item.total / max) * 100}%`, background: i === 0 ? "#D72638" : theme.border, borderRadius: "99px", transition: "width 0.5s" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const RentList = ({ titulo, subtitulo, items, alerta }: { titulo: string; subtitulo: string; items: FilaRent[]; alerta?: boolean }) => (
    <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "24px" }}>
      <p style={{ fontWeight: "bold", fontSize: "15px", margin: "0 0 2px", color: theme.text }}>{titulo}</p>
      <p style={{ fontSize: "12px", color: theme.muted, margin: "0 0 18px" }}>{subtitulo}</p>
      {loading ? <p style={{ color: theme.muted, fontSize: "13px" }}>Cargando...</p> : items.length === 0 ? <p style={{ color: theme.muted, fontSize: "13px" }}>Sin datos</p> : (
        <div style={{ display: "grid", gap: "14px" }}>
          {items.map((item, i) => (
            <div key={item.nombre} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: (alerta || i === 0) ? "#D72638" : theme.cardAlt, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "bold", color: (alerta || i === 0) ? "white" : theme.muted, flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: "13px", fontWeight: 500, color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.nombre}</span>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: item.ganancia < 0 ? "#D72638" : "#16a34a", display: "block" }}>${Math.round(item.ganancia).toLocaleString("es-CO")}</span>
                <span style={{ fontSize: "11px", color: theme.muted }}>{item.margenPct.toFixed(1)}% margen</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Estadísticas</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>Resumen de ventas y desempeño</p>
        </div>
        <input type="month" value={mes} onChange={e => setMes(e.target.value)}
          style={{ background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "9px 12px", outline: "none" }} />
      </div>

      <div className="stats-grid-4">
        <Card label="Total del mes" value={loading ? "..." : "$" + resumen.totalMes.toLocaleString("es-CO")} />
        <Card label="Pedidos" value={loading ? "..." : String(resumen.pedidosMes)} />
        <Card label="Ticket promedio" value={loading ? "..." : "$" + resumen.ticketPromedio.toLocaleString("es-CO")} />
        <Card label="Entregados" value={loading ? "..." : String(resumen.entregados)} />
      </div>

      <div className="stats-grid-3">
        <TopList titulo="Top vendedores" items={topVendedores} max={maxVend} unit="pedidos" />
        <TopList titulo="Top clientes" items={topClientes} max={maxCli} unit="pedidos" />
        <TopList titulo="Top productos" items={topProductos} max={maxProd} unit="und" />
      </div>

      {/* ── RENTABILIDAD ── */}
      <div style={{ marginTop: "28px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Rentabilidad y márgenes</h3>
        <p style={{ color: theme.muted, fontSize: "13px", margin: "0 0 16px" }}>
          Ganancia real de cada producto: precio sin IVA menos el costo. Solo se incluyen los productos que tienen el costo cargado.
        </p>

        {!loading && rent.sinCosto > 0 && (
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", color: "#d97706", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px", fontWeight: 500 }}>
            {rent.sinCosto} producto(s) vendidos este mes no tienen costo cargado, por eso no entran en el cálculo de ganancia. Cárgalos en Inventario con el botón "Importar costos".
          </div>
        )}

        <div className="stats-grid-4" style={{ marginBottom: "18px" }}>
          <Card label="Ganancia del mes" value={loading ? "..." : "$" + rent.ganancia.toLocaleString("es-CO")} />
          <Card label="Margen promedio" value={loading ? "..." : rent.margenPct.toFixed(1) + "%"} />
          <Card label="Venta sin IVA (con costo)" value={loading ? "..." : "$" + rent.ventaSinIva.toLocaleString("es-CO")} />
          <Card label="Productos con costo" value={loading ? "..." : String(rent.conCosto)} />
        </div>

        <div className="stats-grid-3">
          <RentList titulo="Productos más rentables" subtitulo="Por ganancia en pesos" items={masRentables} />
          {bajoCosto.length > 0 && (
            <RentList titulo="Vendidos por debajo del costo" subtitulo="Revisar: dejan pérdida" items={bajoCosto} alerta />
          )}
        </div>

        {margenVendedor.length > 0 && (
          <div style={{ marginTop: "16px" }} className="stats-grid-3">
            <RentList titulo="Margen por vendedor" subtitulo="Ganancia que deja cada vendedor" items={margenVendedor} />
          </div>
        )}
      </div>

      {/* ── VENTAS POR ZONA ── */}
      <div style={{ marginTop: "28px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Ventas por zona</h3>
        <p style={{ color: theme.muted, fontSize: "13px", margin: "0 0 16px" }}>Dónde se concentran las ventas del mes, por ruta y por municipio.</p>
        <div className="stats-grid-3">
          <TopList titulo="Ventas por ruta" items={ventasRuta} max={Math.max(...ventasRuta.map(r => r.total), 1)} unit="pedidos" />
          <TopList titulo="Ventas por municipio" items={ventasMunicipio} max={Math.max(...ventasMunicipio.map(m => m.total), 1)} unit="pedidos" />
        </div>
      </div>

      {/* ── PRODUCTOS SIN MOVIMIENTO ── */}
      <div style={{ marginTop: "28px" }}>
        <h3 style={{ fontSize: "18px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Productos sin movimiento</h3>
        <p style={{ color: theme.muted, fontSize: "13px", margin: "0 0 14px" }}>
          Productos activos que no se vendieron este mes. Es capital detenido: candidatos a promoción o a no volver a pedir.
        </p>
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "20px" }}>
          {loading ? (
            <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>Cargando...</p>
          ) : sinMovCount === 0 ? (
            <p style={{ color: "#16a34a", fontSize: "13px", fontWeight: 600, margin: 0 }}>Todos los productos activos tuvieron al menos una venta este mes.</p>
          ) : (
            <>
              <p style={{ fontSize: "14px", fontWeight: 700, color: "#D72638", margin: "0 0 12px" }}>{sinMovCount} producto(s) sin vender este mes{sinMovimiento.length < sinMovCount ? ` (mostrando los primeros ${sinMovimiento.length})` : ""}</p>
              <div style={{ display: "grid", gap: "6px" }}>
                {sinMovimiento.map(p => (
                  <div key={p.codigo + p.nombre} style={{ display: "flex", gap: "10px", padding: "6px 10px", background: theme.cardAlt, borderRadius: "6px" }}>
                    <span style={{ fontSize: "12px", color: theme.muted, fontWeight: 600, minWidth: "50px" }}>{p.codigo}</span>
                    <span style={{ fontSize: "13px", color: theme.text }}>{p.nombre}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
