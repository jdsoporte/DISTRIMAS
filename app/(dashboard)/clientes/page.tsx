"use client"
import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { Cliente } from "@/lib/types"
import { useTheme } from "@/lib/theme-context"
import * as XLSX from "xlsx"

const EMPTY: Partial<Cliente> = { codigo: "", nit: "", nombre: "", razon_social: "", municipio: "", barrio: "", direccion: "", telefono: "", activo: true }

export default function ClientesPage() {
  const theme = useTheme()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [buscar, setBuscar] = useState("")
  const [importando, setImportando] = useState(false)
  const [msgImport, setMsgImport] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const TAM = 1000
    let desde = 0
    let todos: Cliente[] = []
    while (true) {
      const { data, error } = await supabase
        .from("clientes").select("*").order("nombre")
        .range(desde, desde + TAM - 1)
      if (error || !data || data.length === 0) break
      todos = todos.concat(data)
      if (data.length < TAM) break
      desde += TAM
    }
    setClientes(todos)
    setLoading(false)
  }

  function abrir(c?: Cliente) {
    setError("")
    setEditando(c ? c.id : null)
    setForm(c ? { codigo: c.codigo, nit: c.nit, nombre: c.nombre, razon_social: c.razon_social, municipio: c.municipio, barrio: c.barrio, direccion: c.direccion, telefono: c.telefono, activo: c.activo } : { ...EMPTY })
    setModal(true)
  }

  function cerrar() { setModal(false); setEditando(null); setError("") }

  async function guardar() {
    if (!form.nombre?.trim()) return setError("El nombre es requerido")
    if (!form.codigo?.trim()) return setError("El código es requerido")
    setSaving(true); setError("")
    const { error: err } = editando
      ? await supabase.from("clientes").update(form).eq("id", editando)
      : await supabase.from("clientes").insert(form)
    setSaving(false)
    if (err) return setError(err.message)
    cerrar(); load()
  }

  async function toggleActivo(c: Cliente) {
    await supabase.from("clientes").update({ activo: !c.activo }).eq("id", c.id)
    load()
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true); setMsgImport("")
    const data = await file.arrayBuffer()
    const wb = XLSX.read(data)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws)
    const val = (r: Record<string, string>, ...keys: string[]) => {
      for (const k of keys) {
        const found = Object.keys(r).find(c => c.trim().toLowerCase() === k.toLowerCase())
        if (found && String(r[found]).trim()) return String(r[found]).trim()
      }
      return ""
    }
    const registros = rows.map(r => {
      const tel = val(r, "TELEFON", "TELEFONO", "telefono")
      const cel = val(r, "CELULAR", "celular")
      return {
        codigo: val(r, "CODIGI", "CODIGO", "codigo"),
        nit: val(r, "NIT_CC", "NIT", "nit"),
        nombre: val(r, "NOMBRE_CLIENTE", "NOMBRE", "nombre"),
        razon_social: val(r, "RAZON_SOCIAL", "razon_social"),
        municipio: val(r, "CIUDAD", "MUNICIPIO", "municipio"),
        barrio: val(r, "BARRIO", "barrio"),
        direccion: val(r, "DIRECCION", "direccion"),
        telefono: [tel, cel].filter(Boolean).join(" / "),
        activo: true,
      }
    }).filter(r => (r.nombre || r.razon_social) && r.codigo)
    if (registros.length === 0) { setMsgImport("No se encontraron registros válidos."); setImportando(false); return }
    const { error: err } = await supabase.from("clientes").upsert(registros, { onConflict: "codigo" })
    setImportando(false)
    if (err) { setMsgImport("Error: " + err.message); return }
    setMsgImport(`✓ ${registros.length} clientes importados`)
    load()
    if (fileRef.current) fileRef.current.value = ""
  }

  function exportarExcel() {
    const datos = clientes.map(c => ({ Codigo: c.codigo, NIT_CC: c.nit, Nombre: c.nombre, Razon_social: c.razon_social, Municipio: c.municipio, Barrio: c.barrio, Direccion: c.direccion, Telefono: c.telefono, Activo: c.activo ? "Sí" : "No" }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Clientes")
    XLSX.writeFile(wb, "clientes_distrimas.xlsx")
  }

  function descargarPlantilla() {
    const ejemplo = [{ Codigo: "8214", NIT_CC: "1007758571", Nombre: "ANA VERONICA LOPEZ DUQUE", Razon_social: "FANTASIAS VMAJO", Municipio: "MEDELLIN", Barrio: "EL HUECO", Direccion: "CR 46 # 49 67", Telefono: "3104167730" }]
    const ws = XLSX.utils.json_to_sheet(ejemplo)
    ws["!cols"] = [{ wch: 10 }, { wch: 14 }, { wch: 30 }, { wch: 26 }, { wch: 16 }, { wch: 18 }, { wch: 32 }, { wch: 16 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Clientes")
    XLSX.writeFile(wb, "plantilla_clientes.xlsx")
  }

  const filtrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    (c.razon_social || "").toLowerCase().includes(buscar.toLowerCase()) ||
    c.codigo.toLowerCase().includes(buscar.toLowerCase()) ||
    (c.nit || "").toLowerCase().includes(buscar.toLowerCase()) ||
    c.municipio.toLowerCase().includes(buscar.toLowerCase())
  )

  const f = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const inp = { background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const }
  const lbl = { display: "block", fontSize: "11px", fontWeight: "bold" as const, color: theme.muted, textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: "6px" }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Clientes</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>{clientes.filter(c => c.activo).length} activos de {clientes.length} total</p>
        </div>
        <div className="page-header-btns">
          <button onClick={exportarExcel} style={{ padding: "10px 16px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>
            Exportar Excel
          </button>
          <button onClick={descargarPlantilla} style={{ padding: "10px 16px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>
            Descargar plantilla
          </button>
          <label style={{ padding: "10px 16px", background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 600, fontSize: "13px", borderRadius: "8px", border: "none", cursor: "pointer", display: "inline-block" }}>
            {importando ? "Importando..." : "Importar Excel"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importarExcel} style={{ display: "none" }} />
          </label>
          <button onClick={() => abrir()} style={{ padding: "10px 20px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
            + Nuevo cliente
          </button>
        </div>
      </div>

      {msgImport && (
        <div style={{ background: msgImport.startsWith("✓") ? "rgba(34,197,94,0.1)" : "rgba(215,38,56,0.1)", border: `1px solid ${msgImport.startsWith("✓") ? "rgba(34,197,94,0.25)" : "rgba(215,38,56,0.25)"}`, color: msgImport.startsWith("✓") ? "#22c55e" : "#F04455", borderRadius: "8px", padding: "10px 16px", fontSize: "13px", marginBottom: "16px" }}>
          {msgImport}
        </div>
      )}

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre, código o municipio..." style={{ ...inp, maxWidth: "340px" }} />
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div className="tabla-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {["Código", "NIT/CC", "Nombre", "Razón social", "Municipio", "Barrio", "Teléfono", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "40px", textAlign: "center", color: theme.muted }}>No hay clientes</td></tr>
              ) : filtrados.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted, fontFamily: "monospace" }}>{c.codigo}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted, fontFamily: "monospace" }}>{c.nit}</td>
                  <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 500, color: theme.text }}>{c.nombre}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{c.razon_social}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{c.municipio}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{c.barrio}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{c.telefono}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: c.activo ? "rgba(34,197,94,0.12)" : theme.cardAlt, color: c.activo ? "#22c55e" : theme.muted }}>
                      {c.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div className="acciones-wrap">
                      <button onClick={() => abrir(c)} style={{ padding: "6px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Editar</button>
                      <button onClick={() => toggleActivo(c)} style={{ padding: "6px 12px", background: c.activo ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)", color: c.activo ? "#f59e0b" : "#22c55e", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer" }}>
                        {c.activo ? "Desactivar" : "Activar"}
                      </button>
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
          <div className="modal-box" style={{ background: theme.card, border: `1px solid ${theme.border}`, padding: "24px", maxWidth: "480px" }}>
            <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 20px", color: theme.text }}>{editando ? "Editar cliente" : "Nuevo cliente"}</h3>
            {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <div style={{ display: "grid", gap: "14px" }}>
              <div className="form-grid-2">
                <div><label style={lbl}>Código</label><input style={inp} value={form.codigo} onChange={e => f("codigo", e.target.value)} placeholder="8214" /></div>
                <div><label style={lbl}>NIT / CC</label><input style={inp} value={form.nit} onChange={e => f("nit", e.target.value)} placeholder="1007758571" /></div>
              </div>
              <div><label style={lbl}>Nombre</label><input style={inp} value={form.nombre} onChange={e => f("nombre", e.target.value)} placeholder="Ana Veronica Lopez" /></div>
              <div><label style={lbl}>Razón social</label><input style={inp} value={form.razon_social} onChange={e => f("razon_social", e.target.value)} placeholder="Fantasias VMAJO" /></div>
              <div className="form-grid-2">
                <div><label style={lbl}>Municipio</label><input style={inp} value={form.municipio} onChange={e => f("municipio", e.target.value)} placeholder="Medellin" /></div>
                <div><label style={lbl}>Barrio</label><input style={inp} value={form.barrio} onChange={e => f("barrio", e.target.value)} placeholder="El Hueco" /></div>
              </div>
              <div><label style={lbl}>Dirección</label><input style={inp} value={form.direccion} onChange={e => f("direccion", e.target.value)} placeholder="CR 46 # 49 67" /></div>
              <div><label style={lbl}>Teléfono</label><input style={inp} value={form.telefono} onChange={e => f("telefono", e.target.value)} placeholder="3104167730" /></div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer", color: theme.text }}>
                <input type="checkbox" checked={form.activo} onChange={e => f("activo", e.target.checked)} /> Activo
              </label>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button onClick={cerrar} style={{ flex: 1, padding: "11px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ flex: 1, padding: "11px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
