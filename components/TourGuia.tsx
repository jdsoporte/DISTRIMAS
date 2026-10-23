"use client"
import { useState } from "react"
import { supabase } from "@/lib/supabase"
import { Usuario } from "@/lib/types"

function Manito({ clickAnim }: { clickAnim: boolean }) {
  return (
    <div style={{
      fontSize: "26px", display: "inline-block",
      animation: clickAnim ? "manitoClick 0.6s ease infinite" : "manitoFloat 2s ease-in-out infinite",
      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
    }}>☝️</div>
  )
}

/* ── Ilustraciones ── */
function IluDashboard() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", marginBottom: "6px" }}>
        {[{ l: "Pedidos hoy", v: "12", c: "#D72638" }, { l: "Ventas mes", v: "$4.2M", c: "#22c55e" },
          { l: "Clientes", v: "87", c: "#3b82f6" }, { l: "Stock bajo", v: "3", c: "#f59e0b" }].map(s => (
          <div key={s.l} style={{ background: "rgba(255,255,255,0.08)", borderRadius: "7px", padding: "7px 9px", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.45)", margin: "0 0 2px" }}>{s.l}</p>
            <p style={{ fontSize: "15px", fontWeight: 800, color: s.c, margin: 0 }}>{s.v}</p>
          </div>
        ))}
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "7px", padding: "7px 8px", marginBottom: "6px" }}>
        <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", margin: "0 0 5px" }}>PEDIDOS 30 DÍAS</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "3px", height: "30px" }}>
          {[10, 6, 18, 12, 20, 8, 16, 22, 14, 18].map((h, i) => (
            <div key={i} style={{ flex: 1, background: `rgba(215,38,56,${0.35 + i * 0.065})`, borderRadius: "2px 2px 0 0", height: `${(h / 22) * 100}%` }} />
          ))}
        </div>
      </div>
      <div style={{ textAlign: "center" }}><Manito clickAnim={false} /></div>
    </div>
  )
}

function IluPedido() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "7px", padding: "7px 9px", marginBottom: "5px", border: "1px solid rgba(255,255,255,0.08)" }}>
        <p style={{ fontSize: "8px", color: "rgba(255,255,255,0.4)", margin: "0 0 3px" }}>CLIENTE</p>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: "4px", padding: "4px 7px", fontSize: "9px", color: "white" }}>Tienda El Progreso</div>
          <div style={{ background: "#D72638", borderRadius: "4px", padding: "3px 7px", fontSize: "13px", fontWeight: 800, color: "white" }}>C-042</div>
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "7px", padding: "7px 9px", marginBottom: "5px", border: "1px solid rgba(255,255,255,0.08)" }}>
        {[{ n: "Arroz Diana 5kg", q: 3 }, { n: "Aceite Palma 3L", q: 2 }].map(it => (
          <div key={it.n} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.8)" }}>{it.n}</span>
            <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
              <div style={{ background: "rgba(215,38,56,0.3)", borderRadius: "3px", padding: "1px 5px", fontSize: "10px", color: "white" }}>−</div>
              <span style={{ fontSize: "10px", fontWeight: 700, color: "white" }}>{it.q}</span>
              <div style={{ background: "rgba(215,38,56,0.3)", borderRadius: "3px", padding: "1px 5px", fontSize: "10px", color: "white" }}>+</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#D72638", borderRadius: "7px", padding: "7px", textAlign: "center", fontSize: "10px", fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
        <Manito clickAnim={true} /> ✓ Confirmar pedido
      </div>
    </div>
  )
}

function IluWhatsApp() {
  return (
    <div style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "9px", padding: "9px 11px", width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "7px" }}>
        <span style={{ fontSize: "16px" }}>💬</span>
        <div>
          <p style={{ fontSize: "9px", fontWeight: 700, color: "#25D366", margin: 0 }}>WhatsApp</p>
          <p style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)", margin: 0 }}>+57 301 653 7553</p>
        </div>
        <div style={{ marginLeft: "auto" }}><Manito clickAnim={true} /></div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: "6px", padding: "7px", fontFamily: "monospace", fontSize: "7px", color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
        <p style={{ margin: 0 }}>🏪 <b>PEDIDO - Distrimas SC</b></p>
        <p style={{ margin: 0 }}>📋 Cliente: Tienda El Progreso</p>
        <p style={{ margin: 0 }}>👤 Vendedor: Carlos R.</p>
        <p style={{ margin: 0 }}>📅 19 abr · 10:24 a.m.</p>
        <p style={{ margin: 0 }}>• Arroz Diana x3 = $54.000</p>
        <p style={{ margin: 0, color: "#25D366", fontWeight: 700 }}>💰 TOTAL: $98.000</p>
      </div>
    </div>
  )
}

function IluPedidos() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
        {["Hoy", "Esta semana", "Este mes"].map((b, i) => (
          <div key={b} style={{ padding: "3px 7px", borderRadius: "5px", fontSize: "8px", fontWeight: 600, background: i === 0 ? "#D72638" : "rgba(255,255,255,0.07)", color: i === 0 ? "white" : "rgba(255,255,255,0.5)" }}>{b}</div>
        ))}
        <div style={{ marginLeft: "auto" }}><Manito clickAnim={false} /></div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "7px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)" }}>
        {[{ c: "Tienda La Esperanza", t: "$320K", e: "confirmado", col: "#3b82f6" },
          { c: "Distribuidora Norte", t: "$185K", e: "entregado", col: "#22c55e" },
          { c: "Supermercado El Rey", t: "$540K", e: "borrador", col: "#6B7280" }].map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.75)" }}>{p.c}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "white" }}>{p.t}</span>
              <span style={{ padding: "1px 5px", borderRadius: "99px", fontSize: "7px", fontWeight: 600, background: `${p.col}22`, color: p.col }}>{p.e}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IluClientes() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "7px", padding: "5px 9px", marginBottom: "6px", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ fontSize: "10px" }}>🔍</span>
        <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.35)" }}>Buscar por nombre o código...</span>
      </div>
      {[{ cod: "001", n: "Tienda El Progreso", m: "Montería" },
        { cod: "042", n: "Distribuidora Norte", m: "Cereté" },
        { cod: "078", n: "Supermercado El Rey", m: "Lorica" }].map(c => (
        <div key={c.cod} style={{ display: "flex", alignItems: "center", gap: "7px", padding: "5px 7px", background: "rgba(255,255,255,0.04)", borderRadius: "6px", marginBottom: "4px", border: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "rgba(215,38,56,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#D72638", flexShrink: 0 }}>{c.cod}</div>
          <div>
            <p style={{ fontSize: "8px", fontWeight: 600, color: "white", margin: 0 }}>{c.n}</p>
            <p style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)", margin: 0 }}>{c.m}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function IluInventario() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "7px", padding: "5px 9px", marginBottom: "6px", display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ fontSize: "10px" }}>⚠️</span>
        <p style={{ fontSize: "8px", color: "#f59e0b", fontWeight: 700, margin: 0 }}>2 productos con stock bajo</p>
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "7px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
        {[{ n: "Arroz Diana 5kg", s: 45, ok: true }, { n: "Aceite Palma 3L", s: 8, ok: false }, { n: "Sal Refisal 500g", s: 2, ok: false }].map((p, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)", background: p.ok ? "transparent" : "rgba(245,158,11,0.03)" }}>
            <span style={{ fontSize: "8px", color: "rgba(255,255,255,0.75)" }}>{p.n}</span>
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: p.ok ? "#22c55e" : "#f59e0b" }}>{p.s}</span>
              <span style={{ padding: "1px 5px", borderRadius: "99px", fontSize: "7px", fontWeight: 600, background: p.ok ? "rgba(34,197,94,0.1)" : "rgba(245,158,11,0.1)", color: p.ok ? "#22c55e" : "#f59e0b" }}>{p.ok ? "OK" : "Bajo"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function IluConfig() {
  return (
    <div style={{ width: "100%" }}>
      {[{ l: "Nombre empresa", v: "Distrimas SC" }, { l: "WhatsApp pedidos", v: "+57 301 653 7553" }, { l: "Logo URL", v: "supabase.co/..." }].map(f => (
        <div key={f.l} style={{ marginBottom: "6px" }}>
          <p style={{ fontSize: "7px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px" }}>{f.l}</p>
          <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: "5px", padding: "5px 8px", border: "1px solid rgba(255,255,255,0.08)", fontSize: "9px", color: "rgba(255,255,255,0.75)" }}>{f.v}</div>
        </div>
      ))}
      <div style={{ background: "#D72638", borderRadius: "7px", padding: "6px", textAlign: "center", fontSize: "9px", fontWeight: 700, color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}>
        <Manito clickAnim={true} /> Guardar configuración
      </div>
    </div>
  )
}

function IluUsuarios() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "7px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.07)", marginBottom: "6px" }}>
        {[{ n: "Carlos Ruiz", p: "Vendedor", a: true }, { n: "María López", p: "Vendedor", a: true }, { n: "Admin", p: "Administrador", a: true }].map((u, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "20px", height: "20px", borderRadius: "5px", background: "#D72638", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px", fontWeight: 700, color: "white" }}>{u.n[0]}</div>
              <div>
                <p style={{ fontSize: "8px", fontWeight: 600, color: "white", margin: 0 }}>{u.n}</p>
                <p style={{ fontSize: "7px", color: "rgba(255,255,255,0.4)", margin: 0 }}>{u.p}</p>
              </div>
            </div>
            <span style={{ padding: "1px 6px", borderRadius: "99px", fontSize: "7px", fontWeight: 600, background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>Activo</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center" }}><Manito clickAnim={false} /></div>
    </div>
  )
}

/* ── Definición de pasos con rol ── */
interface PasoConfig {
  icono: string
  titulo: string
  desc: string
  ilustracion: React.ReactNode
  rol: "todos" | "admin" | "vendedor"
}

const TODOS_PASOS: PasoConfig[] = [
  {
    icono: "👋", rol: "todos",
    titulo: "¡Bienvenido a Distrimas SC!",
    desc: "Este instructivo te explica paso a paso cómo usar el sistema según tu perfil.",
    ilustracion: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
        <div style={{ fontSize: "50px", animation: "manitoFloat 2s ease-in-out infinite" }}>🏪</div>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "11px", textAlign: "center", lineHeight: 1.6, margin: 0 }}>Gestión de pedidos,<br />clientes e inventario</p>
      </div>
    ),
  },
  {
    icono: "📊", rol: "todos",
    titulo: "Dashboard — Tu panel principal",
    desc: "Al entrar verás pedidos del día, ventas del mes, clientes activos y productos agotados. También gráficos con los últimos 30 días.",
    ilustracion: <IluDashboard />,
  },
  {
    icono: "🛒", rol: "todos",
    titulo: "Crear un pedido nuevo",
    desc: "Toca 'Nuevo pedido'. Busca el cliente por nombre o código (el código aparece en rojo). Agrega productos con +, ajusta cantidades. Si hay más cantidad que stock verás una advertencia.",
    ilustracion: <IluPedido />,
  },
  {
    icono: "💬", rol: "todos",
    titulo: "Confirmar y enviar por WhatsApp",
    desc: "Al confirmar, el sistema guarda el pedido y abre WhatsApp automáticamente con el detalle completo: cliente, productos, cantidades, precios, total y hora exacta.",
    ilustracion: <IluWhatsApp />,
  },
  {
    icono: "📋", rol: "todos",
    titulo: "Ver mis pedidos",
    desc: "En 'Pedidos' ves todos los del día por defecto. Filtra por Hoy / Esta semana / Este mes. Toca cualquier pedido para ver detalles, cambiar estado o editar.",
    ilustracion: <IluPedidos />,
  },
  {
    icono: "👥", rol: "todos",
    titulo: "Clientes",
    desc: "Aquí están todas las tiendas asignadas. Busca por nombre, municipio o código. El código en rojo es el identificador único de cada tienda.",
    ilustracion: <IluClientes />,
  },
  {
    icono: "📦", rol: "todos",
    titulo: "Inventario",
    desc: "Consulta el stock de cada producto. Los amarillos tienen stock bajo. En el Dashboard verás cuántos productos están agotados.",
    ilustracion: <IluInventario />,
  },
  {
    icono: "👤", rol: "admin",
    titulo: "Gestión de usuarios (Admin)",
    desc: "Como administrador puedes crear vendedores, asignar perfiles y activar o desactivar cuentas. Los vendedores solo ven sus propias secciones.",
    ilustracion: <IluUsuarios />,
  },
  {
    icono: "⚙️", rol: "admin",
    titulo: "Configuraciones (Admin)",
    desc: "Actualiza el nombre de la empresa, sube el logo y configura el número de WhatsApp al que llegan todos los pedidos confirmados.",
    ilustracion: <IluConfig />,
  },
  {
    icono: "✅", rol: "todos",
    titulo: "¡Listo para empezar!",
    desc: "Ya conoces el sistema. Recuerda: puedes volver a ver este instructivo en cualquier momento desde el menú lateral. ¡Mucho éxito!",
    ilustracion: (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px" }}>
        <div style={{ fontSize: "48px" }}>🚀</div>
        <button onClick={() => window.open("https://wa.me/573016537553", "_blank")}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", borderRadius: "8px", color: "#25D366", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>
          💬 Soporte JD
        </button>
      </div>
    ),
  },
]

export default function TourGuia({ user, onClose }: { user: Usuario; onClose: () => void }) {
  const isAdmin = user.perfil?.nombre === "Administrador"
  const pasos = TODOS_PASOS.filter(p => p.rol === "todos" || (p.rol === "admin" && isAdmin))

  const [paso, setPaso] = useState(0)
  const p = pasos[paso]
  const ultimo = paso === pasos.length - 1
  const progreso = ((paso + 1) / pasos.length) * 100

  async function finalizar() {
    await supabase.from("usuarios").update({ primer_ingreso: false }).eq("id", user.id)
    const raw = localStorage.getItem("distrimas_user")
    if (raw) localStorage.setItem("distrimas_user", JSON.stringify({ ...JSON.parse(raw), primer_ingreso: false }))
    onClose()
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "12px" }}>
      <div style={{ background: "#171B25", border: "1px solid rgba(255,255,255,0.07)", borderRadius: "16px", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>

        {/* Barra progreso */}
        <div style={{ height: "3px", background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${progreso}%`, background: "#D72638", transition: "width 0.4s ease" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "rgba(215,38,56,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0 }}>{p.icono}</div>
            <div>
              <p style={{ fontSize: "9px", color: "#555C74", margin: 0, textTransform: "uppercase", letterSpacing: "0.8px" }}>Paso {paso + 1} de {pasos.length}</p>
              <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "white", lineHeight: 1.2 }}>{p.titulo}</h3>
            </div>
          </div>
          <button onClick={finalizar} style={{ background: "none", border: "none", cursor: "pointer", color: "#555C74", fontSize: "18px", padding: "4px", lineHeight: 1 }}>✕</button>
        </div>

        {/* Ilustración */}
        <div style={{ margin: "14px 16px", background: "linear-gradient(160deg,#1E2330,#141720)", borderRadius: "10px", padding: "14px", minHeight: "160px", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(255,255,255,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: "-30px", right: "-30px", width: "100px", height: "100px", borderRadius: "50%", background: "rgba(215,38,56,0.05)" }} />
          <div style={{ width: "100%", position: "relative" }}>{p.ilustracion}</div>
        </div>

        {/* Descripción */}
        <p style={{ color: "#8B91A8", fontSize: "13px", lineHeight: 1.65, margin: "0 16px 14px", minHeight: "52px" }}>{p.desc}</p>

        {/* Dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: "5px", marginBottom: "14px" }}>
          {pasos.map((_, i) => (
            <button key={i} onClick={() => setPaso(i)} style={{ width: i === paso ? "20px" : "7px", height: "7px", borderRadius: "99px", border: "none", cursor: "pointer", background: i === paso ? "#D72638" : i < paso ? "rgba(215,38,56,0.35)" : "#2A3044", transition: "all 0.3s", padding: 0 }} />
          ))}
        </div>

        {/* Botones */}
        <div style={{ display: "flex", gap: "8px", padding: "0 16px 16px" }}>
          {paso > 0 && (
            <button onClick={() => setPaso(p2 => p2 - 1)} style={{ flex: 1, padding: "11px", background: "rgba(255,255,255,0.06)", color: "#F0F2F7", fontWeight: 600, fontSize: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}>← Atrás</button>
          )}
          <button onClick={ultimo ? finalizar : () => setPaso(p2 => p2 + 1)} style={{ flex: 1, padding: "11px", background: ultimo ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#D72638", color: "white", fontWeight: 700, fontSize: "14px", borderRadius: "10px", border: "none", cursor: "pointer", boxShadow: ultimo ? "0 4px 12px rgba(34,197,94,0.3)" : "0 4px 12px rgba(215,38,56,0.3)" }}>
            {ultimo ? "¡Comenzar! 🚀" : "Siguiente →"}
          </button>
        </div>

        {!ultimo && (
          <button onClick={finalizar} style={{ background: "none", border: "none", cursor: "pointer", color: "#555C74", fontSize: "11px", width: "100%", padding: "0 0 12px", display: "block", textAlign: "center" }}>
            Saltar instructivo
          </button>
        )}
      </div>

      <style>{`
        @keyframes manitoFloat { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-7px) rotate(5deg)} }
        @keyframes manitoClick { 0%,100%{transform:scale(1)} 50%{transform:scale(0.72) translateY(4px)} }
      `}</style>
    </div>
  )
}
