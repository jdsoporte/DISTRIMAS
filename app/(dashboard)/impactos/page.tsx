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

interface FilaProducto { id: string; codigo: string; nombre: string; tiendas: number; colocaciones: number }
interface FilaTienda { id: string; codigo: string; nombre: string; productos: number; lineas: number }
interface ClienteImpacto { id: string; codigo: string; nombre: string; productos: string[] }
interface DatosGrupo { grupo: string; clientes: number; productos: number; impactos: number; detalle: ClienteImpacto[] }

export default function ImpactosPage() {
  const theme = useTheme()
  const [desde, setDesde] = useState(primerDiaMes())
  const [hasta, setHasta] = useState(hoyCol())
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<"producto" | "tienda" | "proveedor">("producto")
  const [buscar, setBuscar] = useState("")

  const [porProducto, setPorProducto] = useState<FilaProducto[]>([])
  const [porTienda, setPorTienda] = useState<FilaTienda[]>([])
  const [totalImpactos, setTotalImpactos] = useState(0)
  const [gruposData, setGruposData] = useState<Record<string, DatosGrupo>>({})
  const [grupoSel, setGrupoSel] = useState("")

  useEffect(() => { cargar() }, [desde, hasta])

  function rango(tipo: "hoy" | "semana" | "mes") {
    const hoy = hoyCol()
    if (tipo === "hoy") { setDesde(hoy); setHasta(hoy); return }
    if (tipo === "mes") { setDesde(primerDiaMes()); setHasta(hoy); return }
    const d = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
    const dow = (d.getDay() + 6) % 7
    d.setDate(d.getDate() - dow)
    setDesde(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    setHasta(hoy)
  }

  async function cargar() {
    setLoading(true)
    const ini = desde + "T00:00:00-05:00"
    const fin = hasta + "T23:59:59-05:00"

    // Pedidos confirmados/entregados en el rango, con sus productos y la tienda
    const pedidos = await traerTodo(
      "pedidos",
      "id, cliente_id, created_at, cliente:clientes(codigo,nombre,razon_social), items:pedido_items(producto_id, producto:productos(codigo,nombre,grupo))",
      (q) => q.in("estado", ["confirmado", "entregado"]).gte("created_at", ini).lte("created_at", fin)
    )

    // Acumuladores
    const prodMap: Record<string, { codigo: string; nombre: string; tiendas: Set<string>; colocaciones: number }> = {}
    const tiendaMap: Record<string, { codigo: string; nombre: string; productos: Set<string>; lineas: number }> = {}
    const paresUnicos = new Set<string>()
    // Por grupo (proveedor): clientes, productos, impactos y el detalle de qué productos llevó cada cliente
    const grupoMap: Record<string, { clientes: Set<string>; productos: Set<string>; impactos: Set<string>; porCliente: Record<string, { codigo: string; nombre: string; productos: Set<string> }> }> = {}

    for (const p of pedidos) {
      const cli = rel(p.cliente)
      const cliId = p.cliente_id
      const items = p.items || []
      for (const it of items) {
        const prod = rel(it.producto)
        const prodId = it.producto_id
        if (!prodId || !cliId) continue

        // Por producto: cuántas tiendas distintas lo compraron + cuántas veces se colocó
        if (!prodMap[prodId]) prodMap[prodId] = { codigo: prod?.codigo || "", nombre: prod?.nombre || "Sin nombre", tiendas: new Set(), colocaciones: 0 }
        prodMap[prodId].tiendas.add(cliId)
        prodMap[prodId].colocaciones++

        // Por tienda: cuántas referencias distintas compró + cuántas líneas en total
        if (!tiendaMap[cliId]) tiendaMap[cliId] = { codigo: cli?.codigo || "", nombre: cli?.nombre || "Sin nombre", productos: new Set(), lineas: 0 }
        tiendaMap[cliId].productos.add(prodId)
        tiendaMap[cliId].lineas++

        // Por proveedor (grupo)
        const grupo = (prod?.grupo || "").toString().trim() || "Sin grupo"
        if (!grupoMap[grupo]) grupoMap[grupo] = { clientes: new Set(), productos: new Set(), impactos: new Set(), porCliente: {} }
        grupoMap[grupo].clientes.add(cliId)
        grupoMap[grupo].productos.add(prodId)
        grupoMap[grupo].impactos.add(`${prodId}|${cliId}`)
        if (!grupoMap[grupo].porCliente[cliId]) grupoMap[grupo].porCliente[cliId] = { codigo: cli?.codigo || "", nombre: cli?.nombre || "Sin nombre", productos: new Set() }
        grupoMap[grupo].porCliente[cliId].productos.add(prod?.nombre || "Sin nombre")

        // Par único producto-tienda = 1 impacto
        paresUnicos.add(`${prodId}|${cliId}`)
      }
    }

    const listaProd: FilaProducto[] = Object.entries(prodMap).map(([id, v]) => ({
      id, codigo: v.codigo, nombre: v.nombre, tiendas: v.tiendas.size, colocaciones: v.colocaciones,
    })).sort((a, b) => b.tiendas - a.tiendas || b.colocaciones - a.colocaciones)

    const listaTienda: FilaTienda[] = Object.entries(tiendaMap).map(([id, v]) => ({
      id, codigo: v.codigo, nombre: v.nombre, productos: v.productos.size, lineas: v.lineas,
    })).sort((a, b) => b.productos - a.productos || b.lineas - a.lineas)

    setPorProducto(listaProd)
    setPorTienda(listaTienda)
    setTotalImpactos(paresUnicos.size)

    const gd: Record<string, DatosGrupo> = {}
    Object.entries(grupoMap).forEach(([grupo, v]) => {
      gd[grupo] = {
        grupo,
        clientes: v.clientes.size,
        productos: v.productos.size,
        impactos: v.impactos.size,
        detalle: Object.entries(v.porCliente)
          .map(([id, c]) => ({ id, codigo: c.codigo, nombre: c.nombre, productos: [...c.productos].sort() }))
          .sort((a, b) => b.productos.length - a.productos.length),
      }
    })
    setGruposData(gd)
    setGrupoSel(prev => (prev && gd[prev]) ? prev : (Object.keys(gd).sort()[0] || ""))
    setLoading(false)
  }

  const btnRango = (label: string, tipo: "hoy" | "semana" | "mes") => (
    <button onClick={() => rango(tipo)} style={{ padding: "6px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", fontWeight: 600, borderRadius: "7px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>{label}</button>
  )

  const tarjeta = (n: number | string, label: string) => (
    <div style={{ flex: 1, minWidth: "130px", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px" }}>
      <p style={{ fontSize: "26px", fontWeight: 800, color: "#D72638", margin: "0 0 2px" }}>{n}</p>
      <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>{label}</p>
    </div>
  )

  const tab = (label: string, val: "producto" | "tienda" | "proveedor") => (
    <button
      onClick={() => { setVista(val); setBuscar("") }}
      style={{ flex: 1, padding: "10px", background: vista === val ? "#D72638" : theme.cardAlt, color: vista === val ? "white" : theme.text, fontWeight: 700, fontSize: "13px", borderRadius: "8px", border: vista === val ? "none" : `1px solid ${theme.border}`, cursor: "pointer" }}
    >{label}</button>
  )

  const q = buscar.trim().toLowerCase()
  const prodFiltrado = q ? porProducto.filter(p => p.nombre.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q)) : porProducto
  const tiendaFiltrada = q ? porTienda.filter(t => t.nombre.toLowerCase().includes(q) || t.codigo.toLowerCase().includes(q)) : porTienda

  return (
    <div style={{ maxWidth: "900px" }}>
      <p style={{ fontSize: "13px", color: theme.muted, margin: "0 0 16px" }}>
        Un impacto es cada producto que entra a una tienda. Aquí ves en cuántas tiendas está cada producto y cuántas referencias compró cada tienda.
      </p>

      {/* Filtros de fecha */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", marginBottom: "16px" }}>
        {btnRango("Hoy", "hoy")}
        {btnRango("Esta semana", "semana")}
        {btnRango("Este mes", "mes")}
        <span style={{ color: theme.muted, fontSize: "12px" }}>Desde</span>
        <input type="date" value={desde} max={hasta} onChange={e => setDesde(e.target.value)} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "7px", color: theme.text, fontSize: "13px", padding: "6px 8px" }} />
        <span style={{ color: theme.muted, fontSize: "12px" }}>Hasta</span>
        <input type="date" value={hasta} min={desde} max={hoyCol()} onChange={e => setHasta(e.target.value)} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "7px", color: theme.text, fontSize: "13px", padding: "6px 8px" }} />
      </div>

      {/* Totales */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
        {tarjeta(totalImpactos.toLocaleString("es-CO"), "Impactos totales (producto-tienda)")}
        {tarjeta(porProducto.length.toLocaleString("es-CO"), "Productos con venta")}
        {tarjeta(porTienda.length.toLocaleString("es-CO"), "Tiendas que compraron")}
      </div>

      {/* Pestañas */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        {tab("Por producto", "producto")}
        {tab("Por tienda", "tienda")}
        {tab("Por proveedor", "proveedor")}
      </div>

      {/* Buscador (solo en producto/tienda) */}
      {vista !== "proveedor" && (
        <input
          value={buscar}
          onChange={e => setBuscar(e.target.value)}
          placeholder={vista === "producto" ? "Buscar producto por nombre o código..." : "Buscar tienda por nombre o código..."}
          style={{ width: "100%", boxSizing: "border-box", background: theme.card, border: `1.5px solid ${theme.border}`, borderRadius: "10px", color: theme.text, fontSize: "14px", padding: "11px 14px", outline: "none", marginBottom: "14px" }}
        />
      )}

      {loading ? (
        <p style={{ textAlign: "center", color: theme.muted, padding: "30px" }}>Calculando impactos...</p>
      ) : vista === "producto" ? (
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "minmax(0, 1fr)" }}>
          {prodFiltrado.length === 0 ? (
            <p style={{ textAlign: "center", color: theme.muted, padding: "30px" }}>No hay ventas en este período.</p>
          ) : prodFiltrado.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: theme.text, margin: "0 0 2px", wordBreak: "break-word" }}>
                  <span style={{ color: "#D72638", fontWeight: 800 }}>{i + 1}.</span> {p.nombre}
                </p>
                <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>Código {p.codigo} · {p.colocaciones} colocaciones</p>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <p style={{ fontSize: "22px", fontWeight: 800, color: "#D72638", margin: 0 }}>{p.tiendas}</p>
                <p style={{ fontSize: "10px", color: theme.muted, margin: 0, textTransform: "uppercase" }}>tiendas</p>
              </div>
            </div>
          ))}
        </div>
      ) : vista === "tienda" ? (
        <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "minmax(0, 1fr)" }}>
          {tiendaFiltrada.length === 0 ? (
            <p style={{ textAlign: "center", color: theme.muted, padding: "30px" }}>No hay ventas en este período.</p>
          ) : tiendaFiltrada.map((t, i) => (
            <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px 14px" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontWeight: 600, color: theme.text, margin: "0 0 2px", wordBreak: "break-word" }}>
                  <span style={{ color: "#D72638", fontWeight: 800 }}>{i + 1}.</span> {t.nombre}
                </p>
                <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>Código {t.codigo} · {t.lineas} líneas en total</p>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <p style={{ fontSize: "22px", fontWeight: 800, color: "#D72638", margin: 0 }}>{t.productos}</p>
                <p style={{ fontSize: "10px", color: theme.muted, margin: 0, textTransform: "uppercase" }}>referencias</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <p style={{ fontSize: "13px", color: theme.muted, margin: "0 0 10px" }}>
            Reporte para cada proveedor (grupo): cuántas tiendas impactaron sus productos, cuáles son y qué productos llevó cada una.
          </p>
          <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "6px" }}>Elige el proveedor (grupo)</label>
          <select
            value={grupoSel}
            onChange={e => setGrupoSel(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box", background: theme.card, border: `1.5px solid ${theme.border}`, borderRadius: "10px", color: theme.text, fontSize: "14px", padding: "11px 14px", outline: "none", marginBottom: "16px" }}
          >
            {Object.keys(gruposData).length === 0 && <option value="">Sin datos en este período</option>}
            {Object.keys(gruposData).sort().map(g => (
              <option key={g} value={g}>Grupo {g} — {gruposData[g].clientes} tiendas, {gruposData[g].productos} productos</option>
            ))}
          </select>

          {gruposData[grupoSel] ? (
            <>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "18px" }}>
                {tarjeta(gruposData[grupoSel].clientes.toLocaleString("es-CO"), "Tiendas impactadas")}
                {tarjeta(gruposData[grupoSel].productos.toLocaleString("es-CO"), "Productos vendidos")}
                {tarjeta(gruposData[grupoSel].impactos.toLocaleString("es-CO"), "Impactos totales")}
              </div>

              <p style={{ fontSize: "13px", fontWeight: 700, color: theme.text, margin: "0 0 10px" }}>
                Tiendas impactadas y qué productos llevaron
              </p>
              <div style={{ display: "grid", gap: "8px", gridTemplateColumns: "minmax(0, 1fr)" }}>
                {gruposData[grupoSel].detalle.map((c, i) => (
                  <div key={c.id} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px 14px" }}>
                    <p style={{ fontSize: "14px", fontWeight: 600, color: theme.text, margin: "0 0 6px", wordBreak: "break-word" }}>
                      <span style={{ color: "#D72638", fontWeight: 800 }}>{i + 1}.</span> {c.nombre} <span style={{ fontSize: "12px", color: theme.muted, fontWeight: 400 }}>({c.codigo})</span>
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {c.productos.map(pr => (
                        <span key={pr} style={{ fontSize: "12px", background: theme.cardAlt, color: theme.text, borderRadius: "6px", padding: "3px 8px", border: `1px solid ${theme.border}` }}>{pr}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p style={{ textAlign: "center", color: theme.muted, padding: "30px" }}>No hay ventas en este período.</p>
          )}
        </div>
      )}
    </div>
  )
}
