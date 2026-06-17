"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Cliente, Producto } from "@/lib/types"
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

  useEffect(() => {
    cargarTodo("clientes").then(setClientes)
    cargarTodo("productos").then(setProductos)
    supabase.from("configuraciones").select("whatsapp_numero,nombre_empresa").limit(1).single().then(r => setConfig(r.data))
    if (pedidoId) cargarPedido(pedidoId)
  }, [])

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
  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(buscarCliente.toLowerCase()) ||
    c.codigo.toLowerCase().includes(buscarCliente.toLowerCase())
  )
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

  async function guardar(estado: "borrador" | "confirmado") {
    if (!clienteId) return setError("Selecciona un cliente")
    if (items.length === 0) return setError("Agrega al menos un producto")
    setSaving(true); setError(""); setWarn("")
    const user = getSession()

    if (modoEdicion && pedidoId) {
      const { error: err } = await supabase.from("pedidos")
        .update({ cliente_id: clienteId, estado, observaciones, total })
        .eq("id", pedidoId)
      if (err) { setSaving(false); return setError(err.message) }
      await supabase.from("pedido_items").delete().eq("pedido_id", pedidoId)
      const itemsInsert = items.map(i => ({ pedido_id: pedidoId, producto_id: i.producto.id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      await supabase.from("pedido_items").insert(itemsInsert)
    } else {
      const { data: pedido, error: err } = await supabase.from("pedidos")
        .insert({ cliente_id: clienteId, usuario_id: user?.id, estado, observaciones, total })
        .select().single()
      if (err || !pedido) { setSaving(false); return setError(err?.message || "Error al crear pedido") }
      const itemsInsert = items.map(i => ({ pedido_id: pedido.id, producto_id: i.producto.id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }))
      await supabase.from("pedido_items").insert(itemsInsert)
    }

    setSaving(false)

    // Si se confirmó y hay número de WhatsApp → abrir chat
    if (estado === "confirmado" && config?.whatsapp_numero) {
      const cliente = clientes.find(c => c.id === clienteId)
      const user    = getSession()
      const ahora   = new Date()
      const fecha   = ahora.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Bogota" })
      const hora    = ahora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" })
      const lineas  = items.map(i => `• [${i.producto.codigo}] ${i.producto.nombre} x${i.cantidad} - $${i.precio_unitario.toLocaleString("es-CO")} = $${(i.cantidad * i.precio_unitario).toLocaleString("es-CO")}`).join("\n")
      const msg = [
        `🏪 *PEDIDO - ${config.nombre_empresa}*`,
        ``,
        `📋 *Cliente:* ${cliente?.nombre || ""} · Cód: ${cliente?.codigo || ""}`,
        `📍 *Municipio:* ${cliente?.municipio || ""}`,
        `👤 *Vendedor:* ${user?.nombre || ""}`,
        `📅 *Fecha:* ${fecha} · ${hora}`,
        ``,
        `*PRODUCTOS:*`,
        lineas,
        ``,
        `💰 *TOTAL: $${total.toLocaleString("es-CO")}*`,
        observaciones ? `\n📝 ${observaciones}` : "",
      ].join("\n").trim()

      window.open(`https://wa.me/${config.whatsapp_numero}?text=${encodeURIComponent(msg)}`, "_blank")
    }

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

        {clienteSeleccionado ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 16px", background: theme.cardAlt, borderRadius: "10px", border: `1px solid ${theme.border}` }}>
            <div style={{ minWidth: 0 }}>
              {/* Código grande y visible */}
              <p style={{ fontSize: "22px", fontWeight: "bold", color: "#D72638", margin: "0 0 2px", letterSpacing: "1px" }}>{clienteSeleccionado.codigo}</p>
              <p style={{ fontWeight: 600, fontSize: "15px", margin: "0 0 4px", color: theme.text }}>{clienteSeleccionado.nombre}</p>
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
            {showClientes && buscarCliente && (
              <div style={dropdownStyle}>
                {clientesFiltrados.slice(0, 8).map(c => (
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
          <p style={{ color: theme.muted, fontSize: "12px", margin: "0 0 2px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total del pedido</p>
          <p style={{ fontSize: "26px", fontWeight: "bold", margin: 0, color: theme.text }}>${total.toLocaleString("es-CO")}</p>
        </div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <button onClick={() => guardar("borrador")} disabled={saving} style={{ padding: "11px 20px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
            {modoEdicion ? "Guardar cambios" : "Guardar borrador"}
          </button>
          <button onClick={() => guardar("confirmado")} disabled={saving} style={{ padding: "11px 20px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1, display: "flex", alignItems: "center", gap: "8px" }}>
            {saving ? "Guardando..." : (
              <>
                Confirmar pedido
                {config?.whatsapp_numero && <span style={{ fontSize: "16px" }}>📱</span>}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
