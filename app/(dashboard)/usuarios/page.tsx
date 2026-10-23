"use client"
import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { USUARIO_SELECT } from "@/lib/auth"
import { Usuario, Perfil } from "@/lib/types"
import { useTheme } from "@/lib/theme-context"

const EMPTY: Partial<Usuario> & { password_hash: string } = {
  nombre: "", documento: "", telefono: "", usuario: "", password_hash: "", perfil_id: "", activo: true, primer_ingreso: true
}

function getFortaleza(pass: string) {
  const checks = {
    longitud: pass.length >= 8,
    mayuscula: /[A-Z]/.test(pass),
    minuscula: /[a-z]/.test(pass),
    numero: /[0-9]/.test(pass),
    especial: /[^A-Za-z0-9]/.test(pass),
  }
  const score = Object.values(checks).filter(Boolean).length
  const nivel = score <= 2 ? "Débil" : score === 3 ? "Regular" : score === 4 ? "Buena" : "Fuerte"
  const color = score <= 2 ? "#F04455" : score === 3 ? "#f59e0b" : score === 4 ? "#60a5fa" : "#22c55e"
  return { checks, score, nivel, color }
}

export default function UsuariosPage() {
  const theme = useTheme()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [perfiles, setPerfiles] = useState<Perfil[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [buscar, setBuscar] = useState("")
  const [verPass, setVerPass] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from("usuarios").select(USUARIO_SELECT).order("nombre"),
      supabase.from("perfiles").select("*").order("nombre"),
    ])
    setUsuarios(u || [])
    setPerfiles(p || [])
    setLoading(false)
  }

  function abrir(u?: Usuario) {
    setError("")
    if (u) {
      setEditando(u.id)
      setForm({ nombre: u.nombre, documento: u.documento, telefono: u.telefono, usuario: u.usuario, password_hash: "", perfil_id: u.perfil_id, activo: u.activo, primer_ingreso: u.primer_ingreso })
    } else {
      setEditando(null)
      setForm({ ...EMPTY })
    }
    setModal(true)
  }

  function cerrar() { setModal(false); setEditando(null); setForm({ ...EMPTY }); setError("") }

  async function guardar() {
    if (!form.nombre?.trim()) return setError("El nombre es requerido")
    if (!form.documento?.trim()) return setError("El documento es requerido")
    if (!form.usuario?.trim()) return setError("El usuario es requerido")
    if (!form.perfil_id) return setError("Selecciona un perfil")
    if (!editando && !form.password_hash?.trim()) return setError("La contrasena es requerida")
    setSaving(true)
    setError("")
    const payload: Record<string, unknown> = {
      nombre: form.nombre, documento: form.documento, telefono: form.telefono,
      usuario: form.usuario, perfil_id: form.perfil_id, activo: form.activo, primer_ingreso: form.primer_ingreso
    }
    if (form.password_hash?.trim()) payload.password_hash = form.password_hash
    let err
    if (editando) {
      const r = await supabase.from("usuarios").update(payload).eq("id", editando)
      err = r.error
    } else {
      const r = await supabase.from("usuarios").insert(payload)
      err = r.error
    }
    setSaving(false)
    if (err) return setError(err.message)
    cerrar(); load()
  }

  async function toggleActivo(u: Usuario) {
    await supabase.from("usuarios").update({ activo: !u.activo }).eq("id", u.id)
    load()
  }

  const filtrados = usuarios.filter(u =>
    u.nombre.toLowerCase().includes(buscar.toLowerCase()) ||
    u.usuario.toLowerCase().includes(buscar.toLowerCase()) ||
    u.documento.includes(buscar)
  )

  const f = (k: string, v: unknown) => setForm(p => ({ ...p, [k]: v }))
  const inp = { background: theme.cardAlt, border: `1.5px solid ${theme.border}`, borderRadius: "8px", color: theme.text, fontSize: "14px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const }
  const lbl = { display: "block", fontSize: "11px", fontWeight: "bold" as const, color: theme.muted, textTransform: "uppercase" as const, letterSpacing: "0.7px", marginBottom: "6px" }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 4px", color: theme.text }}>Usuarios</h2>
          <p style={{ color: theme.muted, fontSize: "13px", margin: 0 }}>{usuarios.length} usuarios registrados</p>
        </div>
        <button onClick={() => abrir()} style={{ padding: "10px 20px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer" }}>
          + Nuevo usuario
        </button>
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", padding: "16px", marginBottom: "16px" }}>
        <input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Buscar por nombre, usuario o documento..." style={{ ...inp, maxWidth: "320px" }} />
      </div>

      <div style={{ background: theme.card, border: `1px solid ${theme.border}`, borderRadius: "12px", overflow: "hidden" }}>
        <div className="tabla-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {["Nombre", "Usuario", "Documento", "Teléfono", "Perfil", "Estado", "Acciones"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "bold", color: theme.muted, textTransform: "uppercase", letterSpacing: "0.7px", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: theme.muted, fontSize: "14px" }}>Cargando...</td></tr>
              ) : filtrados.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "40px", textAlign: "center", color: theme.muted, fontSize: "14px" }}>No hay usuarios</td></tr>
              ) : filtrados.map(u => (
                <tr key={u.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: "12px 16px", fontSize: "14px", fontWeight: 500, color: theme.text }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#D72638", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "13px", flexShrink: 0 }}>
                        {u.nombre.charAt(0).toUpperCase()}
                      </div>
                      {u.nombre}
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{u.usuario}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{u.documento}</td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: theme.muted }}>{u.telefono}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: "rgba(215,38,56,0.12)", color: "#D72638" }}>
                      {u.perfil?.nombre || "-"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ padding: "3px 10px", borderRadius: "99px", fontSize: "12px", fontWeight: 600, background: u.activo ? "rgba(34,197,94,0.12)" : theme.cardAlt, color: u.activo ? "#22c55e" : theme.muted }}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div className="acciones-wrap">
                      <button onClick={() => abrir(u)} style={{ padding: "6px 12px", background: theme.cardAlt, color: theme.text, fontSize: "12px", borderRadius: "6px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Editar</button>
                      <button onClick={() => toggleActivo(u)} style={{ padding: "6px 12px", background: u.activo ? "rgba(245,158,11,0.12)" : "rgba(34,197,94,0.12)", color: u.activo ? "#f59e0b" : "#22c55e", fontSize: "12px", borderRadius: "6px", border: "none", cursor: "pointer" }}>
                        {u.activo ? "Desactivar" : "Activar"}
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
            <h3 style={{ fontSize: "17px", fontWeight: "bold", margin: "0 0 20px", color: theme.text }}>{editando ? "Editar usuario" : "Nuevo usuario"}</h3>
            {error && <div style={{ background: "rgba(215,38,56,0.1)", border: "1px solid rgba(215,38,56,0.25)", color: "#D72638", borderRadius: "8px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>{error}</div>}
            <div style={{ display: "grid", gap: "16px" }}>
              <div><label style={lbl}>Nombre completo</label><input style={inp} value={form.nombre} onChange={e => f("nombre", e.target.value)} placeholder="Ej: Juan Perez" /></div>
              <div className="form-grid-2">
                <div><label style={lbl}>Documento</label><input style={inp} value={form.documento} onChange={e => f("documento", e.target.value)} placeholder="CC / NIT" /></div>
                <div><label style={lbl}>Teléfono</label><input style={inp} value={form.telefono} onChange={e => f("telefono", e.target.value)} placeholder="300..." /></div>
              </div>
              <div><label style={lbl}>Usuario</label><input style={inp} value={form.usuario} onChange={e => f("usuario", e.target.value)} placeholder="usuario123" /></div>
              <div>
                <label style={lbl}>{editando ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...inp, paddingRight: "44px" }}
                    type={verPass ? "text" : "password"}
                    value={form.password_hash}
                    onChange={e => f("password_hash", e.target.value)}
                    placeholder="••••••••"
                  />
                  <button type="button" onClick={() => setVerPass(v => !v)}
                    style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: theme.muted, fontSize: "16px", padding: 0 }}>
                    {verPass ? "🙈" : "👁️"}
                  </button>
                </div>
                {form.password_hash ? (() => {
                  const { checks, score, nivel, color } = getFortaleza(form.password_hash as string)
                  return (
                    <div style={{ marginTop: "10px" }}>
                      <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
                        {[1,2,3,4,5].map(i => (
                          <div key={i} style={{ flex: 1, height: "4px", borderRadius: "99px", background: i <= score ? color : theme.cardAlt, transition: "background 0.2s" }} />
                        ))}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", color, fontWeight: 600 }}>{nivel}</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {[
                          { ok: checks.longitud,   label: "8+ caracteres" },
                          { ok: checks.mayuscula,  label: "Mayúscula" },
                          { ok: checks.minuscula,  label: "Minúscula" },
                          { ok: checks.numero,     label: "Número" },
                          { ok: checks.especial,   label: "Especial (!@#...)" },
                        ].map(c => (
                          <span key={c.label} style={{ fontSize: "11px", padding: "2px 8px", borderRadius: "99px", background: c.ok ? "rgba(34,197,94,0.12)" : theme.cardAlt, color: c.ok ? "#22c55e" : theme.muted }}>
                            {c.ok ? "✓" : "✗"} {c.label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                })() : null}
              </div>
              <div>
                <label style={lbl}>Perfil</label>
                <select style={{ ...inp }} value={form.perfil_id} onChange={e => f("perfil_id", e.target.value)}>
                  <option value="">Seleccionar perfil...</option>
                  {perfiles.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", gap: "16px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer", color: theme.text }}>
                  <input type="checkbox" checked={form.activo} onChange={e => f("activo", e.target.checked)} />
                  Activo
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", cursor: "pointer", color: theme.text }}>
                  <input type="checkbox" checked={form.primer_ingreso} onChange={e => f("primer_ingreso", e.target.checked)} />
                  Primer ingreso
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
              <button onClick={cerrar} style={{ flex: 1, padding: "11px", background: theme.cardAlt, color: theme.text, fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: `1px solid ${theme.border}`, cursor: "pointer" }}>Cancelar</button>
              <button onClick={guardar} disabled={saving} style={{ flex: 1, padding: "11px", background: "#D72638", color: "white", fontWeight: 600, fontSize: "14px", borderRadius: "8px", border: "none", cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Guardando..." : editando ? "Guardar cambios" : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
