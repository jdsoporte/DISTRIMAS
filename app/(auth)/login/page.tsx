"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { login } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

const BRAND = "#C0392B"        // rojo más apagado y elegante
const BRAND_DARK = "#922B21"   // tono oscuro para gradiente

export default function LoginPage() {
  const router = useRouter()
  const [usuario, setUsuario]   = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [verPass, setVerPass]   = useState(false)
  const LOGO_URL = "/logo.png"
  const [logoUrl, setLogoUrl]     = useState(LOGO_URL)
  const [logoOk, setLogoOk]       = useState(true)

  useEffect(() => {
    supabase.from("configuraciones").select("logo_url").limit(1).single()
      .then(({ data }) => { if (data?.logo_url) setLogoUrl(data.logo_url) })
  }, [])

  async function handleLogin() {
    setError("")
    if (!usuario.trim()) { setError("Por favor ingresa tu usuario"); return }
    if (!password.trim()) { setError("Por favor ingresa tu contraseña"); return }
    setLoading(true)
    const { data, error: err } = await login(usuario.trim(), password)
    setLoading(false)
    if (err || !data) { setError(err || "Error al iniciar sesión"); return }
    router.push("/")
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#F0F2F5", position: "relative", overflow: "hidden", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Panel izquierdo */}
      <div className="login-left" style={{
        flex: 1,
        background: `linear-gradient(150deg, ${BRAND} 0%, ${BRAND_DARK} 60%, #641E16 100%)`,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "48px", position: "relative", overflow: "hidden"
      }}>
        {/* Formas decorativas */}
        <div style={{ position: "absolute", top: "-100px", left: "-100px", width: "380px", height: "380px", borderRadius: "50%", background: "rgba(255,255,255,0.05)" }} />
        <div style={{ position: "absolute", bottom: "-80px", right: "-80px", width: "300px", height: "300px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", top: "45%", right: "-40px", width: "180px", height: "180px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "absolute", top: "20%", left: "10%", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />

        {/* Línea decorativa horizontal */}
        <div style={{ position: "absolute", bottom: "120px", left: 0, right: 0, height: "1px", background: "rgba(255,255,255,0.08)" }} />

        <div style={{ position: "relative", zIndex: 2, textAlign: "center", width: "100%", maxWidth: "420px" }}>
          {/* Logo espectacular */}
          <div className="logo-bounce" style={{
            width: "220px", height: "220px", borderRadius: "36px",
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(10px)",
            border: "2px solid rgba(255,255,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 28px", overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.2)",
          }}>
            {logoOk
              ? <img src={logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "20px" }} onError={() => setLogoOk(false)} />
              : <span style={{ color: "white", fontWeight: "bold", fontSize: "90px" }}>D</span>
            }
          </div>

          <div className="logo-fade-up" style={{ animationDelay: "0.3s" }}>
            <h1 style={{ fontSize: "30px", fontWeight: 700, color: "white", margin: "0 0 10px", letterSpacing: "-0.5px" }}>Distrimas SC</h1>
            <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "14px", margin: "0 0 32px", lineHeight: 1.7 }}>
              Sistema de gestión de pedidos,<br />clientes e inventario
            </p>
          </div>

          {/* Features — grid 2x2 */}
          <div className="logo-fade-up" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", animationDelay: "0.5s" }}>
            {[
              { icon: "📦", label: "Pedidos en tiempo real" },
              { icon: "📊", label: "Control de inventario" },
              { icon: "📈", label: "Estadísticas de ventas" },
              { icon: "👥", label: "Gestión de clientes" },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "14px 10px", borderRadius: "12px", background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", textAlign: "center" }}>
                <span style={{ fontSize: "22px" }}>{item.icon}</span>
                <span style={{ color: "rgba(255,255,255,0.88)", fontSize: "12px", fontWeight: 500, lineHeight: 1.4 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer del panel */}
        <p style={{ position: "absolute", bottom: "20px", fontSize: "11px", color: "rgba(255,255,255,0.3)", letterSpacing: "0.5px" }}>
          © {new Date().getFullYear()} Distrimas SC
        </p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="login-right" style={{
        width: "100%", maxWidth: "500px",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: "40px 24px", background: "white", position: "relative"
      }}>
        <div style={{ width: "100%", maxWidth: "370px" }}>

          {/* Logo móvil */}
          <div className="login-mobile-logo" style={{ display: "none", alignItems: "center", gap: "14px", marginBottom: "32px" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "14px", flexShrink: 0,
              background: logoOk ? "white" : `linear-gradient(135deg, ${BRAND}, ${BRAND_DARK})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              border: logoOk ? `1.5px solid #E5E7EB` : "none",
              boxShadow: `0 4px 16px rgba(192,57,43,0.2)`
            }}>
              {logoOk
                ? <img
                    src={logoUrl} alt=""
                    style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6px" }}
                    onError={() => setLogoOk(false)}
                  />
                : <span style={{ color: "white", fontWeight: "bold", fontSize: "24px" }}>D</span>
              }
            </div>
            <div>
              <p style={{ fontWeight: 700, color: "#141720", fontSize: "17px", margin: "0 0 2px" }}>Distrimas SC</p>
              <p style={{ color: "#9CA3AF", fontSize: "12px", margin: 0 }}>Sistema de gestión</p>
            </div>
          </div>

          {/* Encabezado */}
          <div style={{ marginBottom: "32px" }}>
            <h2 style={{ fontSize: "26px", fontWeight: 700, color: "#111827", margin: "0 0 6px", letterSpacing: "-0.5px" }}>Bienvenido</h2>
            <p style={{ color: "#9CA3AF", fontSize: "14px", margin: 0 }}>Ingresa tus credenciales para continuar</p>
          </div>

          {error && (
            <div style={{
              background: "rgba(192,57,43,0.07)", border: `1px solid rgba(192,57,43,0.2)`,
              color: BRAND, borderRadius: "10px", padding: "11px 14px",
              fontSize: "13px", marginBottom: "20px", fontWeight: 500,
              display: "flex", alignItems: "center", gap: "8px"
            }}>
              <span style={{ fontSize: "15px" }}>⚠️</span> {error}
            </div>
          )}

          {/* Usuario */}
          <div style={{ marginBottom: "18px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6B7280", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.6px" }}>Usuario</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#D1D5DB" }}>👤</span>
              <input
                type="text"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                onKeyDown={e => e.key === "Enter" && document.getElementById("inp-pass")?.focus()}
                placeholder="Tu nombre de usuario"
                style={{ width: "100%", padding: "12px 14px 12px 42px", background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "10px", color: "#111827", fontSize: "14.5px", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, background 0.2s" }}
                onFocus={e => { e.target.style.borderColor = BRAND; e.target.style.background = "#fff"; e.target.style.boxShadow = `0 0 0 3px rgba(192,57,43,0.08)` }}
                onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; e.target.style.boxShadow = "none" }}
              />
            </div>
          </div>

          {/* Contraseña */}
          <div style={{ marginBottom: "28px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#6B7280", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.6px" }}>Contraseña</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", fontSize: "16px", color: "#D1D5DB" }}>🔒</span>
              <input
                id="inp-pass"
                type={verPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="••••••••"
                style={{ width: "100%", padding: "12px 46px 12px 42px", background: "#F9FAFB", border: "1.5px solid #E5E7EB", borderRadius: "10px", color: "#111827", fontSize: "14.5px", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, background 0.2s" }}
                onFocus={e => { e.target.style.borderColor = BRAND; e.target.style.background = "#fff"; e.target.style.boxShadow = `0 0 0 3px rgba(192,57,43,0.08)` }}
                onBlur={e => { e.target.style.borderColor = "#E5E7EB"; e.target.style.background = "#F9FAFB"; e.target.style.boxShadow = "none" }}
              />
              <button type="button" onClick={() => setVerPass(v => !v)}
                style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "17px", padding: 0, lineHeight: 1 }}>
                {verPass ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Botón principal */}
          <button onClick={handleLogin} disabled={loading} style={{
            width: "100%", padding: "13px",
            background: loading ? "#e0e0e0" : `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)`,
            color: loading ? "#9CA3AF" : "white",
            fontWeight: 700, fontSize: "15px", borderRadius: "10px", border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            boxShadow: loading ? "none" : `0 4px 14px rgba(192,57,43,0.35)`,
            letterSpacing: "0.3px"
          }}>
            {loading ? "Iniciando sesión..." : "Iniciar sesión →"}
          </button>

          {/* Footer */}
          <div style={{ marginTop: "32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <p style={{ color: "#D1D5DB", fontSize: "11px", margin: 0 }}>
              © {new Date().getFullYear()} Distrimas SC
            </p>
            {/* Botón soporte — muy discreto */}
            <button
              onClick={() => window.open("https://wa.me/573016537553", "_blank")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "5px",
                color: "#C8C8C8", fontSize: "11px", padding: "4px 8px",
                borderRadius: "6px", transition: "color 0.2s",
                fontFamily: "inherit"
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#25D366" }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#C8C8C8" }}
              title="Contactar soporte"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Soporte JD
            </button>
          </div>

        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .login-left { display: none !important; }
          .login-mobile-logo { display: flex !important; }
          .login-right { padding: 32px 20px !important; justify-content: flex-start !important; padding-top: 48px !important; }
        }
        @media (max-width: 400px) {
          .login-right { padding: 28px 16px !important; padding-top: 40px !important; }
        }

        @keyframes logoBounce {
          0%   { transform: scale(0) rotate(-15deg) translateY(-120px); opacity: 0; }
          40%  { transform: scale(1.25) rotate(6deg) translateY(20px);  opacity: 1; }
          60%  { transform: scale(0.88) rotate(-4deg) translateY(-10px); }
          75%  { transform: scale(1.12) rotate(2deg) translateY(8px); }
          88%  { transform: scale(0.95) rotate(-1deg) translateY(-4px); }
          100% { transform: scale(1)    rotate(0deg) translateY(0);    opacity: 1; }
        }
        @keyframes fadeUp {
          0%   { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 20px 60px rgba(0,0,0,0.4), 0 0 0 0 rgba(255,255,255,0); }
          50%       { box-shadow: 0 20px 80px rgba(0,0,0,0.4), 0 0 60px rgba(255,255,255,0.25), 0 0 0 6px rgba(255,255,255,0.08); }
        }

        .logo-bounce {
          animation: logoBounce 1s cubic-bezier(0.22, 1, 0.36, 1) forwards,
                     glowPulse 2.5s ease-in-out 1.2s infinite;
          opacity: 0;
        }
        .logo-fade-up {
          opacity: 0;
          animation: fadeUp 0.6s ease forwards;
        }
      `}</style>
    </div>
  )
}
