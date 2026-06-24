"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { getSession } from "@/lib/auth"
import { useTheme } from "@/lib/theme-context"
import { leerDato, agregarPendiente, leerPendientes } from "@/lib/offline-db"

const MOTIVOS = [
  { val: "tienda_cerrada", label: "Tienda cerrada" },
  { val: "no_estaba", label: "No estaba el dueño" },
  { val: "precio_alto", label: "Precio muy alto" },
  { val: "otro", label: "Otro" },
]
const ETIQUETA: Record<string, string> = {
  compro: "Compró", tienda_cerrada: "Tienda cerrada", no_estaba: "No estaba el dueño",
  precio_alto: "Precio muy alto", otro: "Otro", no_visitado: "No visitado",
}

interface ClienteRuta { id: string; codigo: string; nombre: string; razon_social: string; municipio: string; direccion: string }
interface Visita { cliente_id: string; resultado: string; observacion: string | null }

function hoyCol() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) }

export default function MiRutaPage() {
  const theme = useTheme()
  const session = getSession()

  const [clientes, setClientes] = useState<ClienteRuta[]>([])
  const [visitas, setVisitas] = useState<Record<string, Visita>>({})
  const [compraron, setCompraron] = useState<Set<string>>(new Set())
  const [rutaNombre, setRutaNombre] = useState("")
  const [rutaId, setRutaId] = useState<string | null>(null)
  const [sinRuta, setSinRuta] = useState("")
  const [cerrada, setCerrada] = useState(false)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  const [otroAbierto, setOtroAbierto] = useState<string | null>(null)
  const [otroTexto, setOtroTexto] = useState("")

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true); setError("")
    const user = session
    if (!user?.id) { setLoading(false); return }

    // Sin señal: usar los datos guardados en el celular
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await cargarOffline()
      return
    }

    const ahora = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }))
    const diaCol = ahora.getDay()
    const quincena = ahora.getDate() <= 15 ? 1 : 2
    const fecha = hoyCol()

    if (diaCol === 0) { setSinRuta("Hoy es domingo, no hay ruta programada."); setLoading(false); return }

    // Ruta asignada hoy
    const { data: asig } = await supabase
      .from("asignaciones_ruta").select("ruta_id, descanso, ruta:rutas(nombre)")
      .eq("usuario_id", user.id).eq("dia_semana", diaCol).eq("quincena", quincena).maybeSingle()

    if (!asig || (!asig.ruta_id && !asig.descanso)) { setSinRuta("Hoy no tienes una ruta asignada."); setLoading(false); return }
    if (asig.descanso) { setSinRuta("Hoy es tu día de descanso."); setLoading(false); return }

    const rel = (v: any) => Array.isArray(v) ? v[0] : v
    setRutaNombre(rel(asig.ruta)?.nombre || "")
    setRutaId(asig.ruta_id)

    // Clientes de la ruta
    const acumulado: ClienteRuta[] = []
    let desde = 0; const TAM = 1000
    while (true) {
      const { data } = await supabase.from("clientes")
        .select("id, codigo, nombre, razon_social, municipio, direccion")
        .eq("ruta_id", asig.ruta_id).order("nombre").range(desde, desde + TAM - 1)
      if (!data || data.length === 0) break
      acumulado.push(...data)
      if (data.length < TAM) break
      desde += TAM
    }
    setClientes(acumulado)

    // Pedidos confirmados/entregados de hoy de este vendedor -> quién compró
    const ini = fecha + "T00:00:00-05:00", fin = fecha + "T23:59:59-05:00"
    const { data: peds } = await supabase.from("pedidos")
      .select("cliente_id").eq("usuario_id", user.id).in("estado", ["confirmado", "entregado"])
      .gte("created_at", ini).lte("created_at", fin)
    setCompraron(new Set((peds || []).map(p => p.cliente_id)))

    // Visitas registradas hoy
    const { data: vis } = await supabase.from("visitas")
      .select("cliente_id, resultado, observacion").eq("usuario_id", user.id).eq("fecha", fecha)
    const mapaVis: Record<string, Visita> = {}
    ;(vis || []).forEach(v => { mapaVis[v.cliente_id] = v })
    setVisitas(mapaVis)

    // ¿Ruta cerrada hoy?
    const { data: cierre } = await supabase.from("cierres_ruta")
      .select("id").eq("usuario_id", user.id).eq("fecha", fecha).maybeSingle()
    setCerrada(!!cierre)

    setLoading(false)
  }

  // Carga sin señal: usa los clientes y la ruta guardados en el celular
  async function cargarOffline() {
    const rd = await leerDato<{ ruta_id: string | null; descanso: boolean; nombre: string }>("ruta_dia")
    if (!rd || (!rd.ruta_id && !rd.descanso)) { setSinRuta("Sin conexión y no hay ruta guardada. Abre la app con señal al menos una vez."); setLoading(false); return }
    if (rd.descanso) { setSinRuta("Hoy es tu día de descanso."); setLoading(false); return }

    setRutaNombre((rd.nombre || "") + " (sin conexión)")
    setRutaId(rd.ruta_id)

    const todos = await leerDato<ClienteRuta[]>("clientes")
    const deRuta = (todos || []).filter(c => !rd.ruta_id || (c as any).ruta_id === rd.ruta_id)
    setClientes(deRuta)
    setCompraron(new Set())

    // Visitas que se marcaron sin señal (siguen en la cola del celular)
    const fecha = hoyCol()
    const pend = await leerPendientes()
    const mapaVis: Record<string, Visita> = {}
    pend.filter(p => p.tipo === "visita").forEach(p => {
      const v = p.payload as any
      if (v.fecha === fecha && v.resultado !== "no_visitado") {
        mapaVis[v.cliente_id] = { cliente_id: v.cliente_id, resultado: v.resultado, observacion: v.observacion }
      }
    })
    setVisitas(mapaVis)
    setCerrada(false)
    setLoading(false)
  }

  function estadoDe(clienteId: string): string {
    if (compraron.has(clienteId)) return "compro"
    if (visitas[clienteId]) return visitas[clienteId].resultado
    return "sin_marcar"
  }

  async function marcar(clienteId: string, resultado: string, observacion = "") {
    if (cerrada) return
    setError(""); setMsg("")
    const user = session
    if (!user?.id) { alert("No se pudo identificar tu sesión. Vuelve a iniciar sesión."); return }
    const fecha = hoyCol()
    const online = typeof navigator === "undefined" || navigator.onLine

    // SIN SEÑAL: guardar la visita en la cola del celular
    if (!online) {
      await agregarPendiente({
        id: `visita-${clienteId}-${fecha}`,
        tipo: "visita",
        creado: new Date().toISOString(),
        payload: { cliente_id: clienteId, usuario_id: user.id, ruta_id: rutaId, fecha, resultado, observacion: observacion || null },
      })
      setVisitas(prev => ({ ...prev, [clienteId]: { cliente_id: clienteId, resultado, observacion } }))
      setOtroAbierto(null); setOtroTexto("")
      return
    }

    const yaExiste = !!visitas[clienteId]
    let err
    if (yaExiste) {
      const r = await supabase.from("visitas")
        .update({ resultado, observacion: observacion || null })
        .eq("cliente_id", clienteId).eq("usuario_id", user.id).eq("fecha", fecha)
      err = r.error
    } else {
      const r = await supabase.from("visitas")
        .insert({ cliente_id: clienteId, usuario_id: user.id, ruta_id: rutaId, fecha, resultado, observacion: observacion || null })
      err = r.error
    }
    if (err) { setError("No se pudo guardar: " + err.message); alert("No se pudo guardar: " + err.message); return }
    setVisitas(prev => ({ ...prev, [clienteId]: { cliente_id: clienteId, resultado, observacion } }))
    setOtroAbierto(null); setOtroTexto("")
  }

  async function quitarMarca(clienteId: string) {
    if (cerrada) return
    const user = session!
    const online = typeof navigator === "undefined" || navigator.onLine
    if (online) {
      await supabase.from("visitas").delete().eq("cliente_id", clienteId).eq("usuario_id", user.id).eq("fecha", hoyCol())
    }
    setVisitas(prev => { const n = { ...prev }; delete n[clienteId]; return n })
  }

  async function cerrarRuta() {
    const sinMarcar = clientes.filter(c => estadoDe(c.id) === "sin_marcar")
    const txt = sinMarcar.length > 0
      ? `Vas a cerrar tu ruta. Quedan ${sinMarcar.length} cliente(s) sin marcar, que pasarán a "No visitado". Una vez cerrada, no podrás cambiar nada hoy. ¿Continuar?`
      : `Vas a cerrar tu ruta del día. Una vez cerrada, no podrás cambiar nada hoy. ¿Continuar?`
    if (!confirm(txt)) return
    setError(""); setMsg("")
    const user = session!
    const fecha = hoyCol()
    const online = typeof navigator === "undefined" || navigator.onLine

    // SIN SEÑAL: guardar el cierre y los no visitados en la cola del celular
    if (!online) {
      for (const c of sinMarcar) {
        await agregarPendiente({
          id: `visita-${c.id}-${fecha}`,
          tipo: "visita",
          creado: new Date().toISOString(),
          payload: { cliente_id: c.id, usuario_id: user.id, ruta_id: rutaId, fecha, resultado: "no_visitado", observacion: null },
        })
      }
      await agregarPendiente({
        id: `cierre-${user.id}-${fecha}`,
        tipo: "cierre",
        creado: new Date().toISOString(),
        payload: { usuario_id: user.id, fecha },
      })
      setVisitas(prev => {
        const n = { ...prev }
        sinMarcar.forEach(c => { n[c.id] = { cliente_id: c.id, resultado: "no_visitado", observacion: null } })
        return n
      })
      setCerrada(true)
      setMsg("✓ Ruta cerrada sin conexión. Se enviará cuando vuelva el internet.")
      return
    }

    // Marcar como no_visitado los que quedaron sin marcar
    if (sinMarcar.length > 0) {
      const filas = sinMarcar.map(c => ({ cliente_id: c.id, usuario_id: user.id, ruta_id: rutaId, fecha, resultado: "no_visitado", observacion: null }))
      const { error: err } = await supabase.from("visitas").insert(filas)
      if (err) { setError("No se pudo cerrar la ruta: " + err.message); alert("No se pudo cerrar la ruta: " + err.message); return }
    }
    // Registrar el cierre
    const { error: errC } = await supabase.from("cierres_ruta").insert({ usuario_id: user.id, fecha })
    if (errC && !errC.message.includes("duplicate")) { setError("No se pudo cerrar la ruta: " + errC.message); return }

    setMsg("✓ Ruta cerrada. ¡Buen trabajo!")
    cargar()
  }

  const visitados = clientes.filter(c => estadoDe(c.id) !== "sin_marcar").length
  const compradores = clientes.filter(c => estadoDe(c.id) === "compro").length

  function colorEstado(estado: string) {
    if (estado === "compro") return { bg: "rgba(34,197,94,0.12)", fg: "#16a34a" }
    if (estado === "sin_marcar") return { bg: theme.cardAlt, fg: theme.muted }
    if (estado === "no_visitado") return { bg: "rgba(215,38,56,0.12)", fg: "#D72638" }
    return { bg: "rgba(245,158,11,0.12)", fg: "#d97706" }
  }

  return (
    <div style={{ maxWidth: "760px" }}>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Mi ruta de hoy</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>
            {rutaNombre ? `Ruta: ${rutaNombre}` : "Marca cada cliente que visites."}
          </p>
        </div>
      </div>

      {msg && <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px" }}>{msg}</div>}
      {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}

      {loading ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "40px", textAlign: "center", color: theme.muted }}>Cargando...</div>
      ) : sinRuta ? (
        <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "40px", textAlign: "center", color: theme.muted }}>{sinRuta}</div>
      ) : (
        <>
          {/* Resumen */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "14px" }}>
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
              <p style={{ fontSize: "22px", fontWeight: 800, color: theme.text, margin: 0 }}>{clientes.length}</p>
              <p style={{ fontSize: "11px", color: theme.muted, margin: 0, textTransform: "uppercase" }}>Clientes</p>
            </div>
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
              <p style={{ fontSize: "22px", fontWeight: 800, color: "#16a34a", margin: 0 }}>{compradores}</p>
              <p style={{ fontSize: "11px", color: theme.muted, margin: 0, textTransform: "uppercase" }}>Compraron</p>
            </div>
            <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "10px", padding: "12px", textAlign: "center" }}>
              <p style={{ fontSize: "22px", fontWeight: 800, color: theme.text, margin: 0 }}>{visitados}/{clientes.length}</p>
              <p style={{ fontSize: "11px", color: theme.muted, margin: 0, textTransform: "uppercase" }}>Visitados</p>
            </div>
          </div>

          {cerrada && (
            <div style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#3b82f6", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "12px", fontWeight: 600 }}>
              Tu ruta de hoy ya está cerrada. Si necesitas corregir algo, avísale al administrador.
            </div>
          )}

          {/* Lista de clientes */}
          <div style={{ display: "grid", gap: "10px" }}>
            {clientes.map(c => {
              const estado = estadoDe(c.id)
              const col = colorEstado(estado)
              return (
                <div key={c.id} style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: estado === "sin_marcar" && !cerrada ? "10px" : "0" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: "18px", fontWeight: "bold", color: "#D72638", margin: "0 0 2px", letterSpacing: "0.5px" }}>{c.codigo}</p>
                      <p style={{ fontSize: "14px", fontWeight: 600, color: theme.text, margin: "0 0 2px" }}>{c.nombre}</p>
                      {c.razon_social && <p style={{ fontSize: "12px", color: theme.text, opacity: 0.8, margin: "0 0 2px" }}>{c.razon_social}</p>}
                      <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>{c.municipio}{c.direccion ? ` · ${c.direccion}` : ""}</p>
                    </div>
                    <span style={{ padding: "4px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 700, background: col.bg, color: col.fg, whiteSpace: "nowrap", flexShrink: 0 }}>
                      {ETIQUETA[estado] || "Sin marcar"}
                      {estado === "otro" && visitas[c.id]?.observacion ? `: ${visitas[c.id].observacion}` : ""}
                    </span>
                  </div>

                  {/* Botones para marcar (solo si no compró, no está cerrada) */}
                  {estado !== "compro" && !cerrada && (
                    <div style={{ marginTop: "10px" }}>
                      {estado !== "sin_marcar" && (
                        <button onClick={() => quitarMarca(c.id)} style={{ padding: "5px 10px", background: theme.cardAlt, color: theme.muted, fontSize: "12px", borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer", marginBottom: "8px" }}>Cambiar marca</button>
                      )}
                      {estado === "sin_marcar" && (
                        <>
                          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                            {MOTIVOS.map(m => (
                              <button key={m.val} onClick={() => m.val === "otro" ? setOtroAbierto(c.id) : marcar(c.id, m.val)} style={{ padding: "7px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", fontWeight: 600, borderRadius: "7px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>
                                {m.label}
                              </button>
                            ))}
                          </div>
                          {otroAbierto === c.id && (
                            <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                              <input value={otroTexto} onChange={e => setOtroTexto(e.target.value)} placeholder="Escribe el motivo..." autoFocus style={{ flex: 1, background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "7px", color: theme.text, fontSize: "13px", padding: "8px 10px", outline: "none" }} />
                              <button onClick={() => otroTexto.trim() ? marcar(c.id, "otro", otroTexto.trim()) : null} style={{ padding: "8px 14px", background: "#D72638", color: "white", fontSize: "13px", fontWeight: 600, borderRadius: "7px", border: "none", cursor: "pointer" }}>Guardar</button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Cerrar ruta */}
          {!cerrada && clientes.length > 0 && (
            <button onClick={cerrarRuta} style={{ marginTop: "16px", width: "100%", padding: "13px", background: "#0f1f3d", color: "white", fontWeight: 700, fontSize: "14px", borderRadius: "10px", border: "none", cursor: "pointer" }}>
              Cerrar ruta del día
            </button>
          )}
        </>
      )}
    </div>
  )
}
