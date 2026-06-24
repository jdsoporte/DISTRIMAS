"use client"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { getSession, logout } from "@/lib/auth"
import { Usuario } from "@/lib/types"
import { ThemeContext, DARK, LIGHT } from "@/lib/theme-context"
import TourGuia from "@/components/TourGuia"
import OfflineSync from "@/components/OfflineSync"

const MENUS_ADMIN = [
  { section: "Principal" },
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "pedidos", label: "Pedidos", href: "/pedidos" },
  { id: "estadisticas", label: "Estadísticas", href: "/estadisticas" },
  { section: "Gestión" },
  { id: "clientes", label: "Clientes", href: "/clientes" },
  { id: "inventario", label: "Inventario", href: "/inventario" },
  { id: "rutas", label: "Rutas", href: "/rutas" },
  { id: "programacion", label: "Programación", href: "/programacion" },
  { section: "Administración" },
  { id: "festivos", label: "Festivos", href: "/festivos" },
  { id: "usuarios", label: "Usuarios", href: "/usuarios" },
  { id: "perfiles", label: "Perfiles", href: "/perfiles" },
  { id: "configuraciones", label: "Configuraciones", href: "/configuraciones" },
]

const MENUS_VENDEDOR = [
  { section: "Principal" },
  { id: "dashboard", label: "Dashboard", href: "/" },
  { id: "nuevo-pedido", label: "Nuevo pedido", href: "/pedidos/nuevo" },
  { id: "mis-pedidos", label: "Mis pedidos", href: "/pedidos" },
  { id: "mi-ruta", label: "Mi ruta de hoy", href: "/mi-ruta" },
  { section: "Clientes" },
  { id: "clientes", label: "Clientes", href: "/clientes" },
  { section: "Consulta" },
  { id: "inventario", label: "Inventario", href: "/inventario" },
]

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard", "/pedidos": "Pedidos", "/pedidos/nuevo": "Nuevo pedido",
  "/clientes": "Clientes", "/inventario": "Inventario", "/rutas": "Rutas", "/programacion": "Programación", "/festivos": "Festivos", "/mi-ruta": "Mi ruta de hoy",
  "/usuarios": "Usuarios", "/perfiles": "Perfiles y permisos", "/estadisticas": "Estadísticas",
  "/configuraciones": "Configuraciones",
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<Usuario | null>(null)
  const [darkMode, setDarkMode] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fecha, setFecha] = useState("")
  const [tutorial, setTutorial] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem("distrimas_dark")
    if (saved !== null) setDarkMode(saved === "1")
    const session = getSession()
    if (!session) { router.push("/login"); return }
    setUser(session)
    if (session.primer_ingreso && session.perfil?.nombre !== "Administrador") setTutorial(true)
    const fmt = () => new Date().toLocaleDateString("es-CO", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    setFecha(fmt())
    const interval = setInterval(() => setFecha(fmt()), 60000)
    return () => clearInterval(interval)
  }, [router])

  function toggleDark() {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem("distrimas_dark", next ? "1" : "0")
  }

  useEffect(() => { setSidebarOpen(false) }, [pathname])

  if (!user) return null

  const theme = darkMode ? DARK : LIGHT
  const isAdmin = user.perfil?.nombre === "Administrador"
  const menus = isAdmin ? MENUS_ADMIN : MENUS_VENDEDOR

  const SidebarContent = () => (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "20px 16px", borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "#fff", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(215,38,56,0.2)" }}>
          <img src="https://zwilxcrbukksmwuqkfay.supabase.co/storage/v1/object/public/imagenes/logo.png" alt="Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </div>
        <div>
          <p style={{ fontWeight: "bold", fontSize: "14px", margin: 0, color: theme.text }}>Distrimas SC</p>
          <p style={{ color: theme.muted, fontSize: "11px", margin: 0 }}>Panel de gestión</p>
        </div>
        {/* Botón cerrar en móvil */}
        <button onClick={() => setSidebarOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", color: theme.muted, fontSize: "20px", cursor: "pointer", display: "none" }} className="sidebar-close-btn">✕</button>
      </div>

      <div style={{ margin: "12px", padding: "10px 12px", borderRadius: "8px", background: theme.cardAlt, border: `1px solid ${theme.border}`, display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#D72638", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: "bold", fontSize: "13px", flexShrink: 0 }}>
          {user.nombre.charAt(0).toUpperCase()}
        </div>
        <div style={{ overflow: "hidden" }}>
          <p style={{ fontWeight: 600, fontSize: "13px", margin: 0, color: theme.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.nombre}</p>
          <p style={{ color: theme.muted, fontSize: "11px", margin: 0 }}>{isAdmin ? "Administrador" : "Vendedor"}</p>
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
        {menus.map((item, i) => {
          if ("section" in item) return <p key={i} style={{ padding: "16px 18px 6px", fontSize: "10px", fontWeight: "bold", color: "#555C74", textTransform: "uppercase", letterSpacing: "1.2px", margin: 0 }}>{item.section}</p>
          const active = pathname === item.href
          return (
            <div key={item.id} onClick={() => router.push(item.href!)}
              style={{ position: "relative", display: "flex", alignItems: "center", margin: "2px 8px", padding: "10px 12px", borderRadius: "8px", fontSize: "14px", fontWeight: active ? 600 : 500, color: active ? "#D72638" : theme.muted, background: active ? "rgba(215,38,56,0.12)" : "transparent", cursor: "pointer" }}>
              {active && <span style={{ position: "absolute", left: "-8px", top: "50%", transform: "translateY(-50%)", width: "3px", height: "60%", background: "#D72638", borderRadius: "99px" }} />}
              {item.label}
            </div>
          )
        })}
      </nav>

      <div style={{ padding: "12px", borderTop: `1px solid ${theme.border}` }}>
        <button onClick={toggleDark} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", fontSize: "13.5px", color: theme.muted, background: "none", border: "none", cursor: "pointer", width: "100%" }}>
          {darkMode ? "☀️ Modo claro" : "🌙 Modo oscuro"}
          <div style={{ marginLeft: "auto", width: "36px", height: "20px", borderRadius: "99px", background: darkMode ? theme.cardAlt : "#D72638", border: `1px solid ${theme.border}`, position: "relative" }}>
            <span style={{ position: "absolute", width: "14px", height: "14px", borderRadius: "50%", top: "2px", left: darkMode ? "2px" : "18px", background: darkMode ? "#555C74" : "#fff", transition: "left 0.2s" }} />
          </div>
        </button>
        <button onClick={() => setTutorial(true)} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", fontSize: "13.5px", color: theme.muted, background: "none", border: "none", cursor: "pointer", width: "100%" }}>
          📖 Ver instructivo
        </button>
        <button onClick={() => { logout(); router.push("/login") }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "8px", fontSize: "13.5px", color: theme.muted, background: "none", border: "none", cursor: "pointer", width: "100%" }}>
          🚪 Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <ThemeContext.Provider value={theme}>
      {tutorial && <TourGuia user={user} onClose={() => setTutorial(false)} />}
      <div style={{ display: "flex", minHeight: "100vh", background: theme.bg, color: theme.text, fontFamily: "system-ui, sans-serif" }}>

        {/* Overlay móvil */}
        {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 99 }} />}

        {/* Sidebar desktop */}
        <aside className="sidebar-desktop" style={{ position: "fixed", left: 0, top: 0, bottom: 0, width: "260px", background: theme.card, borderRight: `1px solid ${theme.border}`, flexDirection: "column", zIndex: 100 }}>
          <SidebarContent />
        </aside>

        {/* Sidebar móvil (drawer) */}
        <aside style={{ position: "fixed", left: sidebarOpen ? 0 : "-280px", top: 0, bottom: 0, width: "260px", background: theme.card, borderRight: `1px solid ${theme.border}`, display: "flex", flexDirection: "column", zIndex: 100, transition: "left 0.25s ease" }}>
          <SidebarContent />
        </aside>

        {/* Contenido principal */}
        <main className="main-content" style={{ marginLeft: "260px", flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <header style={{ height: "60px", background: theme.card, borderBottom: `1px solid ${theme.border}`, display: "flex", alignItems: "center", padding: "0 20px", gap: "12px", position: "sticky", top: 0, zIndex: 50 }}>
            {/* Botón hamburguesa solo en móvil */}
            <button className="header-menu-btn" onClick={() => setSidebarOpen(true)}
              style={{ display: "none", background: "none", border: "none", color: theme.text, fontSize: "22px", cursor: "pointer", padding: "4px 8px", borderRadius: "6px" }}>
              ☰
            </button>
            <span style={{ fontSize: "17px", fontWeight: "bold", color: theme.text }}>{PAGE_TITLES[pathname] || "Dashboard"}</span>
            <span style={{ marginLeft: "auto", fontSize: "11px", color: theme.muted, textTransform: "capitalize", display: "block" }}
              className="fecha-hide">{fecha}</span>
          </header>
          <div className="page-padding" style={{ padding: "24px", flex: 1, minWidth: 0 }}>{children}</div>
        </main>
      </div>
      <OfflineSync />
    </ThemeContext.Provider>
  )
                         }
      
