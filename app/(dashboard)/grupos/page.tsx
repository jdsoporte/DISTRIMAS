"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useTheme } from "@/lib/theme-context"

interface Grupo { codigo: string; nombre: string }

export default function GruposPage() {
  const theme = useTheme()
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [loading, setLoading] = useState(true)
  const [buscar, setBuscar] = useState("")
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ codigo: "", nombre: "" })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from("grupos").select("codigo, nombre").order("nombre")
    setGrupos(data || [])
    setLoading(false)
  }

  function abrirNuevo() {
    setEditando(null)
    setForm({ codigo: "", nombre: "" })
    setError("")
    setModal(true)
  }

  function abrirEditar(g: Grupo) {
    setEditando(g.codigo)
    setForm({ codigo: g.codigo, nombre: g.nombre })
    setError("")
    setModal(true)
  }

  async function guardar() {
    const codigo = form.codigo.trim()
    const nombre = form.nombre.trim()
    if (!codigo) return setError("Escribe el código del grupo.")
    if (!nombre) return setError("Escribe el nombre del grupo.")
    setSaving(true); setError("")

    if (editando) {
      const { error: err } = await supabase.from("grupos").update({ nombre }).eq("codigo", editando)
      if (err) { setSaving(false); return setError("No se pudo guardar: " + err.message) }
    } else {
      const { error: err } = await supabase.from("grupos").insert({ codigo, nombre })
      if (err) {
        setSaving(false)
        if (err.code === "23505" || /duplicate|unique/i.test(err.message)) return setError("Ya existe un grupo con ese código.")
        return setError("No se pudo guardar: " + err.message)
      }
    }
    setSaving(false)
    setModal(false)
    await load()
  }

  async function eliminar(g: Grupo) {
    if (!confirm(`¿Eliminar el grupo "${g.nombre}" (${g.codigo})?\n\nEsto no borra los productos, solo el nombre del grupo. Los productos con ese código seguirán mostrando el número hasta que lo vuelvas a crear.`)) return
    const { error: err } = await supabase.from("grupos").delete().eq("codigo", g.codigo)
    if (err) { alert("No se pudo eliminar: " + err.message); return }
    await load()
  }

  const q = buscar.trim().toLowerCase()
  const filtrados = q ? grupos.filter(g => g.nombre.toLowerCase().includes(q) || g.codigo.toLowerCase().includes(q)) : grupos

  const inp = { background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const }
  const lbl = { display: "block", fontSize: "11px", fontWeight: "bold" as const, color: theme.muted, textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: "6px" }

  return (
    <div>
      <div className="page-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Grupos / Proveedores</h2>
          <p style={{ fontSize: "13px", color: theme.muted, margin: 0 }}>{grupos.length} grupo(s). El código es el que se enlaza con los productos.</p>
        </div>
        <button onClick={abrirNuevo} style={{ padding: "10px 18px", background: "#D72638", color: "white", fontWeight: 700, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer" }}>+ Nuevo grupo</button>
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre o código..." style={{ ...inp, maxWidth: "340px" }} />
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div className="tabla-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: theme.cardAlt }}>
                <th style={{ textAlign: "left", padding: "11px 14px", color: theme.muted, fontWeight: 700 }}>Código</th>
                <th style={{ textAlign: "left", padding: "11px 14px", color: theme.muted, fontWeight: 700 }}>Nombre del grupo / proveedor</th>
                <th style={{ textAlign: "right", padding: "11px 14px", color: theme.muted, fontWeight: 700 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={{ padding: "30px", textAlign: "center", color: theme.muted }}>Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: "30px", textAlign: "center", color: theme.muted }}>{grupos.length === 0 ? "No hay grupos. Crea el primero con \"Nuevo grupo\"." : "No se encontró ningún grupo."}</td></tr>
              ) : filtrados.map(g => (
                <tr key={g.codigo} style={{ borderTop: `1px solid ${theme.border}` }}>
                  <td style={{ padding: "11px 14px", color: "#D72638", fontWeight: 700 }}>{g.codigo}</td>
                  <td style={{ padding: "11px 14px", color: theme.text, fontWeight: 600 }}>{g.nombre}</td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button onClick={() => abrirEditar(g)} style={{ padding: "5px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Editar</button>
                      <button onClick={() => eliminar(g)} style={{ padding: "5px 12px", background: "rgba(215,38,56,0.1)", color: "#D72638", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "none", cursor: "pointer" }}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal crear / editar */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
          <div style={{ background: theme.card, borderRadius: "14px", padding: "22px", maxWidth: "420px", width: "100%", border: `1px solid ${theme.border}` }}>
            <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 16px", color: theme.text }}>{editando ? "Editar grupo" : "Nuevo grupo"}</h3>

            {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.3)", color: "#D72638", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", marginBottom: "14px" }}>{error}</div>}

            <div style={{ marginBottom: "14px" }}>
              <label style={lbl}>Código</label>
              <input
                style={{ ...inp, opacity: editando ? 0.6 : 1 }}
                value={form.codigo}
                disabled={!!editando}
                onChange={e => setForm({ ...form, codigo: e.target.value })}
                placeholder="034"
              />
              {editando && <p style={{ fontSize: "11px", color: theme.muted, margin: "5px 0 0" }}>El código no se puede cambiar porque está enlazado con los productos.</p>}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={lbl}>Nombre del grupo / proveedor</label>
              <input style={inp} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="SUPER-GOLOSINA" autoFocus />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setModal(false)} style={{ flex: 1, padding: "11px", background: theme.cardAlt, color: theme.text, fontWeight: 700, fontSize: "14px", borderRadius: "9px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ flex: 1, padding: "11px", background: "#D72638", color: "white", fontWeight: 700, fontSize: "14px", borderRadius: "9px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "Guardando..." : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
