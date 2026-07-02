"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Ruta } from "@/lib/types"
import { useTheme } from "@/lib/theme-context"

interface ClienteRuta {
  id: string
  codigo: string
  nombre: string
  razon_social: string
  direccion: string
  municipio: string
  ruta_id: string | null
  ruta?: { nombre: string } | { nombre: string }[] | null
}

const nombreRuta = (c: ClienteRuta) => {
  const r = Array.isArray(c.ruta) ? c.ruta[0] : c.ruta
  return r?.nombre || null
}

export default function GestionClientesRuta({ ruta, onClose, onCambio }: { ruta: Ruta; onClose: () => void; onCambio: () => void }) {
  const theme = useTheme()
  const [clientes, setClientes] = useState<ClienteRuta[]>([])
  const [municipios, setMunicipios] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState("")
  const [error, setError] = useState("")
  const [trabajando, setTrabajando] = useState(false)

  // Agregar municipio completo
  const [muniSel, setMuniSel] = useState("")

  // Buscar clientes sueltos
  const [buscar, setBuscar] = useState("")
  const [resultados, setResultados] = useState<ClienteRuta[]>([])
  const [buscando, setBuscando] = useState(false)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true); setError("")
    // Clientes actuales de la ruta (paginado)
    const acumulado: ClienteRuta[] = []
    let desde = 0; const TAM = 1000
    while (true) {
      const { data, error: err } = await supabase
        .from("clientes").select("id, codigo, nombre, razon_social, direccion, municipio, ruta_id")
        .eq("ruta_id", ruta.id).order("nombre").range(desde, desde + TAM - 1)
      if (err) { setError("No se pudieron cargar los clientes: " + err.message); break }
      if (!data || data.length === 0) break
      acumulado.push(...data)
      if (data.length < TAM) break
      desde += TAM
    }
    setClientes(acumulado)

    // Municipios distintos (para el selector de agregar municipio completo)
    const muniSet = new Set<string>()
    desde = 0
    while (true) {
      const { data } = await supabase.from("clientes").select("municipio").range(desde, desde + TAM - 1)
      if (!data || data.length === 0) break
      data.forEach(c => { if (c.municipio && c.municipio.trim()) muniSet.add(c.municipio.trim()) })
      if (data.length < TAM) break
      desde += TAM
    }
    setMunicipios([...muniSet].sort())
    setLoading(false)
  }

  // Agregar todos los clientes de un municipio a esta ruta
  async function agregarMunicipio() {
    if (!muniSel) { setError("Elige un municipio para agregar"); return }
    if (!confirm(`Esto moverá TODOS los clientes de "${muniSel}" a la ruta "${ruta.nombre}". Si estaban en otra ruta, saldrán de ella. ¿Continuar?`)) return
    setTrabajando(true); setError(""); setMsg("")
    const { count, error: err } = await supabase.from("clientes")
      .update({ ruta_id: ruta.id }, { count: "exact" }).eq("municipio", muniSel)
    setTrabajando(false)
    if (err) { setError("No se pudo agregar el municipio: " + err.message); return }
    setMuniSel("")
    setMsg(`✓ ${count || 0} cliente(s) de ${muniSel} agregados a la ruta.`)
    cargar(); onCambio()
  }

  // Buscar clientes para agregar sueltos (que no esten ya en esta ruta)
  async function buscarClientes(q: string) {
    setBuscar(q)
    if (q.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    const term = q.trim().replace(/[%,]/g, "")
    const { data } = await supabase
      .from("clientes").select("id, codigo, nombre, razon_social, direccion, municipio, ruta_id, ruta:rutas(nombre)")
      .or(`nombre.ilike.%${term}%,codigo.ilike.%${term}%,razon_social.ilike.%${term}%,municipio.ilike.%${term}%`)
      .order("nombre")
      .limit(100)
    setResultados((data || []) as ClienteRuta[])
    setBuscando(false)
  }

  async function agregarCliente(c: ClienteRuta) {
    setTrabajando(true); setError(""); setMsg("")
    const { error: err } = await supabase.from("clientes").update({ ruta_id: ruta.id }).eq("id", c.id)
    setTrabajando(false)
    if (err) { setError("No se pudo agregar el cliente: " + err.message); return }
    setResultados(prev => prev.filter(x => x.id !== c.id))
    setMsg(`✓ ${c.nombre} agregado a la ruta.`)
    cargar(); onCambio()
  }

  async function quitarCliente(c: ClienteRuta) {
    if (!confirm(`¿Quitar a "${c.nombre}" de la ruta "${ruta.nombre}"? Quedará sin ruta hasta que lo reasignes.`)) return
    setTrabajando(true); setError(""); setMsg("")
    const { error: err } = await supabase.from("clientes").update({ ruta_id: null }).eq("id", c.id)
    setTrabajando(false)
    if (err) { setError("No se pudo quitar el cliente: " + err.message); return }
    setClientes(prev => prev.filter(x => x.id !== c.id))
    setMsg(`✓ ${c.nombre} quitado de la ruta.`)
    onCambio()
  }

  const inp = { background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const }
  const lbl = { display: "block", fontSize: "11px", fontWeight: "bold" as const, color: theme.muted, textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: "6px" }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ background: theme.card, border: `1px solid ${theme.border}`, padding: "22px", maxWidth: "620px", width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
          <div>
            <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 2px", color: theme.text }}>Clientes de la ruta: {ruta.nombre}</h3>
            <p style={{ fontSize: "12px", color: theme.muted, margin: 0 }}>{clientes.length} cliente(s) en esta ruta</p>
          </div>
          <button onClick={onClose} style={{ background: theme.cardAlt, border: `1px solid ${theme.border}`, borderRadius: "8px", width: "32px", height: "32px", cursor: "pointer", color: theme.text, fontSize: "16px" }}>✕</button>
        </div>

        {msg && <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", borderRadius: "8px", padding: "9px 13px", fontSize: "13px", marginBottom: "12px" }}>{msg}</div>}
        {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "9px 13px", fontSize: "13px", marginBottom: "12px" }}>{error}</div>}

        {/* Agregar municipio completo */}
        <div style={{ background: theme.cardAlt, borderRadius: "10px", padding: "14px", marginBottom: "12px" }}>
          <label style={lbl}>Agregar un municipio completo</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <select value={muniSel} onChange={e => setMuniSel(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">Elige un municipio...</option>
              {municipios.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={agregarMunicipio} disabled={trabajando || !muniSel} style={{ padding: "9px 16px", background: "#3b82f6", color: "white", fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: "none", cursor: "pointer", whiteSpace: "nowrap", opacity: (trabajando || !muniSel) ? 0.6 : 1 }}>Agregar</button>
          </div>
        </div>

        {/* Agregar cliente suelto */}
        <div style={{ background: theme.cardAlt, borderRadius: "10px", padding: "14px", marginBottom: "16px" }}>
          <label style={lbl}>Agregar un cliente suelto</label>
          <input value={buscar} onChange={e => buscarClientes(e.target.value)} placeholder="Buscar por nombre, código o municipio..." style={inp} />
          {buscando && <p style={{ fontSize: "12px", color: theme.muted, margin: "8px 0 0" }}>Buscando...</p>}
          {resultados.length > 0 && (
            <div style={{ marginTop: "8px", border: `1px solid ${theme.border}`, borderRadius: "8px", maxHeight: "180px", overflowY: "auto" }}>
              {resultados.map(c => {
                const rActual = nombreRuta(c)
                const yaAqui = c.ruta_id === ruta.id
                return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${theme.border}`, gap: "10px", background: yaAqui ? "rgba(34,197,94,0.06)" : "transparent" }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: "13px", fontWeight: 600, color: theme.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</p>
                    {c.razon_social && <p style={{ fontSize: "11px", color: theme.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.razon_social}</p>}
                    <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>{c.codigo} · {c.municipio}</p>
                    <p style={{ fontSize: "11px", margin: "2px 0 0", fontWeight: 600, color: yaAqui ? "#16a34a" : (rActual ? "#d97706" : "#16a34a") }}>
                      {yaAqui ? "Ya está en esta ruta" : (rActual ? `Ruta actual: ${rActual}` : "Sin ruta asignada")}
                    </p>
                  </div>
                  {yaAqui ? (
                    <span style={{ padding: "5px 12px", background: "rgba(34,197,94,0.12)", color: "#16a34a", fontSize: "12px", fontWeight: 600, borderRadius: "6px", whiteSpace: "nowrap", flexShrink: 0 }}>Aquí</span>
                  ) : (
                    <button onClick={() => agregarCliente(c)} disabled={trabajando} style={{ padding: "5px 12px", background: "rgba(34,197,94,0.12)", color: "#16a34a", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{rActual ? "Mover aquí" : "Agregar"}</button>
                  )}
                </div>
                )
              })}
            </div>
          )}
          {buscar.trim().length >= 2 && !buscando && resultados.length === 0 && (
            <p style={{ fontSize: "12px", color: theme.muted, margin: "8px 0 0" }}>No se encontraron clientes para agregar.</p>
          )}
        </div>

        {/* Lista de clientes actuales */}
        <label style={lbl}>Clientes actuales en esta ruta</label>
        {loading ? (
          <p style={{ textAlign: "center", color: theme.muted, padding: "20px", fontSize: "13px" }}>Cargando...</p>
        ) : clientes.length === 0 ? (
          <p style={{ textAlign: "center", color: theme.muted, padding: "20px", fontSize: "13px" }}>Esta ruta aún no tiene clientes. Agrégalos arriba.</p>
        ) : (
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: "8px", maxHeight: "240px", overflowY: "auto" }}>
            {clientes.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${theme.border}` }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: theme.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nombre}</p>
                  {c.razon_social && <p style={{ fontSize: "11px", color: theme.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.razon_social}</p>}
                  <p style={{ fontSize: "11px", color: theme.muted, margin: 0 }}>{c.codigo} · {c.municipio}{c.direccion ? " · " + c.direccion : ""}</p>
                </div>
                <button onClick={() => quitarCliente(c)} disabled={trabajando} style={{ padding: "5px 12px", background: "rgba(215,38,56,0.1)", color: "#D72638", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}>Quitar</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={onClose} style={{ marginTop: "16px", width: "100%", padding: "11px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cerrar</button>
      </div>
    </div>
  )
}
