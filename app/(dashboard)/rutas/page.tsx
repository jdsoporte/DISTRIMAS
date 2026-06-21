"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Ruta } from "@/lib/types"
import { useTheme } from "@/lib/theme-context"
import GestionClientesRuta from "@/components/GestionClientesRuta"

const EMPTY: Partial<Ruta> = { nombre: "", descripcion: "", activo: true }

export default function RutasPage() {
  const theme = useTheme()
  const [rutas, setRutas] = useState<Ruta[]>([])
  const [conteos, setConteos] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [buscar, setBuscar] = useState("")
  const [generando, setGenerando] = useState(false)
  const [msg, setMsg] = useState("")
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [modalAgrupar, setModalAgrupar] = useState(false)
  const [nombreGrupo, setNombreGrupo] = useState("")
  const [rutaClientes, setRutaClientes] = useState<Ruta | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("rutas").select("*").order("nombre")
    setRutas(data || [])
    // Contar cuantos clientes tiene cada ruta
    const mapa: Record<string, number> = {}
    for (const r of data || []) {
      const { count } = await supabase
        .from("clientes").select("id", { count: "exact", head: true }).eq("ruta_id", r.id)
      mapa[r.id] = count || 0
    }
    setConteos(mapa)
    setLoading(false)
  }

  function abrir(r?: Ruta) {
    setError("")
    setEditando(r ? r.id : null)
    setForm(r ? { nombre: r.nombre, descripcion: r.descripcion, activo: r.activo } : { ...EMPTY })
    setModal(true)
  }

  function cerrar() { setModal(false); setEditando(null); setError("") }

  async function guardar() {
    if (!form.nombre?.trim()) return setError("El nombre de la ruta es requerido")
    const nombreLimpio = form.nombre.trim()
    // Evitar nombres duplicados (ignorando mayúsculas y la propia ruta al editar)
    const duplicada = rutas.find(r => r.nombre.trim().toLowerCase() === nombreLimpio.toLowerCase() && r.id !== editando)
    if (duplicada) return setError(`Ya existe una ruta llamada "${duplicada.nombre}". Usa otro nombre.`)
    setSaving(true); setError("")
    const { error: err } = editando
      ? await supabase.from("rutas").update({ ...form, nombre: nombreLimpio }).eq("id", editando)
      : await supabase.from("rutas").insert({ ...form, nombre: nombreLimpio })
    setSaving(false)
    if (err) return setError("No se pudo guardar: " + err.message)
    cerrar(); load()
  }

  async function toggleActivo(r: Ruta) {
    await supabase.from("rutas").update({ activo: !r.activo }).eq("id", r.id)
    load()
  }

  async function eliminar(r: Ruta) {
    const n = conteos[r.id] || 0
    if (n > 0) {
      alert(`No se puede eliminar: la ruta "${r.nombre}" tiene ${n} cliente(s) asignado(s). Primero reasigna esos clientes a otra ruta.`)
      return
    }
    if (!confirm(`¿Eliminar la ruta "${r.nombre}"?`)) return
    await supabase.from("rutas").delete().eq("id", r.id)
    load()
  }

  // Crea una ruta por cada municipio distinto de los clientes y asigna cada cliente a la suya
  async function autoGenerar() {
    if (!confirm("Esto creará una ruta por cada municipio de tus clientes y asignará cada cliente a su ruta. ¿Continuar?")) return
    setGenerando(true); setMsg(""); setError("")

    try {
      // 1. Traer municipios distintos (paginado)
      const muniSet = new Set<string>()
      let sinMunicipio = 0
      let desde = 0; const TAM = 1000
      while (true) {
        const { data, error: errSel } = await supabase.from("clientes").select("municipio").range(desde, desde + TAM - 1)
        if (errSel) { setGenerando(false); setMsg(""); setError("No se pudieron leer los clientes: " + errSel.message); return }
        if (!data || data.length === 0) break
        data.forEach(c => { if (c.municipio && c.municipio.trim()) muniSet.add(c.municipio.trim()); else sinMunicipio++ })
        if (data.length < TAM) break
        desde += TAM
      }

      // Validación: no hay municipios
      if (muniSet.size === 0) {
        setGenerando(false)
        setError("Ningún cliente tiene municipio asignado, así que no hay con qué crear rutas. Revisa que tus clientes tengan el municipio lleno.")
        return
      }

      // 2. Rutas existentes (para no duplicar)
      const { data: existRutas } = await supabase.from("rutas").select("*")
      const porNombre = new Map<string, Ruta>((existRutas || []).map(r => [r.nombre.trim().toLowerCase(), r]))

      // 3. Crear las rutas que falten
      let creadas = 0
      for (const muni of muniSet) {
        if (!porNombre.has(muni.toLowerCase())) {
          const { data: nueva, error: errIns } = await supabase.from("rutas").insert({ nombre: muni, activo: true }).select().single()
          if (errIns) { setGenerando(false); setMsg(""); setError(`Error creando la ruta "${muni}": ${errIns.message}`); return }
          if (nueva) { porNombre.set(muni.toLowerCase(), nueva); creadas++ }
        }
      }

      // 4. Asignar clientes a su ruta (un update por municipio, no cliente por cliente)
      let asignados = 0
      for (const muni of muniSet) {
        const ruta = porNombre.get(muni.toLowerCase())
        if (ruta) {
          const { count } = await supabase.from("clientes")
            .update({ ruta_id: ruta.id }, { count: "exact" }).eq("municipio", muni)
          asignados += count || 0
        }
      }

      setGenerando(false)
      const aviso = sinMunicipio > 0 ? ` (${sinMunicipio} cliente(s) sin municipio quedaron sin ruta)` : ""
      setMsg(`✓ Listo: ${creadas} ruta(s) nueva(s) y ${asignados} cliente(s) asignado(s)${aviso}.`)
      load()
    } catch (e) {
      setGenerando(false)
      setError("Ocurrió un error inesperado al generar las rutas. Vuelve a intentar.")
    }
  }

  function toggleSel(id: string) {
    setSeleccion(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function abrirAgrupar() {
    if (seleccion.size < 2) { alert("Selecciona al menos 2 rutas para agruparlas."); return }
    setNombreGrupo("")
    setModalAgrupar(true)
  }

  // Une las rutas seleccionadas en una sola: mueve sus clientes y elimina las sobrantes
  async function agrupar() {
    const nombre = nombreGrupo.trim()
    if (!nombre) { setError("Escribe el nombre de la ruta agrupada"); return }
    const ids = [...seleccion]
    if (ids.length < 2) { setError("Selecciona al menos 2 rutas para agrupar"); return }
    // Evitar que el nombre choque con otra ruta que NO esté en el grupo
    const choca = rutas.find(r => r.nombre.trim().toLowerCase() === nombre.toLowerCase() && !seleccion.has(r.id))
    if (choca) { setError(`Ya existe otra ruta llamada "${choca.nombre}" fuera del grupo. Usa otro nombre.`); return }

    setSaving(true); setError("")
    try {
      const destinoId = ids[0]
      const sobrantes = ids.slice(1)
      const { error: errN } = await supabase.from("rutas").update({ nombre }).eq("id", destinoId)
      if (errN) { setSaving(false); setError("No se pudo renombrar la ruta: " + errN.message); return }
      // Mover clientes de las sobrantes a la ruta destino
      for (const sid of sobrantes) {
        const { error: errM } = await supabase.from("clientes").update({ ruta_id: destinoId }).eq("ruta_id", sid)
        if (errM) { setSaving(false); setError("No se pudieron mover los clientes: " + errM.message); return }
      }
      // Eliminar las rutas sobrantes (ya quedaron sin clientes)
      for (const sid of sobrantes) {
        await supabase.from("rutas").delete().eq("id", sid)
      }
      setSaving(false)
      setModalAgrupar(false)
      setSeleccion(new Set())
      setMsg(`✓ ${ids.length} rutas agrupadas en "${nombre}".`)
      load()
    } catch (e) {
      setSaving(false)
      setError("Ocurrió un error al agrupar. Vuelve a intentar.")
    }
  }

  const filtradas = rutas.filter(r => r.nombre.toLowerCase().includes(buscar.toLowerCase()))

  const f = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const inp = { background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const }
  const lbl = { display: "block", fontSize: "11px", fontWeight: "bold" as const, color: theme.muted, textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: "6px" }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Rutas</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>{rutas.filter(r => r.activo).length} activas de {rutas.length} total</p>
        </div>
        <div className="page-header-btns">
          <button onClick={autoGenerar} disabled={generando} style={{ padding: "10px 16px", background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: generando ? 0.6 : 1 }}>
            {generando ? "Generando..." : "Generar por municipio"}
          </button>
          {seleccion.size >= 2 && (
            <button onClick={abrirAgrupar} style={{ padding: "10px 16px", background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
              Agrupar ({seleccion.size})
            </button>
          )}
          <button onClick={() => abrir()} style={{ padding: "10px 20px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
            + Nueva ruta
          </button>
        </div>
      </div>

      {msg && (
        <div style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e", borderRadius: "8px", padding: "10px 16px", fontSize: "13px", marginBottom: "16px" }}>
          {msg}
        </div>
      )}

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar ruta..." style={{ ...inp, maxWidth: "340px" }} />
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div className="tabla-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {["", "Ruta", "Descripción", "Clientes", "Estado", "Acciones"].map((h, i) => (
                  <th key={i} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>Cargando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>No hay rutas. Crea la primera con el botón "Nueva ruta".</td></tr>
              ) : filtradas.map(r => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: "12px 16px" }}>
                    <input type="checkbox" checked={seleccion.has(r.id)} onChange={() => toggleSel(r.id)} style={{ cursor: "pointer" }} />
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 600, color: theme.text }}>{r.nombre}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{r.descripcion}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.text }}>
                    <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: theme.cardAlt, color: theme.muted }}>
                      {conteos[r.id] ?? 0}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: r.activo ? "rgba(34,197,94,0.12)" : theme.cardAlt, color: r.activo ? "#22c55e" : theme.muted }}>
                      {r.activo ? "Activa" : "Inactiva"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div className="acciones-wrap">
                      <button onClick={() => setRutaClientes(r)} style={{ padding: "6px 12px", background: "rgba(59,130,246,0.12)", color: "#3b82f6", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "none", cursor: "pointer" }}>Clientes</button>
                      <button onClick={() => abrir(r)} style={{ padding: "6px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Editar</button>
                      <button onClick={() => toggleActivo(r)} style={{ padding: "6px 12px", background: r.activo ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)", color: r.activo ? "#f59e0b" : "#22c55e", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer" }}>
                        {r.activo ? "Desactivar" : "Activar"}
                      </button>
                      <button onClick={() => eliminar(r)} style={{ padding: "6px 12px", background: "rgba(215,38,56,0.1)", color: "#D72638", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer" }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ background: theme.card, border: `1px solid ${theme.border}`, padding: "24px", maxWidth: "460px" }}>
            <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 20px", color: theme.text }}>{editando ? "Editar ruta" : "Nueva ruta"}</h3>
            {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <div style={{ display: "grid", gap: "14px" }}>
              <div><label style={lbl}>Nombre de la ruta</label><input style={inp} value={form.nombre} onChange={e => f("nombre", e.target.value)} placeholder="Tierralta 1" /></div>
              <div><label style={lbl}>Descripción (opcional)</label><input style={inp} value={form.descripcion} onChange={e => f("descripcion", e.target.value)} placeholder="Zona centro y alrededores" /></div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer", color: theme.text }}>
                <input type="checkbox" checked={form.activo} onChange={e => f("activo", e.target.checked)} /> Activa
              </label>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button onClick={cerrar} style={{ flex: 1, padding: "11px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ flex: 1, padding: "11px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear ruta"}
              </button>
            </div>
          </div>
        </div>
      )}
      {modalAgrupar && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ background: theme.card, border: `1px solid ${theme.border}`, padding: "24px", maxWidth: "460px" }}>
            <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 8px", color: theme.text }}>Agrupar {seleccion.size} rutas</h3>
            <p style={{ fontSize: "13px", color: theme.muted, margin: "0 0 18px" }}>
              Los clientes de las rutas seleccionadas pasarán a una sola ruta con el nombre que escribas. Las rutas sobrantes se eliminarán.
            </p>
            {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <div><label style={lbl}>Nombre de la ruta agrupada</label><input style={inp} value={nombreGrupo} onChange={e => setNombreGrupo(e.target.value)} placeholder="Ruta Ciénaga de Oro" autoFocus /></div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button onClick={() => { setModalAgrupar(false); setError("") }} style={{ flex: 1, padding: "11px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cancelar</button>
              <button onClick={agrupar} disabled={saving} style={{ flex: 1, padding: "11px", background: "#3b82f6", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Agrupando..." : "Agrupar"}
              </button>
            </div>
          </div>
        </div>
      )}
      {rutaClientes && (
        <GestionClientesRuta
          ruta={rutaClientes}
          onClose={() => setRutaClientes(null)}
          onCambio={load}
        />
      )}
    </div>
  )
}
