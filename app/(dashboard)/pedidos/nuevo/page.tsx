"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Cliente, Producto, Ruta } from "@/lib/types"
import { getSession } from "@/lib/auth"
import { useTheme } from "@/lib/theme-context"

type ItemForm = { producto: Producto; cantidad: number; precio_unitario: number }

interface Config { whatsapp_numero: string; nombre_empresa: string }

export default function NuevoPedidoPage() {
  const theme = useTheme()
  const router = useRouter()
  const searchParams = useSearchParams()
  const pedidoId = searchParams.get("id")
  const modoEdicion = !!pedidoId

  const [clientes, setClientes]   = useState<Cliente[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [config, setConfig]       = useState<Config | null>(null)
  const [clienteId, setClienteId] = useState("")
  const [buscarCliente, setBuscarCliente] = useState("")
  const [buscarProducto, setBuscarProducto] = useState("")
  const [items, setItems]         = useState<ItemForm[]>([])
  const [observaciones, setObservaciones] = useState("")
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")
  const [warn, setWarn]           = useState("")
  const [showClientes, setShowClientes]   = useState(false)
  const [showProductos, setShowProductos] = useState(false)
  const [rutas, setRutas]         = useState<Ruta[]>([])
  const [rutaFiltro, setRutaFiltro] = useState<string>("todas")
  const [infoRutaHoy, setInfoRutaHoy] = useState("")
  const [rutaFestivo, setRutaFestivo] = useState<{ id: string; nombre: string } | null>(null)
  const [rutaHoyId, setRutaHoyId] = useState<string>("")

  useEffect(() => {
    cargarTodo("clientes").then(setClientes)
    cargarTodo("productos").then(setProductos)
    supabase.from("configuraciones").select("whatsapp_numero,nombre_empresa").limit(1).single().then(r => setConfig(r.data))
    cargarRutaDelDia()
    if (pedidoId) cargarPedido(pedidoId)
  }, [])

  async function cargarRutaDelDia() {
    // Cargar rutas activas (para el selector)
    const { data: rutasData } = await supabase.from("rutas").select("*").eq("activo", true).order("nombre")
    setRutas(rutasData || [])

    const user = getSession()
    const esAdmin = (user?.perfil?.nombre || "").toLowerCase() === "administrador"
    if (esAdmin || !user?.id) {
      // El admin ve todos los clientes, sin filtro por ruta
      setRutaFiltro("todas")
      return
    }

    // Día de hoy en Colombia: 0=Domingo, 1=Lunes ... 6=Sábado
    const ahoraCol = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
    const diaCol = ahoraCol.getDay()
    const quincenaHoy = ahoraCol.getDate() <= 15 ? 1 : 2

    if (diaCol === 0) {
      setInfoRutaHoy("Hoy es domingo, no hay ruta programada. Puedes ver todos los clientes.")
      setRutaFiltro("todas")
      return
    }

    const { data: asig } = await supabase
      .from("asignaciones_ruta").select("ruta_id, descanso, ruta:rutas(nombre)")
      .eq("usuario_id", user.id).eq("dia_semana", diaCol).eq("quincena", quincenaHoy).maybeSingle()

    const rutaHoyRel = asig ? (Array.isArray(asig.ruta) ? asig.ruta[0] : asig.ruta) : null

    if (!asig) {
      setInfoRutaHoy("Hoy no tienes ruta asignada. Puedes ver todos los clientes.")
      setRutaFiltro("todas")
    } else if (asig.descanso) {
      setInfoRutaHoy("Hoy es tu día de descanso. Si trabajas, puedes ver todos los clientes.")
      setRutaFiltro("todas")
    } else if (asig.ruta_id && rutaHoyRel) {
      setInfoRutaHoy(`Hoy te toca: ${rutaHoyRel.nombre}`)
      setRutaFiltro(asig.ruta_id)
      setRutaHoyId(asig.ruta_id)
    } else {
      setInfoRutaHoy("Hoy no tienes ruta asignada. Puedes ver todos los clientes.")
      setRutaFiltro("todas")
    }

    // ¿Ayer fue festivo? Si sí, ofrecer la ruta que tenía pendiente ese día
    const ayer = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
    ayer.setDate(ayer.getDate() - 1)
    const ayerStr = `${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, "0")}-${String(ayer.getDate()).padStart(2, "0")}`
    const ayerDiaSem = ayer.getDay() // 0=Dom..6=Sab
    const quincenaAyer = ayer.getDate() <= 15 ? 1 : 2

    if (ayerDiaSem !== 0) {
      const { data: fest } = await supabase.from("festivos").select("fecha").eq("fecha", ayerStr).maybeSingle()
      if (fest) {
        // Ayer fue festivo: traer la ruta que el vendedor tenía asignada ese día
        const { data: asigAyer } = await supabase
          .from("asignaciones_ruta").select("ruta_id, descanso, ruta:rutas(nombre)")
          .eq("usuario_id", user.id).eq("dia_semana", ayerDiaSem).eq("quincena", quincenaAyer).maybeSingle()
        if (asigAyer && asigAyer.ruta_id && !asigAyer.descanso) {
          // Supabase puede devolver la relación como objeto o como arreglo; normalizamos
          const rutaRel = Array.isArray(asigAyer.ruta) ? asigAyer.ruta[0] : asigAyer.ruta
          const nombreRuta = rutaRel?.nombre || "ruta"
          setRutaFestivo({ id: asigAyer.ruta_id, nombre: nombreRuta })
        }
      }
    }
  }

  async function cargarTodo(tabla: "clientes" | "productos") {
    const TAM = 1000
    let desde = 0
    let todos: any[] = []
    while (true) {
      const { data, error } = await supabase
        .from(tabla).select("*").eq("activo", true).order("nombre")
        .range(desde, desde + TAM - 1)
      if (error || !data || data.length === 0) break
      todos = todos.concat(data)
      if (data.length < TAM) break
      desde += TAM
    }
    return todos
  }

  async function cargarPedido(id: string) {
    const { data } = await supabase
      .from("pedidos")
      .select("*, items:pedido_items(*, producto:productos(*))")
      .eq("id", id)
      .single()
    if (!data) return
    setClienteId(data.cliente_id)
    setObservaciones(data.observaciones || "")
    const itemsCargados: ItemForm[] = (data.items || []).map((i: { producto: Producto; cantidad: number; precio_unitario: number }) => ({
      producto: i.producto,
      cantidad: i.cantidad,
      precio_unitario: i.precio_unitario,
    }))
    setItems(itemsCargados)
  }

  const clienteSeleccionado = clientes.find(c => c.id === clienteId)
  const clientesFiltrados = clientes.filter(c => {
    const coincideTexto =
      c.nombre.toLowerCase().includes(buscarCliente.toLowerCase()) ||
      (c.razon_social || "").toLowerCase().includes(buscarCliente.toLowerCase()) ||
      c.codigo.toLowerCase().includes(buscarCliente.toLowerCase())
    const coincideRuta = rutaFiltro === "todas" || c.ruta_id === rutaFiltro
    return coincideTexto && coincideRuta
  })
  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(buscarProducto.toLowerCase()) ||
    p.codigo.toLowerCase().includes(buscarProducto.toLowerCase())
  )

  function agregarProducto(p: Producto) {
    const existe = items.find(i => i.producto.id === p.id)
    if (existe) {
      setItems(items.map(i => i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i))
    } else {
      setItems([...items, { producto: p, cantidad: 1, precio_unitario: p.precio }])
    }
    setBuscarProducto(""); setShowProductos(false)
  }

  function quitarItem(id: string) { setItems(items.filter(i => i.producto.id !== id)) }

  function alertaStock(item: ItemForm, nuevaCant: number) {
    if (nuevaCant > item.producto.stock)
      setWarn(`⚠️ Ojo: "${item.producto.nombre}" solo tiene ${item.producto.stock} uds. en stock. El vendedor es responsable de este pedido.`)
    else setWarn("")
  }
  function sumar(id: string) {
    const item = items.find(i => i.producto.id === id)
    if (!item) return
    const nuevaCant = item.cantidad + 1
    alertaStock(item, nuevaCant)
    setItems(items.map(i => i.producto.id === id ? { ...i, cantidad: nuevaCant } : i))
  }
  function restar(id: string) {
    const item = items.find(i => i.producto.id === id)
    if (!item || item.cantidad <= 1) return
    const nuevaCant = item.cantidad - 1
    alertaStock(item, nuevaCant)
    setItems(items.map(i => i.producto.id === id ? { ...i, cantidad: nuevaCant } : i))
  }
  function setCantidad(id: string, val: string) {
    const n = parseInt(val)
    if (isNaN(n) || val === "") {
      setItems(items.map(i => i.producto.id === id ? { ...i, cantidad: 1 } : i))
      return
    }
    if (n < 1) return
    const item = items.find(i => i.producto.id === id)
    if (item) alertaStock(item, n)
    setItems(items.map(i => i.producto.id === id ? { ...i, cantidad: n } : i))
  }
  function cambiarPrecio(id: string, val: string) {
    const n = parseFloat(val)
    setItems(items.map(i => i.producto.id === id ? { ...i, precio_unitario: isNaN(n) ? 0 : n } : i))
  }

  const total = items.reduce((acc, i) => acc + i.cantidad * i.precio_unitario, 0)
  const totalSinIva = items.reduce((acc, i) => acc + i.cantidad * (i.precio_unitario / (1 + (i.producto.iva || 0) / 100)), 0)
  const totalIva = total - totalSinIva

  async function guardar() {
    if (!clienteId) return setError("Selecciona un cliente")
    if (items.length === 0) return setError("Agrega al menos un producto")
    setSaving(true); setError(""); setWarn("")
    const user = getSession()

    if (modoEdicion && pedidoId) {
      // Al editar NO se cambia el estado (se mantiene el que tenga el pedido)
      const { error: err } = await supabase.from("pedidos")
        .update({ cliente_id: clienteId, observaciones, total })
        .eq("id", pedidoId)
      if (err) { setSaving(false); return setError(err.message) }
      await supabase.from("pedido_items").delete().eq("pedido_id", pedidoId)
      const itemsInsert = items.map(i => ({ pedido_id: pedidoId, producto_id: i.producto.id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      const { error: errItems } = await supabase.from("pedido_items").insert(itemsInsert)
      if (errItems) { setSaving(false); return setError("No se pudieron guardar los productos: " + errItems.message) }
    } else {
      // Pedido nuevo: SIEMPRE queda en borrador. Se confirma después desde la lista.
      const { data: pedido, error: err } = await supabase.from("pedidos")
        .insert({ cliente_id: clienteId, usuario_id: user?.id, estado: "borrador", observaciones, total })
        .select().single()
      if (err || !pedido) { setSaving(false); return setError(err?.message || "Error al crear pedido") }
      const itemsInsert = items.map(i => ({ pedido_id: pedido.id, producto_id: i.producto.id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      const { error: errItems } = await supabase.from("pedido_items").insert(itemsInsert)
      if (errItems) { setSaving(false); return setError("No se pudieron guardar los productos: " + errItems.message) }
    }

    setSaving(false)
    router.push("/pedidos")
  }

  const inp = { background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const }
  const dropdownStyle = { position: "absolute" as const, top: "100%", left: 0, right: 0, background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "10px", zIndex: 50, maxHeight: "260px", overflowY: "auto" as const, marginTop: "6px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }
  const btnQty = { width: "30px", height: "30px", borderRadius: "6px", border: `1px solid ${theme.border}`, background: theme.cardAlt, color: theme.text, fontSize: "18px", lineHeight: 1, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 as const }

  return (
    <div style={{ maxWidth: "720px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
        <button onClick={() => router.push("/pedidos")} style={{ padding: "8px 14px", background: theme.cardAlt, color: theme.muted, fontSize: "13px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>← Volver</button>
        <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: 0, color: theme.text }}>{modoEdicion ? "Editar pedido" : "Nuevo pedido"}</h2>
      </div>

      {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
      {warn  && <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.35)", color: "#d97706", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px", fontWeight: 500 }}>{warn}</div>}

      {/* CLIENTE */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px", marginBottom: "14px" }}>
        <p style={{ fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 10px" }}>Cliente</p>

        {/* Panel de la ruta de hoy (solo vendedores) */}
        {infoRutaHoy && (
          <div style={{ background: infoRutaHoy.startsWith("Hoy te toca") ? "rgba(59,130,246,0.1)" : "rgba(245,158,11,0.1)", border: `1px solid ${infoRutaHoy.startsWith("Hoy te toca") ? "rgba(59,130,246,0.25)" : "rgba(245,158,11,0.25)"}`, borderRadius: "10px", padding: "10px 14px", marginBottom: "12px" }}>
            <p style={{ fontSize: "14px", fontWeight: 700, color: infoRutaHoy.startsWith("Hoy te toca") ? "#3b82f6" : "#f59e0b", margin: 0 }}>{infoRutaHoy}</p>
          </div>
        )}

        {/* Festivo de ayer: ofrecer elegir entre la ruta de hoy y la del festivo */}
        {rutaFestivo && (
          <div style={{ background: "rgba(215,38,56,0.07)", border: "1px solid rgba(215,38,56,0.25)", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#D72638", margin: "0 0 4px" }}>Ayer fue festivo</p>
            <p style={{ fontSize: "12px", color: theme.muted, margin: "0 0 10px" }}>Quedó pendiente tu ruta del festivo. Elige cuál vas a trabajar:</p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {rutaHoyId && (
                <button onClick={() => setRutaFiltro(rutaHoyId)} style={{ padding: "8px 14px", borderRadius: "8px", border: rutaFiltro === rutaHoyId ? "2px solid #3b82f6" : `1px solid ${theme.border}`, background: theme.cardAlt, color: theme.text, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                  Ruta de hoy
                </button>
              )}
              <button onClick={() => setRutaFiltro(rutaFestivo.id)} style={{ padding: "8px 14px", borderRadius: "8px", border: rutaFiltro === rutaFestivo.id ? "2px solid #D72638" : `1px solid ${theme.border}`, background: theme.cardAlt, color: theme.text, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
                Ruta del festivo: {rutaFestivo.nombre}
              </button>
            </div>
          </div>
        )}

        {/* Selector de ruta para filtrar clientes (cambiar a otra si hace falta) */}
        {!clienteSeleccionado && rutas.length > 0 && (
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", marginBottom: "6px" }}>Ver clientes de la ruta</label>
            <select value={rutaFiltro} onChange={e => setRutaFiltro(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="todas">Todas las rutas</option>
              {rutas.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </select>
          </div>
        )}

        {clienteSeleccionado ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 16px", background: theme.cardAlt, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
            <div style={{ minWidth: 0 }}>
              {/* Código grande y visible */}
              <p style={{ fontSize: "22px", fontWeight: "bold", color: "#D72638", margin: "0 0 2px", letterSpacing: "1px" }}>{clienteSeleccionado.codigo}</p>
              <p style={{ fontWeight: 600, fontSize: "15px", margin: "0 0 4px", color: theme.text }}>{clienteSeleccionado.nombre}</p>
              {clienteSeleccionado.razon_social && <p style={{ fontSize: "13px", margin: "0 0 4px", color: theme.text, opacity: 0.85 }}>{clienteSeleccionado.razon_social}</p>}
              <p style={{ color: theme.muted, fontSize: "12px", margin: 0 }}>
                {clienteSeleccionado.municipio}{clienteSeleccionado.barrio ? ` · ${clienteSeleccionado.barrio}` : ""}{clienteSeleccionado.telefono ? ` · ${clienteSeleccionado.telefono}` : ""}
              </p>
            </div>
            <button onClick={() => { setClienteId(""); setBuscarCliente("") }} style={{ padding: "6px 12px", background: "rgba(215,38,56,0.1)", color: "#D72638", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "1px solid rgba(215,38,56,0.2)", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>Cambiar</button>
          </div>
        ) : (
          <div style={{ position: "relative" }}>
            <input
              value={buscarCliente}
              onChange={e => { setBuscarCliente(e.target.value); setShowClientes(true) }}
              onFocus={() => setShowClientes(true)}
              placeholder="Buscar por nombre o código..."
              style={inp}
              autoComplete="off"
            />
            {showClientes && (buscarCliente || rutaFiltro !== "todas") && (
              <div style={dropdownStyle}>
                {clientesFiltrados.slice(0, 50).map(c => (
                  <div
                    key={c.id}
                    onClick={() => { setClienteId(c.id); setBuscarCliente(""); setShowClientes(false) }}
                    style={{ padding: "12px 16px", cursor: "pointer", borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: "14px" }}
                  >
                    {/* Código grande en el resultado */}
                    <div style={{ background: "rgba(215,38,56,0.1)", borderRadius: "8px", padding: "6px 10px", minWidth: "70px", textAlign: "center", flexShrink: 0 }}>
                      <p style={{ fontSize: "16px", fontWeight: "bold", color: "#D72638", margin: 0, letterSpacing: "0.5px" }}>{c.codigo}</p>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 2px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</p>
                      {c.razon_social && <p style={{ color: theme.text, fontSize: "12px", margin: "0 0 2px", opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.razon_social}</p>}
                      <p style={{ color: theme.muted, fontSize: "12px", margin: 0 }}>{c.municipio}{c.telefono ? ` · ${c.telefono}` : ""}</p>
                    </div>
                  </div>
                ))}
                {clientesFiltrados.length === 0 && <p style={{ padding: "14px 16px", color: theme.muted, fontSize: "13px", margin: 0 }}>Sin resultados</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* PRODUCTOS */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px", marginBottom: "14px" }}>
        <p style={{ fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 10px" }}>Productos</p>

        <div style={{ position: "relative", marginBottom: "14px" }}>
          <input
            value={buscarProducto}
            onChange={e => { setBuscarProducto(e.target.value); setShowProductos(true) }}
            onFocus={() => setShowProductos(true)}
            placeholder="Buscar producto por nombre o código..."
            style={inp}
            autoComplete="off"
          />
          {showProductos && buscarProducto && (
            <div style={dropdownStyle}>
              {productosFiltrados.slice(0, 8).map(p => (
                <div key={p.id} onClick={() => agregarProducto(p)} style={{ padding: "11px 16px", cursor: "pointer", borderBottom: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 2px", color: theme.text }}>{p.nombre}</p>
                    <p style={{ color: theme.muted, fontSize: "12px", margin: 0 }}>{p.codigo} · Stock: {p.stock} {p.unidad}</p>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: "15px", color: "#D72638", flexShrink: 0 }}>${p.precio.toLocaleString("es-CO")}</span>
                </div>
              ))}
              {productosFiltrados.length === 0 && <p style={{ padding: "14px 16px", color: theme.muted, fontSize: "13px", margin: 0 }}>Sin resultados</p>}
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <p style={{ color: theme.muted, fontSize: "13px", textAlign: "center", padding: "20px 0" }}>Busca y agrega productos al pedido</p>
        ) : (
          <div style={{ display: "grid", gap: "10px" }}>
            {items.map(item => (
              <div key={item.producto.id} style={{ background: theme.cardAlt, borderRadius: "10px", border: `1px solid ${theme.border}`, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", gap: "8px" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 600, fontSize: "14px", margin: "0 0 2px", color: theme.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.producto.nombre}</p>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <p style={{ color: theme.muted, fontSize: "12px", margin: 0 }}>{item.producto.codigo} · {item.producto.unidad}</p>
                      {/* Stock disponible siempre visible */}
                      <span style={{
                        padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700,
                        background: item.producto.stock <= 0 ? "rgba(215,38,56,0.12)" : item.cantidad > item.producto.stock ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.12)",
                        color: item.producto.stock <= 0 ? "#D72638" : item.cantidad > item.producto.stock ? "#d97706" : "#16a34a",
                      }}>
                        {item.producto.stock <= 0 ? "Agotado" : `Stock: ${item.producto.stock}`}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => quitarItem(item.producto.id)} style={{ background: "rgba(215,38,56,0.1)", border: "none", color: "#D72638", cursor: "pointer", fontSize: "13px", fontWeight: 600, borderRadius: "6px", padding: "4px 8px", flexShrink: 0 }}>Quitar</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  {/* Cantidad con +/- */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <p style={{ fontSize: "11px", color: theme.muted, margin: 0, fontWeight: 600, textTransform: "uppercase" }}>Cant.</p>
                      <button style={btnQty} onClick={() => restar(item.producto.id)}>−</button>
                      <input
                        type="number"
                        value={item.cantidad}
                        min={1}
                        onChange={e => setCantidad(item.producto.id, e.target.value)}
                        style={{ width: "52px", textAlign: "center", background: item.cantidad > item.producto.stock ? "rgba(245,158,11,0.1)" : theme.card, border: `1.5px solid ${item.cantidad > item.producto.stock ? "#f59e0b" : theme.border}`, borderRadius: "6px", color: theme.text, padding: "5px 4px", fontSize: "15px", fontWeight: 600, outline: "none" }}
                      />
                      <button style={btnQty} onClick={() => sumar(item.producto.id)}>+</button>
                    </div>
                    {/* Advertencia inline justo debajo de la cantidad */}
                    {item.cantidad > item.producto.stock && item.producto.stock > 0 && (
                      <p style={{ fontSize: "11px", color: "#d97706", margin: 0, fontWeight: 600 }}>
                        ⚠️ Ojo: solo hay {item.producto.stock} en stock
                      </p>
                    )}
                    {item.producto.stock <= 0 && (
                      <p style={{ fontSize: "11px", color: "#D72638", margin: 0, fontWeight: 600 }}>
                        🚨 Este producto está agotado
                      </p>
                    )}
                  </div>
                  {/* Precio */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <p style={{ fontSize: "11px", color: theme.muted, margin: 0, fontWeight: 600, textTransform: "uppercase" }}>Precio</p>
                    <div style={{ position: "relative" }}>
                      <span style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", fontSize: "13px", color: theme.muted }}>$</span>
                      <input
                        type="number"
                        value={item.precio_unitario}
                        min={0}
                        onChange={e => cambiarPrecio(item.producto.id, e.target.value)}
                        style={{ width: "110px", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "6px", color: theme.text, padding: "5px 8px 5px 18px", fontSize: "14px", outline: "none" }}
                      />
                    </div>
                  </div>
                  {/* Subtotal */}
                  <div style={{ marginLeft: "auto" }}>
                    <p style={{ fontSize: "11px", color: theme.muted, margin: "0 0 1px", textTransform: "uppercase" }}>Subtotal</p>
                    <p style={{ fontWeight: 700, fontSize: "16px", color: theme.text, margin: 0 }}>${(item.cantidad * item.precio_unitario).toLocaleString("es-CO")}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* OBSERVACIONES */}
      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px", marginBottom: "14px" }}>
        <p style={{ fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.8px", margin: "0 0 10px" }}>Observaciones</p>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Indicaciones especiales, horario de entrega, etc." rows={3}
          style={{ background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box", resize: "vertical" }} />
      </div>

      {/* TOTAL Y BOTONES */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "18px 20px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          {totalIva > 0 && (
            <div style={{ marginBottom: "8px" }}>
              <p style={{ color: theme.muted, fontSize: "13px", margin: "0 0 2px" }}>Subtotal sin IVA: <span style={{ fontWeight: 600, color: theme.text }}>${Math.round(totalSinIva).toLocaleString("es-CO")}</span></p>
              <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>IVA: <span style={{ fontWeight: 600, color: theme.text }}>${Math.round(totalIva).toLocaleString("es-CO")}</span></p>
            </div>
          )}
          <p style={{ color: theme.muted, fontSize: "12px", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total del pedido (con IVA)</p>
          <p style={{ fontSize: "26px", fontWeight: "bold", margin: 0, color: theme.text }}>${total.toLocaleString("es-CO")}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => guardar()} disabled={saving} style={{ padding: "11px 24px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Guardando..." : (modoEdicion ? "Guardar cambios" : "Guardar pedido")}
          </button>
        </div>
      </div>
    </div>
  )
}
